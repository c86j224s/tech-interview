---
id: transformer-attention-masks-kv-cache
title: Transformer attention mask와 KV 캐시 추론
topic: 머신러닝
summary: >-
  scaled dot-product attention의 causal·padding mask와 autoregressive decoding의 과거
  K/V 재사용이 만드는 비용·메모리 계약을 설명합니다.
questionIds: []
prerequisites:
  - loss-objective
  - gradient-descent
  - data-splits
related:
  - agent-context-handoff
  - gradient-descent
reviewedAt: '2026-09-19'
---
# Transformer attention mask와 KV 캐시 추론

Transformer 추론에서 attention mask와 KV cache는 서로 다른 계약을 해결합니다. mask는 어떤 query 위치가 어떤 key 위치를 볼 수 있는지를 정하고, KV cache는 이미 계산한 과거 key/value를 다음 decoding step에서 재사용합니다. 전자는 정보 누출·padding 오염을 막는 논리 제약이고, 후자는 autoregressive generation의 반복 계산을 줄이는 상태 최적화입니다. 둘을 하나의 “attention 설정”으로 뭉개면 batch padding, causal 방향, cache position과 메모리 상한을 동시에 놓치게 됩니다.

## Scaled dot-product attention의 상태

한 attention head에서 query `Q`, key `K`, value `V`가 있을 때 핵심 계산은 다음과 같습니다.

```text
scores = Q Kᵀ / sqrt(d_head)
weights = softmax(scores + mask)
output = weights V
```

`Q`의 각 row는 현재 query 위치이고, `K`의 각 row는 볼 수 있는 key 위치입니다. `scores[t,s]`는 query 위치 `t`가 key 위치 `s`를 얼마나 참고할지 나타냅니다. mask는 허용 위치에는 0, 금지 위치에는 큰 음수 또는 구현상 이에 준하는 표현을 더해 softmax에서 기여하지 않게 합니다. 모델과 framework에 따라 mask shape·dtype·반전 의미가 다를 수 있으므로, “True가 keep인지 block인지”를 API 계약으로 확인해야 합니다.

## Padding mask와 batch 길이

서로 다른 길이의 sequence를 batch로 묶으려면 짧은 입력 뒤에 PAD token을 채웁니다. 예를 들어 실제 길이가 3인 `A B C`를 길이 5 batch로 만들면 `[A,B,C,PAD,PAD]`입니다. padding mask는 key 위치 4와 5 같은 fake token을 다른 query가 읽지 못하게 합니다. 이 mask는 causal 여부와 독립적인 축입니다. 비자기회귀 encoder에서는 미래를 볼 수 있지만 PAD는 보면 안 되고, decoder에서는 PAD 차단과 미래 차단이 동시에 필요할 수 있습니다.

padding mask가 빠지면 실제 token의 attention weight 일부가 PAD에 분배됩니다. PAD embedding이 우연히 0이라고 해도 projection, bias, residual과 layer normalization을 거치며 “아무 영향도 없다”고 보장되지 않습니다. query 자체가 PAD인 row도 loss에서 제외해야 합니다. key를 가리는 것과 output loss에서 PAD label을 무시하는 것은 별도 처리입니다.

## Causal mask와 미래 위치

autoregressive decoder가 위치 `t`의 다음 token을 예측할 때, 위치 `s>t`의 정답 token을 읽으면 학습 시 정답을 미리 본 정보 누출이 생깁니다. causal mask는 대각선과 그 왼쪽을 허용하고 오른쪽 미래를 차단합니다. 길이 4의 허용 matrix는 다음과 같습니다.

```text
      key: 0 1 2 3
q 0       1 0 0 0
q 1       1 1 0 0
q 2       1 1 1 0
q 3       1 1 1 1
```

query 위치가 0-based인지, position ID가 절대 token 위치인지, mask가 이미 broadcast된 shape인지가 구현의 경계입니다. 한 token decode에서는 새 query row가 과거 모든 key와 자기 자신은 볼 수 있지만 미래는 없습니다. causal mask가 상삼각이 아니라 하삼각을 막는 식으로 뒤집히면 모델이 과거를 못 보고 미래를 보거나, 전체가 차단될 수 있습니다.

```diagram
{"title":"Mask와 cache의 분리","caption":"mask는 허용 edge를 정의하고 cache는 이미 계산한 K/V를 보존해 다음 step에서 재사용합니다.","rows":[[{"id":"tokens","label":"입력 token","detail":["현재 prefix"]}],[{"id":"mask","label":"attention mask","detail":["padding · causal"]},{"id":"cache","label":"KV cache","detail":["past K/V"]}],[{"id":"attn","label":"masked attention","detail":["허용 위치"]}],[{"id":"next","label":"다음 token","detail":["decode"]}]],"edges":[{"from":"tokens","to":"mask","label":"위치 제약"},{"from":"tokens","to":"cache","label":"K/V append"},{"from":"mask","to":"attn","label":"금지 edge 차단"},{"from":"cache","to":"attn","label":"past reuse"},{"from":"attn","to":"next","label":"logits"}]}
```

## Prefill과 decode 단계

생성 요청은 보통 전체 prompt를 한 번 처리하는 prefill과, 이후 token을 한 개 또는 작은 묶음씩 처리하는 decode로 나눕니다. prefill에서 길이 `L`의 prompt에 대해 각 layer가 K와 V를 계산하고 cache에 저장합니다. 다음 decode step에서는 새 token의 Q를 계산하고, 새 token의 K/V를 기존 cache에 append한 뒤 Q가 과거 cache 전체를 attention하도록 합니다.

cache가 없으면 step `t`마다 prefix 전체의 K/V를 다시 계산하므로 총 계산량이 길이에 따라 커집니다. cache가 있으면 과거 K/V의 projection을 반복하지 않고 새 token의 K/V만 추가합니다. 하지만 새 query는 과거 모든 key와 내적해야 하므로 attention 읽기 비용과 sequence 길이에 따른 메모리 읽기는 남습니다. “KV cache가 decoding을 O(1)로 만든다”가 아니라, 반복되는 과거 projection 계산을 줄이고 step당 attention의 key/value scan은 유지한다고 설명해야 합니다.

## Cache shape와 메모리 계산

일반적인 multi-head attention에서 layer당 cache shape를 설명용으로 `batch × kv_heads × sequence × head_dim`의 K와 같은 크기의 V로 둘 수 있습니다. 전체 bytes의 근사식은 다음과 같습니다.

```text
bytes ≈ 2(K,V) × layers × batch × kv_heads × sequence × head_dim × bytes_per_element
```

예를 들어 `layers=32`, `kv_heads=32`, `sequence=4096`, `head_dim=128`, `batch=8`, bf16 2 bytes라면
`2×32×8×32×4096×128×2 = 17,179,869,184 bytes`, 약 16GiB입니다. 이는 다른 activation, weights, allocator 여유, framework layout을 제외한 설명용 계산입니다. batch를 1로 낮추면 약 2GiB가 되어 cache만 놓고 8배 차이가 납니다. GQA/MQA처럼 `kv_heads`가 query heads보다 작으면 이 식의 heads 항도 줄어듭니다.

sequence가 4,096에서 8,192로 두 배가 되면 같은 batch와 dtype에서 cache bytes도 두 배입니다. weight memory를 줄이는 것이 아니며, context를 무한히 늘릴 수 있다는 뜻도 아닙니다. admission control에서 요청별 예상 cache 상한을 계산하고, 길이·batch·동시성 조합에 따라 p99가 어떻게 바뀌는지 측정해야 합니다.

## Position ID와 append 계약

cache는 단순한 token 목록이 아니라 특정 request의 특정 위치까지 계산된 K/V입니다. A 요청의 길이 20 cache를 B 요청의 position 0 token과 공유하면 B가 A의 과거 정보를 읽는 데이터 혼합이 발생합니다. 전역 singleton cache를 사용하거나 요청 종료 후 reset하지 않는 구현에서 이런 버그는 모델 weight 손상처럼 보일 수 있지만 실제로는 request scope와 position metadata 문제일 수 있습니다.

각 cache handle에는 최소한 request ID 또는 소유권, layer별 K/V, 현재 sequence length, position offset, batch slot을 함께 묶는 편이 안전합니다. 새 token을 append할 때 `cache_position`이 현재 저장 길이와 일치하는지 assertion을 둡니다. rotary position embedding 등 위치 의존 계산을 쓰는 모델은 K/V에 적용한 position이 실제 token 위치와 맞아야 합니다. 왼쪽 padding batch에서는 attention mask와 position ID를 동일하게 오른쪽 기준으로 처리하지 않으면 padding 이후의 실제 token 위치가 어긋날 수 있습니다.

## Batch와 beam reorder

동시 요청을 한 batch로 처리하면 batch row와 request handle의 mapping을 유지해야 합니다. 요청 A가 끝나 row 0을 새 요청 C에 재사용한다면 A의 cache가 삭제되거나 새 handle로 덮어써졌는지 확인합니다. beam search에서는 한 부모 beam에서 여러 자식 beam이 생기며, top-k 선택 뒤 beam row 순서가 바뀝니다. cache tensor를 새 beam 순서에 맞춰 gather/reorder하지 않으면 beam 2의 K/V를 beam 0이 읽게 됩니다.

설명용 상태를 `rows=[A0,A1,B0]`에서 score 정렬 뒤 `[B0,A1,A0]`로 바꾼다고 하겠습니다. cache도 같은 permutation `[2,1,0]`으로 재배열해야 합니다. logits만 순서를 바꾸고 K/V는 원래 순서로 두면 다음 step의 token은 맞는 것처럼 보여도 여러 step 뒤 문맥이 섞입니다. 이 문제는 단일 batch·단일 beam 시험에서는 드러나지 않으므로, 서로 다른 고유 prefix와 reorder가 포함된 검증이 필요합니다.

## 구현·검증 절차

먼저 길이 3짜리 입력 두 개를 batch에 padding해 mask matrix와 output의 PAD 영향 여부를 확인합니다. 다음으로 길이 4 prompt에 causal mask를 적용해 위치 0이 위치 1~3을 읽지 않는지, 위치 3은 0~3을 읽는지 작은 score matrix로 검사합니다. 실제 실행하지 않았다면 이 예시는 설명용 expected outcome이며 특정 framework 실행 성공으로 쓰지 않습니다.

그 다음 cache 사용 경로와 cache 미사용 경로가 동일한 logits를 내는지 tolerance 안에서 비교합니다. prefill 전체 결과와 token-by-token decode 결과를 같은 position ID와 dtype으로 맞추고, attention mask shape도 dump합니다. 마지막으로 batch reorder, request cancellation, left/right padding, context limit 초과, mixed dtype, beam duplication을 넣어 cache ownership과 current length assertion을 검증합니다.

trace에 request ID, batch slot, current length, position offset, layer·head shape, cache bytes, mask shape, reorder permutation을 기록하면 “모델이 이상하다”는 증상을 상태 계약 위반으로 좁힐 수 있습니다. all-masked row가 생기면 softmax 구현에 따라 NaN이나 uniform 분포가 나올 수 있으므로, 실제로 가능한 padding과 causal 조합에서 query row가 적어도 하나의 key를 허용하는지 확인합니다.

## 비용·한계와 참고 자료

mask는 올바른 정보 흐름을 보장하지만 attention 계산 자체를 반드시 줄이지는 않습니다. dense mask tensor를 만들어도 kernel이 금지 위치를 효율적으로 건너뛰는지는 별도 구현 문제입니다. KV cache는 latency를 줄이는 대신 sequence·batch·layer·KV head·dtype에 비례하는 memory를 예약하고, cache eviction이나 paged allocation이 있으면 추가적인 fragmentation·address mapping 계약이 생깁니다.

[Transformer 논문](https://arxiv.org/abs/1706.03762)은 이번 검토에서 abstract 수준으로 읽을 수 있어 scaled dot-product attention과 autoregressive 구조의 범위로만 사용했습니다. padding mask의 boolean 방향과 framework shape는 이 논문에서 확정하지 않았습니다. KV cache의 past K/V 재사용과 shape·lifecycle 설명은 [Hugging Face Transformers의 `cache_explanation` 문서](https://huggingface.co/docs/transformers/main/en/cache_explanation)에서 읽을 수 있었지만 current URL은 정확한 library release를 고정하지 않습니다. 따라서 특정 framework의 mask True/False 의미, static/dynamic cache 구현, offload·quantized cache 기본값은 해당 버전 문서를 읽고 확인해야 합니다.

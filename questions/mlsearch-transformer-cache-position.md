---
id: mlsearch-transformer-cache-position
title: KV cache 재사용에서 position이나 batch 순서를 잘못 관리하면 왜 요청 문맥이 섞이나요?
difficulty: 중하
category: 머신러닝
tags:
  - Transformer
  - KV cache
  - position ids
related:
  - agent-context-engineering
  - request-scoped-loader-cache
---
# KV cache 재사용에서 position이나 batch 순서를 잘못 관리하면 왜 요청 문맥이 섞이나요?

## 구두 답변

KV cache는 특정 request의 prefix를 특정 position까지 계산한 K/V 상태이므로 전역 singleton처럼 공유하면 문맥이 섞입니다. A의 길이 20 cache를 B가 position 0부터 사용하면 B의 attention이 A token을 읽고, position ID를 잘못 append하면 rotary position 같은 위치 의존 계산도 어긋납니다. batch나 beam reorder 뒤에는 logits뿐 아니라 cache tensor의 row도 같은 permutation으로 remap해야 합니다.

안전한 cache handle에는 request ID 또는 소유권, layer별 K/V, current length, position offset, batch slot을 묶습니다. 새 token을 append할 때 position이 current length와 일치하는지 assertion하고, 요청 종료 후 slot을 clear/reinitialize합니다. 설명용으로 rows `[A0,A1,B0]`가 score 정렬 후 `[B0,A1,A0]`가 되면 cache도 permutation `[2,1,0]`으로 gather해야 합니다. logits만 재정렬하면 다음 step이 다른 beam의 과거 K/V를 읽을 수 있습니다.

검증은 서로 다른 prefix를 쓰는 A/B 동시 요청, request cancellation 후 slot 재사용, beam reorder, left padding을 포함해 cache 사용과 full recompute logits를 비교합니다. trace에 request ID·slot·current length·position offset·shape·reorder permutation을 기록하고, 실제 framework의 cache_position과 mask broadcasting 계약을 버전 문서로 확인하겠습니다.


상태표는 `[request,slot,current_length,position]` 네 열로 남깁니다. A가 slot0에서 length20이면 B가 그 slot을 재사용할 때 generation을 증가시키고 length를 0으로 reset해야 합니다. rows `[A0,A1,B0]`가 `[B0,A1,A0]`가 되면 cache gather는 `[2,1,0]`이어야 하며 logits만 바꾸면 B가 A의 K/V를 읽습니다. cancellation 뒤 stale slot과 left padding도 넣어 cache decode logits를 full recompute와 tolerance 내 비교합니다. framework의 cache_position semantics는 해당 버전 문서와 실제 tensor dump로 확정합니다.
## 득점 포인트

- cache를 request·position 종속 상태로 설명하고 global singleton 위험을 제시한다.
- batch/beam reorder에서 logits와 K/V cache의 동일 permutation을 설명한다.
- full recompute 비교, request cancellation, position assertion을 포함한 검증을 제안한다.

## 감점 포인트

- cache가 모델 weight와 같아 모든 요청이 공유해도 된다고 말한다.
- position ID를 바꿔도 K/V 내용에는 영향이 없다고 한다.
- beam row만 바꾸고 cache reorder를 생략한다.

## 더 파고들 거리

- 왼쪽 padding batch에서 실제 token position과 attention mask를 어떻게 정렬하겠습니까?
- cache eviction 후 재사용된 slot에서 stale K/V를 검출하는 checksum·generation 방식은 무엇입니까?
- static cache와 dynamic cache에서 current length·address mapping 검증을 어떻게 다르게 하겠습니까?

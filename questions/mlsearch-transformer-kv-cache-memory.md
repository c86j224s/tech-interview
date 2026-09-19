---
id: mlsearch-transformer-kv-cache-memory
title: KV cache가 token당 계산을 줄이는 대신 어떤 메모리 상한을 만들나요?
difficulty: 중하
category: 머신러닝
tags:
  - Transformer
  - KV cache
  - inference
related:
  - agent-context-engineering
  - weighted-throughput-workload-mix
---
# KV cache가 token당 계산을 줄이는 대신 어떤 메모리 상한을 만들나요?

## 구두 답변

KV cache는 autoregressive decoding에서 이미 계산한 과거 key/value projection을 저장해 다음 token마다 다시 만들지 않게 합니다. 대신 cache bytes가 대략 `2(K,V)×layers×batch×kv_heads×sequence×head_dim×dtype bytes`에 비례하므로 context 길이, 동시 batch, layer 수와 dtype이 memory 상한을 만듭니다. weight memory를 대체하는 것이 아니며 attention이 과거 K/V를 읽는 비용까지 사라지는 것도 아닙니다.

예를 들어 32 layers, 32 KV heads, head_dim 128, context 4096, batch 8, bf16 2 bytes라면 설명용 계산은 `2×32×8×32×4096×128×2 = 17,179,869,184 bytes`, 약 16GiB입니다. batch 1이면 약 2GiB이고, context 8192면 다시 두 배입니다. 실제 구현은 GQA/MQA의 kv_heads, layout, allocator 여유, quantization과 다른 activation을 포함하므로 이 값은 cache 근사치이지 전체 GPU 요구량이 아닙니다.

admission control에서는 요청별 예상 cache bytes와 동시성을 곱해 상한을 계산하고, cache 부족 시 거절·대기·eviction 정책을 명시합니다. p99가 올라가면 단순히 context를 늘리지 않고 batch, sequence, dtype, paged allocation과 token throughput을 함께 측정합니다. cache는 projection 재계산을 줄여도 매 decode step query와 과거 key의 attention scan은 남는다는 점을 강조하겠습니다.


per-layer 상태부터 계산합니다. 각 layer의 K와 V가 `[batch,kv_heads,sequence,head_dim]`이고 K/V 두 tensor이므로 2가 붙습니다. batch 8에서 약 16GiB인 예는 batch 1에서 약 2GiB로 줄지만, weights는 그대로입니다. GQA로 kv_heads를 32에서 8로 줄이면 cache 항은 4분의 1 방향으로 줄어도 query projection과 과거 K scan이 같은 비율로 줄지는 않습니다. cache가 부족할 때 대기·거절·eviction 중 어느 정책인지, 그때 p99와 token throughput이 어떻게 변하는지를 admission trace에서 확인합니다.
## 득점 포인트

- past K/V reuse와 남아 있는 QK attention 비용을 구분한다.
- layer·batch·KV head·sequence·head_dim·dtype가 들어간 bytes 계산을 제시한다.
- cache memory와 weights/activation, admission·동시성 상한을 분리한다.

## 감점 포인트

- KV cache가 token 생성 계산을 모두 O(1)로 만든다고 말한다.
- context가 두 배여도 cache memory가 같다고 한다.
- cache bytes 계산을 전체 모델 memory나 모든 framework의 정확한 layout으로 단정한다.

## 더 파고들 거리

- GQA/MQA에서 query heads와 kv_heads가 cache memory를 어떻게 바꾸는지 계산해 보세요.
- batch 8 요청 중 하나가 종료될 때 cache slot과 fragmentation을 어떻게 회수하겠습니까?
- cache가 부족한 요청을 대기시킬지 거절할지 p99·throughput 기준을 어떻게 정하겠습니까?

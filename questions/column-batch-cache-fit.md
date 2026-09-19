---
id: column-batch-cache-fit
title: 벡터화 실행의 batch 크기를 키우면 어떤 cache·메모리 이득과 지연 비용이 생길 수 있나요?
difficulty: 중하
category: 성능
tags:
  - vectorized-execution
  - batch
  - cache
  - memory
related:
  - performance-cache-locality-layout
---
# 벡터화 실행의 batch 크기를 키우면 어떤 cache·메모리 이득과 지연 비용이 생길 수 있나요?

## 구두 답변

batch를 키우면 function call, iterator 경계, branch 판단을 여러 행에 나눌 수 있고 연속된 vector를 SIMD primitive가 처리하기 쉬워질 수 있습니다. 그러나 batch가 보유하는 column values, validity bitmap, selection, dictionary IDs, operator state가 커져 cache working set과 memory bandwidth 압박이 늘어납니다. interactive query에서는 batch 전체를 채운 뒤 첫 row를 내보내므로 time-to-first-result가 늦어질 수 있고, 전체 scan에서는 amortization 이득이 더 클 수 있습니다.

네 개의 사용 열이 행당 8바이트라는 단순 모델에서 1K의 원시 working set은 `1,000×8×4=32,000` bytes, 64K는 `64,000×8×4=2,048,000` bytes입니다. 이 값은 validity와 selection, 압축 buffer, aggregate state를 제외했으므로 특정 L1/L2/LLC에 맞는다고 말하지 않습니다. 8K는 같은 식으로 256,000 bytes이며, 실제 fit은 cache hierarchy와 reader의 buffer lifetime을 trace해야 합니다.

비교 실험은 1K·8K·64K를 같은 row group과 선택률로 실행하고 결과 일치, rows/s, first-result, peak memory, cache miss, memory bandwidth, p95/p99를 수집합니다. throughput이 64K에서 좋아져도 interactive p99가 나빠지면 8K를 선택할 수 있습니다. 선택률 1%에서는 selection이 작아 late materialization 이득이 생길 수 있지만, 99%에서는 mask와 dense vector가 더 간단할 수 있습니다. UDF와 branch-heavy operator는 batch가 커져도 SIMD 이득이 없으므로 단계별로 분해합니다.

## 득점 포인트

- 호출·분기 amortization과 working-set/cache/첫 결과 지연을 함께 설명합니다.
- 1K 32,000 bytes, 8K 256,000 bytes, 64K 2,048,000 bytes의 가정과 제외 항목을 밝힙니다.
- throughput-first와 first-result-first의 선택 기준을 구분합니다.

## 감점 포인트

- 큰 batch가 모든 query와 cache hierarchy에서 최적이라고 단정합니다.
- selection, validity, operator buffer를 메모리 예산에서 제외합니다.
- throughput만 보고 interactive p99와 first-result를 무시합니다.

## 더 파고들 거리

- batch를 키워도 cache miss가 줄지 않고 memory bandwidth가 포화될 때 어느 operator부터 분해할까요?
- 같은 batch 크기에서 선택률과 UDF 유무가 실행 비용을 바꾸는 이유는 무엇인가요?

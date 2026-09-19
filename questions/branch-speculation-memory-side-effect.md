---
id: branch-speculation-memory-side-effect
title: >-
  분기 조건이 거짓일 때도 뒤의 메모리 접근이 내부적으로 실행될 수 있습니다. architectural 결과와 관찰 가능한
  microarchitectural 흔적을 어떻게 나누나요?
difficulty: 중하
category: 보안
tags:
  - 추측 실행
  - 캐시
  - side channel
  - 분기
related:
  - cpu-cache-false-sharing
---
# 분기 조건이 거짓일 때도 뒤의 메모리 접근이 내부적으로 실행될 수 있습니다. architectural 결과와 관찰 가능한 microarchitectural 흔적을 어떻게 나누나요?

## 구두 답변

architectural 결과는 프로그램이 읽을 수 있는 레지스터·메모리·예외이고, microarchitectural 흔적은 실행을 돕는 cache line, TLB, predictor 상태입니다. 범위 검사 분기를 통과한다고 예측해 뒤의 load가 실행되어도, 실제 조건이 false로 resolve되면 load 값은 register에 커밋되지 않아야 합니다. 그러나 그 load가 요청한 cache line이 이미 warm해졌다면 rollback이 그 흔적까지 지운다고 보장할 수 없습니다.

교육용 trace를 보겠습니다. 먼저 `if (i < n)`에서 i가 n 이상인데 taken을 예측하고, 뒤에서 i에 의존하는 주소를 계산해 line X를 읽습니다. resolve 시점에 false가 되면 load의 ROB 결과와 architectural 반환값은 squash됩니다. 이후 다른 코드가 X를 읽었을 때 hit처럼 짧은 시간이 관찰되고 Y를 읽을 때 더 긴 시간이 관찰된다면, 값이 아니라 접근 상태가 정보 채널 후보가 됩니다. 이것은 원리 trace이며 특정 CPU에서 누출이 성공했다는 실험 결과가 아닙니다.

누출이 실제 side channel이 되려면 관찰자가 공유 cache나 다른 측정 자원에 접근하고, timing 차이가 noise보다 크며, 권한·스케줄링·완화책 조건이 맞아야 합니다. TLB나 predictor도 상태를 가질 수 있지만 모든 흔적이 같은 방식으로 측정되거나 지속된다고 일반화하면 안 됩니다. 따라서 correctness는 “잘못된 값이 architectural state에 남지 않음”으로 검증하고, confidentiality는 “어떤 공유 상태가 바뀌고 누가 얼마나 정확히 관찰하는가”로 별도 평가합니다. dependency나 대상 ISA barrier를 선택할 때는 공격 모델과 보호 범위를 먼저 고정하고 IPC와 load latency 비용도 함께 측정합니다.

## 득점 포인트

- 범위 검사, 예측 load, squash, 이후 probe의 관찰 채널을 architectural 값과 나란히 놓습니다.
- cache timing 차이만으로 특정 환경의 누출 성공을 확정합니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- 공유 cache가 없는 공격 모델에서 같은 흔적 주장이 유지되는지 검토해 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.

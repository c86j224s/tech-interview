---
id: branch-predictor-aliasing
title: >-
  서로 다른 분기가 같은 predictor entry를 사용해 예측 정확도가 흔들립니다. predictor aliasing은 왜 생기며 어떤
  입력으로 드러내나요?
difficulty: 중하
category: 운영체제
tags:
  - 분기 예측
  - predictor
  - aliasing
  - 정확도
related: []
---
# 서로 다른 분기가 같은 predictor entry를 사용해 예측 정확도가 흔들립니다. predictor aliasing은 왜 생기며 어떤 입력으로 드러내나요?

## 구두 답변

predictor aliasing은 제한된 table entry 또는 history 표현을 여러 branch가 공유하면서 한 branch의 update가 다른 branch의 다음 예측을 바꾸는 현상입니다. branch별 상태를 무한히 저장할 수 없으므로 주소 일부와 history로 index를 만들며, 서로 다른 branch가 같은 index를 만들면 interference가 생깁니다. 단순 modulo 식은 재현 가능한 교육 모델이지 모든 CPU의 구현이라고 말할 수 없습니다.

예를 들어 4-entry 2-bit saturating counter table에서 `index=PC mod 4`로 A와 B가 slot 0을 공유한다고 하겠습니다. counter 상태를 1(weak not-taken)으로 시작하고 A의 실제 결과는 taken, B의 실제 결과는 not-taken이라고 둡니다. A만 반복하면 counter는 1→2→3으로 올라가 이후 taken을 잘 예측합니다. 반면 A→B→A 순서라면 A가 2로 올린 직후 B가 1 방향으로 낮추고, 다음 A는 같은 입력인데도 약한 상태에서 시작합니다. 반복 횟수, 초기 counter, branch 결과열을 고정해야 이 간섭을 재현할 수 있습니다.

실제 predictor가 global history를 사용하면 직전 다른 branch의 결과가 index와 counter 선택에 영향을 주고, local history라면 branch별 최근 패턴 저장 여부가 달라집니다. 따라서 실험 입력에는 branch PC 쌍, index/hash 규칙, history 길이, context 전환, warm-up 구간을 기록합니다. 평균 miss rate만 보면 A가 손해를 봤는지 B가 손해를 봤는지 알 수 없습니다. table을 키우거나 index hash를 바꾸면 충돌은 줄 수 있지만 면적·전력·접근 latency와 warm-up 비용을 지불할 수 있습니다. 이 답변의 counter trace는 설명용 계산이며 특정 마이크로아키텍처의 보장이 아닙니다.

## 득점 포인트

- A/B가 같은 2-bit counter를 갱신하는 초기 상태와 결과열을 표로 재현합니다.
- 단순 PC modulo를 실제 CPU predictor의 보편 구조로 단정합니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- local/global history와 index hash를 하나씩 바꿔 branch별 miss를 비교해 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.

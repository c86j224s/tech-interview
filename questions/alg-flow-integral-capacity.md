---
id: alg-flow-integral-capacity
title: 모든 capacity가 정수일 때 Ford-Fulkerson의 flow가 정수로 남는 조건은 무엇인가요?
difficulty: 하
category: 알고리즘
tags:
  - max flow
  - integral flow
  - capacity
related:
  - graph-representation
---
# 모든 capacity가 정수일 때 Ford-Fulkerson의 flow가 정수로 남는 조건은 무엇인가요?

## 구두 답변

초기 flow가 0이고 모든 capacity가 정수이며, 매번 양의 residual augmenting path를 따라 그 경로의 bottleneck만큼 증가시키면 flow는 계속 정수입니다. 첫 상태의 forward residual은 정수이고 reverse residual은 0입니다. 이후에도 정수에서 정수인 `capacity-flow`와 `flow`를 계산하므로 모든 잔여량이 정수이고, 경로의 최솟값인 bottleneck도 정수입니다.

예를 들어 한 경로의 residual이 `4,2,7`이면 증가량은 2입니다. 세 forward residual은 각각 `2,0,5`로 바뀌고, 대응 reverse residual은 기존 값에 2가 더해집니다. 다음 경로가 일부 reverse edge를 사용해도 더하는 양은 여전히 정수이므로 원래 edge flow의 증가·감소 결과가 정수로 남습니다.

이 주장은 capacity가 정수이고 초기 flow와 갱신 규칙도 정수라는 조건부 성질입니다. 실수 capacity를 넣고 binary floating comparison으로 0을 판정하면서 정수 결과나 동일한 종료를 기대할 수는 없습니다. 또한 residual edge를 잘못 갱신하면 적분성 이전에 flow 보존과 capacity 제한이 깨집니다. 정수라는 타입만으로 알고리즘의 최적성이 생기는 것이 아니라, 증가 경로 갱신의 불변식이 함께 필요합니다.

## 득점 포인트

- 초기 0, 정수 residual, 정수 bottleneck이라는 귀납 구조를 설명한다.
- `4,2,7`에서 2를 더하는 중간 상태를 계산한다.
- 실수 capacity와 floating 비교 문제를 정수성 주장과 분리한다.

## 감점 포인트

- capacity가 정수이기만 하면 어떤 임의의 flow 갱신도 정수라고 말한다.
- reverse residual을 갱신하지 않고도 적분성이 보존된다고 한다.
- 정수 결과를 max-flow 최적성의 충분조건으로 오해한다.

## 더 파고들 거리

- capacity가 유리수일 때 스케일링으로 정수 모델을 만들 수 있는 조건과 비용을 설명해 보세요.
- 실수 capacity를 반드시 써야 한다면 잔여량 tolerance와 종료 조건을 어떻게 별도 계약으로 둘까요?

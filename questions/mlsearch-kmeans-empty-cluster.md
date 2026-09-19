---
id: mlsearch-kmeans-empty-cluster
title: K-means 반복 중 cluster가 비면 어떻게 복구하고 무엇을 기록하나요?
difficulty: 중하
category: 머신러닝
tags:
  - K-means
  - empty cluster
  - seed
related:
  - ml-overfitting-generalization
  - ml-train-validation-test
---
# K-means 반복 중 cluster가 비면 어떻게 복구하고 무엇을 기록하나요?

## 구두 답변

빈 cluster가 생기면 평균의 분모가 0이므로 0 vector를 넣고 계속하거나 K를 조용히 줄이면 안 됩니다. 먼저 애플리케이션 정책을 정합니다. 여기서는 largest-error relocation을 예로 들겠습니다. K=4, 현재 label counts가 `[3,2,0,1]`이고 각 표본의 자기 중심 제곱오차가 `[0.1,0.2,4.0,0.3,0.1,0.2]`라면 빈 label 2를 채울 donor는 오차 4.0인 표본입니다. 그 표본을 새 중심으로 떼어 counts를 `[2,2,1,1]`로 만든 뒤 전체 표본을 다시 할당하고 네 중심을 재계산합니다.

중요한 점은 donor를 옮긴 순간 종료하지 않고 assignment와 inertia를 다시 계산하는 것입니다. donor가 원래 군집 평균을 바꾸므로 원래 군집 중심도 달라지고, 다른 경계 표본의 label도 바뀔 수 있습니다. 대안으로 현재 최소 D² 가중치에 따라 아직 선택되지 않은 점을 재초기화할 수도 있지만, 어느 정책이 library 기본인지 가정하지 않고 정책 버전으로 기록합니다. 재초기화 후에도 같은 label이 반복해 비면 K가 데이터 구조에 비해 크거나 중복·결측 처리가 문제일 수 있습니다.

로그에는 seed, iteration, empty label, donor ID 또는 재초기화 후보, 복구 정책 버전, 이전·이후 counts, inertia, 복구 횟수를 남깁니다. 복구 전후 inertia가 낮아졌다고 해서 군집 의미가 확보된 것은 아니며 여러 seed와 cardinality를 함께 봅니다. 복구가 너무 자주 발생하면 K를 줄이는 실험과 입력 품질 점검을 분리해 실행하고, 빈 군집을 숨긴 성공 로그로 만들지 않습니다.

복구 정책을 선택할 때는 inertia가 낮아졌는지뿐 아니라 donor 한 점이 새 군집을 만들어 의미 있는 cardinality를 유지하는지 확인합니다. 예를 들어 복구 직후 counts가 `[2,2,1,1]`에서 다음 반복에 `[5,0,0,1]`로 다시 무너지면 해당 K와 초기화가 부적절하다는 신호입니다. 이 경우 재시도 횟수 상한과 중단 사유를 결과에 남깁니다.

## 득점 포인트

- 빈 label의 평균이 정의되지 않는다는 이유와 0 vector 금지를 설명합니다.
- `[3,2,0,1]`에서 largest-error donor를 고르고 재할당·재계산하는 상태를 보여 줍니다.
- 정책 버전, seed, counts, inertia, 복구 횟수를 기록하고 정책이 애플리케이션 계약임을 밝힙니다.

## 감점 포인트

- empty를 무시하거나 0 vector로 두고 정상 수렴 처리합니다.
- donor 이동 후 중심과 label을 다시 계산하지 않습니다.
- 특정 library의 기본 복구라고 근거 없이 단정합니다.

## 더 파고들 거리

- 재초기화와 largest-error relocation을 같은 fixture와 seed에서 비교할 비용·품질 지표를 정해 보세요.
- empty 반복률을 K 후보와 데이터 중복률의 모니터링 지표로 설계해 보세요.

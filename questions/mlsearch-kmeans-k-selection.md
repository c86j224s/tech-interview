---
id: mlsearch-kmeans-k-selection
title: inertia는 K가 커질수록 내려가는데 elbow와 silhouette를 어떻게 해석하나요?
difficulty: 중하
category: 머신러닝
tags:
  - K-means
  - inertia
  - silhouette
related:
  - ml-loss-objective
  - ml-classification-metrics
---
# inertia는 K가 커질수록 내려가는데 elbow와 silhouette를 어떻게 해석하나요?

## 구두 답변

K가 커질수록 inertia가 내려가는 것은 더 많은 중심으로 training 표본을 설명할 수 있기 때문이라 그 자체로 최적 K를 알려 주지 않습니다. 예를 들어 K=2,3,4,10에서 inertia가 `[100,55,43,31]`이면 감소폭은 45,12,12, 즉 K=2에서 3으로 갈 때 이득이 크고 이후 둔화됩니다. 이것이 elbow 후보를 만드는 방식입니다. 다만 뚜렷한 꺾임이 없으면 억지로 하나를 고르지 않고 운영 비용과 해석 가능성을 기준에 넣습니다.

silhouette는 각 점의 자기 군집 평균 거리 `a`와 가장 가까운 다른 군집까지의 평균 거리 `b`를 사용해 `(b-a)/max(a,b)`를 계산합니다. 어떤 점에서 `a=2`, `b=5`면 값은 `3/5=0.6`으로 자기 군집에는 가깝고 다른 군집과 분리됐다는 뜻입니다. 반대로 `a=4`, `b=3`이면 `-1/4=-0.25`라 경계 또는 잘못된 할당 후보입니다. K별 평균만 보지 말고 군집별 분포, 작은 군집, seed별 spread를 확인합니다.

실무에서는 elbow 후보와 silhouette 후보를 좁힌 뒤 seed를 바꿔 결과가 유지되는지, 군집 크기가 너무 작지 않은지, 실제 제품이 구분해야 하는 행동과 맞는지를 봅니다. silhouette 최고 K가 업무 정답이라는 보장은 없습니다. 긴 타원이나 서로 다른 밀도에서는 낮은 inertia와 높은 silhouette가 사람에게 유용한 경계와 어긋날 수 있고, K 선택 자료에 사후 label을 반복 사용하면 평가가 낙관적으로 됩니다.

seed가 5개일 때 K=3의 silhouette가 0.41~0.45로 좁고 K=4가 0.30~0.58로 넓다면 평균만 보고 K=4를 고르지 않습니다. 안정성 폭이 넓은 이유가 작은 군집인지 경계 표본인지 확인하고, 군집을 downstream 정책에 연결할 경우 각 군집의 최소 cardinality와 재학습 시 label 대응을 조건으로 둡니다.

## 득점 포인트

- K별 inertia 감소폭을 실제 표로 계산하고 단조 감소와 elbow 휴리스틱을 구분합니다.
- `a=2,b=5`에서 silhouette 0.6처럼 내부 계산을 보여 줍니다.
- seed spread, 군집 크기, 구조 가정과 업무 목적을 함께 사용합니다.

## 감점 포인트

- K가 큰 inertia가 항상 더 좋은 모델이라고 말합니다.
- silhouette 평균 하나를 업무 정답이나 전역 보장으로 해석합니다.
- 긴 타원·다른 밀도 같은 K-means 가정을 확인하지 않습니다.

## 더 파고들 거리

- elbow와 silhouette가 서로 다른 K를 가리킬 때 비용 함수와 운영 해석 중 우선순위를 합의해 보세요.
- 표본별 silhouette 하위 tail을 조사해 평균에 가려진 경계 문제를 찾아보세요.

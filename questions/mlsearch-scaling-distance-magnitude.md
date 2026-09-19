---
id: mlsearch-scaling-distance-magnitude
title: K-means와 선형 분류기에서 feature 단위를 100배 바꾸면 결과가 왜 달라질 수 있나요?
difficulty: 중하
category: 머신러닝
tags:
  - scaling
  - K-means
  - gradient
related:
  - ml-gradient-learning-rate
  - ml-overfitting-generalization
---
# K-means와 선형 분류기에서 feature 단위를 100배 바꾸면 결과가 왜 달라질 수 있나요?

## 구두 답변

K-means는 centroid와의 유클리드 거리 제곱을 사용하므로 한 축의 단위를 100배로 바꾸면 그 축 차이의 제곱 기여가 10,000배가 됩니다. 두 점의 차이가 `(1,10)`이면 제곱거리 기여는 1과 100이지만, 첫 축을 100배로 표현하면 `(100,10)`이 되어 10,000과 100이 됩니다. 같은 의미의 단위 변경인데도 centroid 할당이 첫 축 중심으로 바뀔 수 있는 이유입니다. 표준화는 평균·표준편차 단위로 좌표를 맞추지만, 중요도를 자동으로 정하는 것은 아닙니다.

선형 분류기의 score `wᵀx+b`만 보면 feature를 100배 키우고 해당 weight를 1/100로 조정해 같은 함수를 표현할 수 있습니다. 하지만 L1/L2 정규화는 weight 크기에 비용을 주므로 좌표 변경이 penalty를 바꾸고, 경사하강법은 feature scale에 따라 gradient와 Hessian conditioning이 달라집니다. 따라서 같은 learning rate가 한 축에서는 너무 크고 다른 축에서는 너무 작아 수렴 속도나 수치 안정성이 달라질 수 있습니다.

비교할 때는 같은 seed와 처리 샘플·step 예산을 고정해 raw, train-only standardization 후보를 평가합니다. K-means는 inertia와 cluster별 안정성, 분류기는 validation metric과 gradient norm·parameter delta를 기록합니다. 결정 트리처럼 ordering split을 쓰는 모델은 조건부로 영향을 덜 받을 수 있으므로 모든 모델이 반드시 scaling을 필요로 한다고 말하지 않습니다. 또한 scaling은 미래 정보 누출이나 잘못된 label을 고치지 않습니다.


작은 거리 비교로 효과를 구체화할 수 있습니다. centroid 후보까지의 차이가 A에서는 `(1,10)`, B에서는 `(5,1)`이라면 원래 제곱거리는 A가 `101`, B가 `26`이라 B가 가깝습니다. 첫 좌표를 100배 하면 A는 `10100`, B는 `250001`이 되어 여전히 A가 가깝지만, 다른 centroid 배치에서는 순위가 쉽게 뒤집힙니다. 선형 모델에서도 `x₁`을 100배 하고 weight를 1/100로 바꾸면 무정규화 함수는 같지만, L2 penalty는 원래 weight가 아니라 새 weight에 부과됩니다. 즉 단위 변경은 데이터 의미를 바꾸지 않아도 알고리즘의 거리·penalty·step geometry를 바꿉니다.
## 득점 포인트

- 유클리드 제곱거리에서 100배 단위가 한 축 기여를 10,000배로 만드는 숫자를 계산합니다.
- 선형 함수 표현 자체와 L1/L2 penalty·gradient conditioning의 scale 민감성을 서로 나눠 설명합니다.
- K-means inertia와 선형 모델의 validation·gradient 상태를 동일 seed·샘플·step 예산으로 비교합니다.

## 감점 포인트

- 모든 모델에서 단위 변경이 동일하게 결과를 바꾼다고 말합니다.
- scaling이 중요도 정책이나 누출·label 오류까지 자동으로 해결한다고 주장합니다.

## 더 파고들 거리

- 정규화된 선형 모델에서 단위 변경과 penalty 계수 보정이 같은 함수를 보존하는지 비교해 보세요.
- K-means의 seed와 k가 scaling 효과와 어떻게 얽히는지 실험표를 만들어 보세요.

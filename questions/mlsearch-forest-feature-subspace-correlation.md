---
id: mlsearch-forest-feature-subspace-correlation
title: max_features를 줄이면 나무 수를 늘리는 것과 다른 효과가 생기는 이유는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - random forest
  - feature subsampling
  - correlation
related:
  - bias-variance-training-curves
  - ml-overfitting-generalization
---
# max_features를 줄이면 나무 수를 늘리는 것과 다른 효과가 생기는 이유는 무엇인가요?

## 구두 답변
나무 수 M을 늘리면 같은 tree 분포의 평균에서 독립적인 분산 성분을 더 줄이지만, `max_features`를 줄이면 각 node가 보는 후보 자체를 바꿔 tree 간 상관과 단일 tree bias를 함께 바꿉니다. 동일 variance `σ²`, 상관 `ρ`라면 평균 분산은 `σ²[ρ+(1-ρ)/M]`입니다. M을 키워도 `ρσ²`는 남습니다. 한 feature가 모든 split을 지배하는 데이터에서는 feature subset을 줄여 경로를 다양하게 만들 수 있지만, 그 feature가 유일한 신호라면 이를 못 본 tree의 bias가 커집니다. 반대로 대체 신호가 여러 개면 작은 subset이 유리할 수 있습니다. 후보별 prediction pairwise correlation, validation 성능, calibration, fit·predict 비용을 같은 seed 집합에서 비교합니다.


두 knob의 차이는 분산식으로만 끝내지 않고 tree 상태에서 확인할 수 있습니다. 강한 x1 하나만 신호인 데이터에서 `max_features=1.0`이면 대부분의 tree가 x1을 첫 split에 사용하고, subset을 줄이면 x1을 못 본 tree가 약한 분할을 택해 pairwise correlation은 낮아져도 각 tree error가 커집니다. x1과 같은 정보를 가진 x2·x3가 있다면 같은 subset에서도 대체 분할이 가능해 bias 증가가 작을 수 있습니다. 따라서 후보마다 forest 평균뿐 아니라 개별 tree validation error, correlation 행렬, seed 간 분산을 함께 기록하고, tree 수를 늘린 후보와 subset을 줄인 후보를 같은 계산 예산에서 비교합니다.

평균 예측만 좋아지고 개별 tree가 급격히 약해지는 후보는 새 seed나 분포 변화에서 불안정할 수 있습니다. 그러므로 subset 후보를 선택할 때 correlation 감소량을 목표로 고정하지 않고 성능, calibration, 메모리 예산을 함께 만족하는지 확인합니다.
## 득점 포인트
- M 증가가 `(1-ρ)/M` 항을, 부분공간 조절이 ρ와 tree bias를 바꾼다는 식의 의미를 설명합니다.
- 유일한 강한 feature와 상관된 대체 feature의 결과를 구분합니다.
- 관행적 `sqrt(n_features)`를 보편 최적값으로 말하지 않고 측정으로 결정합니다.

## 감점 포인트
- max_features를 낮추면 항상 정확도가 좋아진다고 단정합니다.
- tree 수를 늘리면 높은 covariance가 자동으로 사라진다고 말합니다.
- train score 하나로 bias·variance trade-off를 판단합니다.

## 더 파고들 거리
- 두 feature가 같은 신호를 복제하는 경우와 하나만 신호인 경우의 subset별 상관을 계산해 보세요.
- tree 다양성이 forest probability calibration 곡선을 어떻게 바꿀 수 있는지 검증 계획을 세워 보세요.

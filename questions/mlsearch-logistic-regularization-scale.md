---
id: mlsearch-logistic-regularization-scale
title: L2 정규화를 키웠는데 계수와 확률이 달라졌습니다. 표준화와 penalty의 상호작용을 어떻게 판단하나요?
difficulty: 중하
category: 머신러닝
tags:
  - L2
  - regularization
  - feature scale
related:
  - ml-gradient-learning-rate
  - ml-loss-objective
---
# L2 정규화를 키웠는데 계수와 확률이 달라졌습니다. 표준화와 penalty의 상호작용을 어떻게 판단하나요?

## 구두 답변
`mean(BCE)+λ||w||²`에서 L2는 계수 단위 자체에 비용을 부과하므로 feature scale이 다르면 같은 λ도 다른 규제가 됩니다. `x₁=.5,w₁=2`, `x₂=5000,w₂=.0002`는 각각 logit에 1을 기여하지만 계수 제곱 합은 `4.00000004`입니다. 원자료에서는 첫 좌표가 penalty 대부분을 부담합니다. train 평균·표준편차로 두 열을 표준화하면 계수 단위가 비교 가능해지지만, scaler 통계를 전체 자료에서 fit하면 test 정보가 새어 나갑니다. 같은 split과 seed에서 scaler, λ 또는 API의 C를 분리해 바꾸고 validation BCE·logit·calibration·운영 지표를 비교합니다. `C`는 inverse penalty라 C가 커질수록 보통 규제가 약해지는 방향임도 objective와 대조합니다.


확률이 달라졌다는 현상은 계수만 보고 판단하지 않습니다. 표준화 전후에 같은 행의 `z`와 sigmoid, validation BCE를 나란히 기록하면 scale 때문에 계수가 달라진 것인지 실제 ranking이 바뀐 것인지 분리할 수 있습니다. 예를 들어 큰 단위 feature의 계수가 작아져도 `w₂x₂` 기여가 유지되면 예측은 비슷할 수 있지만, 큰 λ에서는 두 기여가 함께 shrink되어 calibration과 threshold 통과율이 달라질 수 있습니다. 실험표에는 raw coefficient, scaled-space coefficient, inverse-transformed contribution을 각각 남기고 scaler fit 범위와 결측·이상치 처리를 고정합니다.

표준화가 계수 비교를 편하게 만들어도 이상치가 표준편차를 키우면 정상 행의 변동이 작아질 수 있으므로 robust scaling이나 clipping을 별도 후보로 둡니다. 이 선택은 scaler fit과 penalty 선택을 같은 validation 절차에서 비교해야 하며, 운영 입력의 단위 변환도 고정합니다.
## 득점 포인트
- 동일한 예측 기여에 필요한 계수 크기와 penalty 수치를 직접 계산합니다.
- train-only scaling과 validation·test transform의 경계를 명확히 합니다.
- λ 표기와 C 표기의 방향을 이름이 아니라 실제 objective 식으로 확인합니다.

## 감점 포인트
- 계수 절댓값이 작으면 그 feature가 덜 중요하다고 바로 결론 내립니다.
- 전체 데이터 평균·분산으로 표준화한 뒤 독립 test라고 주장합니다.
- 정규화 변경과 threshold 변경을 한 실험에 섞어 확률 변화 원인을 잃습니다.

## 더 파고들 거리
- 이상치가 표준편차를 키울 때 standard scaling과 robust scaling을 같은 분할에서 비교해 보세요.
- 상관된 열에서 L2가 계수를 나누어 갖는 현상과 L1의 선택성 차이를 설명해 보세요.

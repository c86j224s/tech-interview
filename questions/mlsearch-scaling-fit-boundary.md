---
id: mlsearch-scaling-fit-boundary
title: 시계열 미래 평균이 현재 예측에 섞이지 않도록 scaler를 어떤 순서로 fit하나요?
difficulty: 중하
category: 머신러닝
tags:
  - standardization
  - leakage
  - time split
related:
  - ml-train-validation-test
  - rolling-validation-future-holdout
---
# 시계열 미래 평균이 현재 예측에 섞이지 않도록 scaler를 어떤 순서로 fit하나요?

## 구두 답변

먼저 예측 시점에 실제로 알 수 있는 과거 window를 정하고, 그 window의 행으로만 scaler를 `fit`합니다. 그 다음 같은 scaler로 train window를 transform해 모델을 fit하고, 바로 다음 validation 또는 미래 interval에는 통계 재계산 없이 `transform`만 적용합니다. 예를 들어 1~6월로 학습하고 7월을 검증한다면 `scaler.fit(X_1월~6월)`, `transform(X_1월~6월)`, `transform(X_7월)`, `model.fit(훈련 변환값)` 순서입니다. 1~7월 평균으로 7월을 먼저 변환하면 미래 분포가 섞입니다.

rolling validation에서는 각 fold가 하나의 모델 세대입니다. 1~6월 통계로 7월을 평가한 뒤, 다음 fold에서 1~7월로 새 scaler를 fit해 8월을 평가할 수 있습니다. 이때 scaler의 fit cutoff, 행 ID, `mean_`·`scale_` 또는 robust 통계, 라벨 가용 시각을 artifact에 기록하겠습니다. 전체 기간의 통계로 만든 scaler를 모든 fold에 재사용하면 label을 읽지 않아도 validation/test 분포가 표현 공간을 바꾼 정보 누출이 됩니다.

누출 검사는 scaler fit 행 집합과 평가 행 집합의 교집합을 0으로 만들고, feature 생성 시각이 예측 시점 뒤인지 확인하는 방식으로 합니다. 같은 사용자나 사건이 split을 넘는 문제는 scaler 순서만으로 해결되지 않으므로 분할 단위도 별도로 검사합니다. 운영 중 새 과거 데이터로 다시 fit할지는 모델 세대 교체 정책으로 결정하고, 현재 모델에 미래 평균을 몰래 섞는 방식으로 적응하지 않습니다.


경계를 행 단위로 고정하면 구현 실수도 찾기 쉽습니다. 1~6월의 두 feature가 각각 평균 `10`, 표준편차 `2`라면 7월 값 `14`는 `z=2`입니다. 7월을 포함해 평균이 `12`, 표준편차가 `3`으로 바뀌면 같은 값은 `z≈.667`이 되어 모델이 받는 좌표 자체가 달라집니다. 이 값이 더 자연스러워 보이는지는 중요하지 않고, 당시 예측 시점에 7월 전체 통계를 알 수 있었는지가 계약의 기준입니다. 각 fold에 `fit_cutoff`, fit row ID, 통계 hash를 남기면 transform-only 경계를 자동으로 검사할 수 있습니다.
## 득점 포인트

- rolling train window에서 scaler를 fit하고 다음 interval에는 transform만 적용하는 시간 순서를 제시합니다.
- 1~6월→7월 예를 통해 1~7월 통계가 7월 평가에 섞이는 경계를 설명합니다.
- fit cutoff·행 ID·통계 artifact와 feature·label 가용 시각을 기록해 scaler 외 누출도 검사합니다.

## 감점 포인트

- 전체 기간 평균으로 먼저 fit한 뒤 split해도 label을 안 쓰면 안전하다고 말합니다.
- scaler 재학습만으로 동일 사용자·미래 feature 생성 누출까지 해결됐다고 봅니다.

## 더 파고들 거리

- rolling fold의 scaler generation을 모델 checkpoint와 어떻게 함께 versioning할지 정리해 보세요.
- 라벨 확정 지연과 feature 관찰 시각이 fit cutoff를 어떻게 제한하는지 점검해 보세요.

---
id: mlsearch-scaling-outlier-robust
title: 평균·표준편차가 극단치 하나에 흔들릴 때 RobustScaler의 선택 근거는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - scaling
  - outlier
  - robustness
related:
  - ml-overfitting-generalization
  - ml-classification-metrics
---
# 평균·표준편차가 극단치 하나에 흔들릴 때 RobustScaler의 선택 근거는 무엇인가요?

## 구두 답변

평균과 표준편차는 값의 크기에 민감하므로 극단치 하나가 정상 표본의 좌표를 압축할 수 있습니다. 거래액 999개가 10이고 한 건이 1,000,000이면 평균은 약 1,010까지 올라가 대부분의 10 근처 값이 같은 구간에 몰립니다. RobustScaler는 보통 median과 IQR을 이용해 중심과 scale을 잡으므로 그 한 건의 영향이 상대적으로 작습니다. 이것이 선택의 출발점입니다.

다만 극단치가 오류라는 뜻은 아닙니다. 대형 계약이나 사기 거래처럼 바로 예측해야 할 중요한 사례라면 무조건 제거하거나 clipping하면 신호를 없앨 수 있습니다. 먼저 단위 오류·중복·센서 고장인지 실제 rare event인지 분류하고, validation에서 StandardScaler, RobustScaler, 로그 변환, 원본과 변환 특징을 비교합니다. 평균 metric만 보지 않고 tail slice의 recall, 오차, 검토량을 함께 봅니다.

scaler의 통계는 train fold에서만 fit하고 validation/test에는 transform만 적용합니다. 선택한 변환과 이상치 정책을 test를 본 뒤 바꾸면 그 test는 선택 자료가 됩니다. RobustScaler가 항상 더 높은 성능을 주는 것도 아니며, 데이터가 실제로 가우시안에 가깝고 극단치가 중요한 신호라면 StandardScaler가 더 적절할 수 있습니다. 선택 근거는 outlier의 의미와 독립 평가 결과를 같이 기록하는 것입니다.


수치를 분리해 보면 선택 이유가 더 명확합니다. 999개가 10이고 한 개가 1,000,000이면 평균은 `(9990+1000000)/1000=1009.99`입니다. 정상값 10은 평균에서 약 -1000만큼 떨어져 있지만 대부분 서로의 차이는 0이므로 StandardScaler에서 정상 구간이 좁게 눌립니다. median은 10이고, 정상값이 모두 같다는 이 예에서는 IQR이 0이어서 RobustScaler 역시 그대로 적용할 수 없는 경계가 생깁니다. 따라서 RobustScaler를 자동 정답으로 삼지 말고 IQR 0 처리, 로그 변환, 극단값의 실제 의미를 함께 검증해야 합니다.
## 득점 포인트

- median/IQR이 평균/표준편차보다 한 극단값의 영향이 작은 이유를 거래액 예로 설명합니다.
- 극단값을 오류와 중요한 rare event로 먼저 분류하고 tail slice 성능까지 비교합니다.
- scaler 선택과 이상치 정책을 train fold에서 fit·validation 선택·test 고정 순서로 운영합니다.

## 감점 포인트

- 큰 값은 무조건 제거하거나 RobustScaler가 항상 우월하다고 단정합니다.
- 평균 성능만 보고 중요한 tail의 recall·오차·검토량 변화를 놓칩니다.

## 더 파고들 거리

- 로그 변환·winsorization·원본 병행 feature 중 어떤 선택이 tail 예측 비용에 맞는지 비교해 보세요.
- 새로운 극단값이 운영 중 나타날 때 scaler artifact를 어떻게 교체하고 평가할지 정리해 보세요.

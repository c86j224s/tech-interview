---
id: mlsearch-calibration-holdout-fit
title: isotonic을 훈련 자료에 바로 fit하면 왜 curve가 낙관적일 수 있나요?
difficulty: 중하
category: 머신러닝
tags:
  - isotonic
  - calibration set
  - holdout
related:
  - ml-train-validation-test
  - ml-classification-metrics
---
# isotonic을 훈련 자료에 바로 fit하면 왜 curve가 낙관적일 수 있나요?

## 구두 답변

isotonic은 score가 커질수록 출력이 감소하지 않는 계단형 함수를 자료에 맞추므로, base model이 이미 본 training score와 label을 그대로 주면 그 표본의 우연한 빈도를 계단에 흡수할 수 있습니다. 예를 들어 score 순서가 `[0.1,0.2,0.3,0.4,0.5,0.6]`, label이 `[0,0,1,0,1,1]`이면 단조 제약을 맞추기 위해 가운데 값들이 pooling될 수 있습니다. training에서 얻은 계단 출력으로 같은 여섯 행의 reliability를 평가하면 fit 자료의 패턴에 맞아 좋아 보이지만, 새 score `[0.25,0.35,0.55,0.65]`의 label이 `[0,1,0,1]`일 때 같은 계단의 bin observed rate는 달라질 수 있습니다. 작은 예의 숫자는 isotonic 구현의 tie 규칙까지 고정해야 재현되므로, 핵심은 “같은 자료를 평가에 재사용했다”는 편향입니다.

안전한 흐름은 base train에서 모델을 fit하고 별도의 calibration validation에서 score와 label로 isotonic을 fit한 뒤, 손대지 않은 final test에서 Brier·reliability·AUC를 평가하는 것입니다. 자료가 작으면 out-of-fold score를 모아 각 row가 자기 학습에 쓰이지 않은 score를 갖게 한 뒤 calibrator를 학습할 수 있습니다. test를 보고 계단 수나 보정기 종류를 다시 고르면 test도 선택 자료가 됩니다. isotonic은 유연한 만큼 sample size와 tie 정책을 기록하고, held-out에서 과적합·ranking tie·시간 slice를 함께 확인합니다.

훈련 자료에 fit한 curve가 계단마다 label을 잘 맞추는 것은 calibrator가 일반 법칙을 발견했다는 증거가 아니라 자료 재사용의 결과일 수 있습니다. validation 표본이 시간 순서를 가진다면 무작위 분할 대신 실제 배포 시점을 반영한 시간 holdout을 고려하고, drift가 있는 경우 random split의 낙관성을 별도로 보고합니다. curve 선택과 threshold 선택도 같은 validation에서 일관되게 기록해야 합니다.

## 득점 포인트

- base train·calibration validation·final test의 역할을 구분합니다.
- 정렬된 score와 label 예시에서 training reliability와 새 holdout의 빈도가 달라질 수 있음을 보여 줍니다.
- isotonic의 유연성, 계단 tie, 소자료 과적합을 함께 기록합니다.

## 감점 포인트

- 양성 개수만 말하고 음성 수·score 순서·평가 자료를 생략합니다.
- training curve가 좋아 보이는 것을 일반화 성능으로 부릅니다.
- 최종 test를 보며 calibrator와 threshold를 반복 선택합니다.

## 더 파고들 거리

- out-of-fold calibration에서 fold별 score의 계보와 누수 여부를 어떻게 검증할지 설명해 보세요.
- sigmoid와 isotonic을 동일 held-out set에서 비교할 때 ranking tie와 확률 오차를 함께 기록해 보세요.

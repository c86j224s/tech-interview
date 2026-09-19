---
id: mlsearch-logistic-class-weight-probability
title: 희소 양성에 class weight를 주면 출력값을 그대로 확률로 읽어도 되나요?
difficulty: 중하
category: 머신러닝
tags:
  - class weight
  - calibration
  - threshold
related:
  - class-weight-threshold-interaction
  - ml-classification-metrics
---
# 희소 양성에 class weight를 주면 출력값을 그대로 확률로 읽어도 되나요?

## 구두 답변
그대로 읽으면 안 됩니다. class weight는 양성·음성 표본의 BCE 기여와 상대 비용을 바꾸고, 특히 intercept와 score 분포를 이동시킵니다. 실제 prevalence가 1%인 자료에서 양성 weight를 5배로 주면 모델이 양성 miss를 더 비싸게 보아 같은 .5 경계에서 TP가 늘 수 있지만 FP와 review queue도 커집니다. 따라서 score의 순위와 calibrated probability를 구분합니다. weight만 바꾼 모델을 실제 prevalence validation에서 threshold별 confusion matrix로 평가하고, 별도 calibration 자료 또는 out-of-fold 예측으로 calibrator를 fit한 뒤 threshold를 고정합니다. test에서 calibration과 threshold를 동시에 맞추면 독립 평가가 사라집니다. weight 규모가 penalty와 상대적으로 작동하는 API라면 정규화 항 변화도 함께 기록합니다.


weight가 확률 해석을 바꾸는 이유는 weighted empirical distribution에서 최적 intercept가 달라지기 때문입니다. 같은 feature 조건에서 양성 비용을 높이면 모델은 양성 score를 쉽게 내도록 이동할 수 있으며, 이는 운영 prevalence를 다시 추정한 결과가 아닙니다. calibration 자료의 bin이 예를 들어 평균 예측 .8인데 실제 양성 .3이라면 score .8은 ranking에는 유용해도 “80%” 설명으로 사용할 수 없습니다. calibrator를 적용한 뒤에도 prevalence가 바뀌면 reliability와 threshold를 재점검하되, 그 자료를 최종 test로 재사용하지 않습니다.

따라서 weight를 바꾼 뒤에는 기존 threshold를 재사용하는 대신 운영 비용표를 새로 계산해야 합니다. 단순히 positive prediction 비율이 늘었다는 사실은 recall 개선과 calibration 개선을 구별하지 못하므로, score bin별 실제 양성률과 review rate를 함께 봅니다.
## 득점 포인트
- weight가 학습 objective를 바꾸고 threshold가 행동 단계라는 층위를 분리합니다.
- TP·FP·FN·검토량·prevalence를 포함한 수치 상태로 .8의 확률 해석을 검증합니다.
- calibrator를 학습 자료와 분리하고 test에서는 선택을 반복하지 않습니다.

## 감점 포인트
- positive weight 5가 threshold를 5배 낮추는 것과 같다고 말합니다.
- balanced 또는 weighted training의 vote .7을 운영 prevalence의 70%로 단정합니다.
- accuracy 하나만 보고 희소 양성의 확률 품질과 review 비용을 무시합니다.

## 더 파고들 거리
- prior shift와 cost shift를 구별하고 calibration을 다시 fit해야 하는 조건을 설명해 보세요.
- weight·threshold·calibration을 세 축으로 분리한 실험표와 고정할 자료를 설계해 보세요.

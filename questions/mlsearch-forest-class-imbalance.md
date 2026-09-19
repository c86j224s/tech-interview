---
id: mlsearch-forest-class-imbalance
title: 희소 양성에서 bootstrap tree가 양성을 거의 못 담을 때 sampling과 threshold를 어떻게 분리하나요?
difficulty: 중하
category: 머신러닝
tags:
  - random forest
  - imbalance
  - sampling
related:
  - ml-classification-metrics
  - class-weight-threshold-interaction
---
# 희소 양성에서 bootstrap tree가 양성을 거의 못 담을 때 sampling과 threshold를 어떻게 분리하나요?

## 구두 답변
balanced bootstrap·class weight는 tree가 학습하는 표본 분포와 weighted impurity를 바꾸고, threshold는 완성된 forest score를 행동으로 바꿉니다. 양성 1%인 10,000행에는 약 100 positive가 있지만 node로 내려가면 지역별 positive가 거의 없을 수 있습니다. 따라서 일반·balanced sampling을 같은 split과 seed에서 비교하고 tree별 positive count, inclusion mask, weighted impurity를 기록합니다. 설명용 결과가 일반 모델 `TP=70,FP=80,FN=30`, balanced 모델 `TP=85,FP=240,FN=15`라면 recall은 70%→85%지만 precision은 46.7%→26.2%입니다. review budget 100을 넘을 수 있으므로 threshold만 바꾸는 실험을 별도로 하고, balanced vote .7을 운영 확률 .7로 읽지 않습니다. 실제 prevalence test에서 PR·검토량·calibration을 확인합니다.


이 비교에서 일반 bootstrap이 양성을 전혀 못 담는다는 식의 과장은 피하고, 문제는 전체 표본보다 node 지역에서 발생한다고 설명해야 합니다. 각 tree가 positive를 몇 개 보았는지와 특정 split 이후 자식별 positive count를 기록하면 sampling 변경이 어디에서 작동했는지 알 수 있습니다. balanced sampling으로 recall이 올라가도 FP가 240이면 100건 review budget을 초과합니다. threshold를 올려 queue를 줄일 수 있지만 FN과 recall이 다시 바뀌므로 운영 비용표에서 선택합니다. calibration을 별도 자료에서 fit하고 실제 1% prevalence에서 평가해야 balanced 학습 분포와 운영 확률의 차이를 확인할 수 있습니다.
## 득점 포인트
- sampling·weight와 threshold를 학습 분포·행동 정책의 서로 다른 층으로 설명합니다.
- 양성 수와 TP·FP·FN에서 recall과 precision을 직접 계산합니다.
- 운영 prevalence와 review budget을 유지한 calibration·threshold 검증을 제시합니다.

## 감점 포인트
- balanced sampling의 score .7을 운영 양성 확률로 단정합니다.
- weight 변경이 threshold를 일정 배율로 바꾼다고 말합니다.
- accuracy 또는 balanced training score 하나로 승인합니다.

## 더 파고들 거리
- class weight와 balanced bootstrap을 독립 요인으로 둔 비교표와 고정할 평가 자료를 설계해 보세요.
- 검토 용량을 초과할 때 자동 승인·보류·사람 검토의 세 구간 threshold를 정해 보세요.

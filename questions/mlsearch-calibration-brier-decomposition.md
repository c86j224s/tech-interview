---
id: mlsearch-calibration-brier-decomposition
title: Brier가 낮아졌는데 calibration과 discrimination 중 무엇이 좋아졌는지 어떻게 확인하나요?
difficulty: 중하
category: 머신러닝
tags:
  - Brier
  - calibration
  - discrimination
related:
  - ml-classification-metrics
  - ml-loss-objective
---
# Brier가 낮아졌는데 calibration과 discrimination 중 무엇이 좋아졌는지 어떻게 확인하나요?

## 구두 답변

Brier는 `mean((p-y)^2)`인 전체 확률 오차라 낮아졌다는 사실만으로 calibration 또는 discrimination 중 하나를 지목할 수 없습니다. 먼저 같은 표본에서 Brier와 AUC를 함께 계산하고, Murphy decomposition의 reliability·resolution·uncertainty를 같은 bin 규칙으로 비교합니다. 예를 들어 label `[0,0,1,1]`에서 모델 A가 `[0.2,0.4,0.6,0.8]`이면 제곱오차 합은 `0.04+0.16+0.16+0.04=0.40`, Brier는 0.10입니다. 모델 B를 `[0.1,0.3,0.7,0.9]`로 바꾸면 합은 `0.01+0.09+0.09+0.01=0.20`, Brier는 0.05이고 순위는 여전히 완전해 AUC도 같습니다. 이 변화는 이 작은 예에서 확률 위치가 label 빈도에 가까워진 calibration 개선으로 읽을 수 있습니다.

반대로 `[0.8,0.2,0.7,0.3]`처럼 순서를 뒤섞으면 Brier가 얼마인지 계산할 수 있지만 AUC는 하락합니다. 그러면 Brier 변화에 discrimination 변화가 섞였다고 보고 reliability만으로 결론을 내리지 않습니다. Murphy 식은 `BS = reliability - resolution + uncertainty` 관례로 쓰며, bin 평균과 전체 prevalence를 명시해야 합니다. bin 경계가 바뀌면 경험적 분해 항도 바뀌므로 원자료 Brier와 AUC를 별도 보고합니다.

마지막으로 Brier는 threshold의 검토량이나 특정 비용을 자동 보장하지 않습니다. threshold별 confusion matrix와 비용을 따로 평가하고, 같은 held-out 자료와 label horizon을 사용합니다.

비교 자료가 달라지면 prevalence 자체가 uncertainty 항을 바꾸므로 모델 버전 간 Brier 차이를 단순 비교하지 않습니다. 같은 test rows와 같은 binning convention을 유지하고, prevalence가 다른 slice에서는 slice별 Brier와 calibration을 따로 냅니다. 마지막으로 선택된 threshold가 같은지 확인해야 Brier 개선이 실제 의사결정 개선으로 이어졌는지 판단할 수 있습니다.

## 득점 포인트

- Brier 원식과 `[0.2,0.4,0.6,0.8]`의 0.10 계산을 직접 보여 줍니다.
- 동일 순위의 `[0.1,0.3,0.7,0.9]`에서 Brier 0.05와 AUC 불변을 비교합니다.
- Murphy의 reliability·resolution·uncertainty와 binning 의존성을 명시합니다.

## 감점 포인트

- Brier 하나를 calibration 지표라고만 부릅니다.
- refinement/prevalence를 정의 없이 reliability와 섞습니다.
- Brier가 낮아졌으니 threshold 품질도 좋아졌다고 결론냅니다.

## 더 파고들 거리

- 같은 bin 규칙으로 두 모델의 decomposition 항을 실제 계산해 보세요.
- AUC가 하락하지만 Brier가 좋아지는 사례에서 비용 정책이 무엇을 우선할지 정해 보세요.

---
id: mlsearch-pca-components-selection
title: explained variance 95%를 선택한 PCA에서 validation 성능이 더 나빠질 수 있는 이유는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - PCA
  - explained variance
  - dimension
related:
  - ml-train-validation-test
  - ml-overfitting-generalization
---
# explained variance 95%를 선택한 PCA에서 validation 성능이 더 나빠질 수 있는 이유는 무엇인가요?

## 구두 답변

explained variance는 입력 `X`의 재구성 변동을 얼마나 보존했는지를 말할 뿐, label을 예측하는 정보가 얼마나 남았는지를 보장하지 않습니다. PC1·PC2가 입력 variance의 95%를 차지해도 희귀 양성 여부가 작은 variance의 PC3 방향에만 있다면 두 성분만 남긴 classifier의 recall이 떨어질 수 있습니다. PCA의 목적과 downstream metric의 목적이 다르기 때문입니다.

선택은 train에서 PCA를 fit하고 validation에서 component 수와 downstream 성능을 비교하는 방식으로 합니다. 후보마다 누적 ratio, validation loss·recall·precision, 집단별 결과, 추론 비용을 함께 기록합니다. 예를 들어 `k=2`가 95%를 넘지만 양성 recall 60%, `k=3`은 누적 비율이 95% 이상으로 올라가지만 recall 80%라면 운영 목적에 따라 k=3이 더 나을 수 있습니다. 이 수치는 가능한 설명용 예이며 실행 결과가 아닙니다.

반대로 variance가 낮은 성분은 noise일 수도 있으므로 항상 많이 남기는 것도 답이 아닙니다. raw baseline, PCA without whitening, whitening 후보를 같은 split·seed·예산으로 비교하고 최종 선택 뒤 test를 한 번 평가합니다. validation을 반복해서 보며 95% 기준을 계속 바꾸면 validation도 선택 정보가 되므로 실험 횟수와 선택 정책을 기록하겠습니다.


누적 비율의 산술도 함께 봐야 합니다. 예를 들어 성분별 분산이 `[0.70,0.25,0.05]`이면 `k=2` 누적 비율은 `0.95`, `k=3`은 `1.00`입니다. 성분을 추가했다고 누적 비율이 `0.94`로 내려갈 수는 없습니다. 그럼에도 `k=3`이 더 좋은 경우는 충분합니다. PC3의 5%가 희귀 양성 신호라면 `k=2` classifier의 recall이 60%, `k=3`의 recall이 80%가 될 수 있기 때문입니다. 이 수치는 설명용 가정이며 실제 선택은 train-fit PCA를 고정한 뒤 validation에서 계산합니다. 95%는 reconstruction 기준을 만족시키는 후보 생성 규칙이지 분류 성능의 보증서가 아닙니다.
## 득점 포인트

- explained variance가 재구성 목적이고 label metric이 아니라는 차이를 PC3의 희귀 signal 반례로 설명합니다.
- component 수·whitening·raw baseline을 validation downstream metric, slice, 비용으로 비교합니다.
- 95% 규칙을 사전 기준으로 쓰되 test를 반복 선택에 사용하지 않고 최종 절차를 잠급니다.

## 감점 포인트

- 95% explained variance가 일반화와 분류 recall을 보장한다고 말합니다.
- validation에서 반복 선택한 뒤 그 점수를 독립 test처럼 보고합니다.

## 더 파고들 거리

- component 수를 고르는 validation 선택 비용과 독립 test 평가를 실험 기록으로 남겨 보세요.
- 희귀 label signal이 low-variance PC에 있다는 가정을 slice별 confusion으로 검증해 보세요.

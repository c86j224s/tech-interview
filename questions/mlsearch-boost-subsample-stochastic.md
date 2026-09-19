---
id: mlsearch-boost-subsample-stochastic
title: boosting subsample=.7은 어떤 분산·편향과 재현성 변화를 만드나요?
difficulty: 중하
category: 머신러닝
tags:
  - gradient boosting
  - subsampling
  - random seed
related:
  - ml-overfitting-generalization
  - cross-validation-fold-correlation
---
# boosting subsample=.7은 어떤 분산·편향과 재현성 변화를 만드나요?

## 구두 답변

`subsample=.7`은 각 boosting 단계에서 전체 표본의 약 70%만 사용해 그 단계의 트리 구조와 잎 출력을 적합한다는 뜻입니다. 현재 앙상블로부터 계산한 pseudo-residual이 있더라도, 실제 분할은 선택된 표본의 residual을 보고 결정됩니다. 단계마다 다른 mask가 들어가면 트리들이 같은 표본의 잡음에 덜 맞물려 상관이 줄고 과적합이 완화될 수 있지만, 부분 표본으로 gradient를 추정하므로 분산과 편향, seed 의존성이 커질 수 있습니다.

특히 희귀 slice가 작은 데이터에서는 mask가 그 집단을 자주 빠뜨릴 수 있습니다. 전체 평균 validation 점수만 좋아져도 희귀 양성 recall이나 특정 시간대의 오차가 나빠질 수 있으므로, seed별 slice 결과와 단계별 포함 행을 확인하겠습니다. `subsample=1.0`과 `.7`을 같은 tree 수·깊이·learning rate로 두고 5개 이상의 고정 seed에서 평균, 표준편차, 최악 slice, 최적 tree 수, latency를 비교합니다. 이 숫자는 설계할 비교 항목이지 실행하지 않은 성능 주장이 아닙니다.

재현성은 seed를 고정한다고 끝나지 않습니다. 데이터 순서, 병렬 reduction, 라이브러리 버전, 표본 추출 구현을 artifact에 남겨야 같은 결과를 재현할 수 있습니다. `.7`로 낮추면 항상 일반화가 좋아진다는 결론도 내리지 않습니다. 데이터가 아주 작거나 signal이 희귀하면 분산 증가가 이득을 넘어설 수 있고, 더 많은 반복·정규화·slice별 가중이 필요할 수 있습니다.


예를 들어 한 단계에 10개 행이 있고 `.7`이면 보통 7개를 비복원으로 뽑는 계약입니다. 희귀 slice가 2행뿐이면 한 번의 mask에서 두 행이 모두 빠질 확률은 `C(8,7)/C(10,7)=8/120≈.0667`이고, 한 행 이상 빠질 확률은 훨씬 높습니다. 이 단계의 tree가 slice를 전혀 보정하지 못해도 전체 평균 loss에는 작은 흔적으로만 보일 수 있습니다. 그래서 mask별 포함 수와 slice별 residual 합을 함께 저장하고, seed 반복에서 평균뿐 아니라 최악 recall과 분산을 확인해야 합니다. 이는 “랜덤성을 넣으면 일반화가 좋아진다”가 아니라 편향·분산 교환을 관측 가능한 상태로 만드는 절차입니다.
## 득점 포인트

- subsample mask가 매 단계 tree의 split과 leaf를 바꾸고, 전체 ensemble의 residual 계산과 부분 표본 적합을 구분합니다.
- `.7`이 상관과 과적합을 줄일 가능성과 부분 표본·희귀 slice 누락으로 인한 분산·편향을 함께 봅니다.
- 5개 이상 seed의 평균뿐 아니라 worst slice, validation variance, mask·버전 기록으로 재현성을 확인합니다.

## 감점 포인트

- subsample을 낮추면 항상 성능이 좋아진다고 말합니다.
- 한 seed 또는 전체 평균만 보고 재현성과 희귀 집단 회귀를 숨깁니다.

## 더 파고들 거리

- 희귀 집단이 mask에서 빠지는 문제를 stratified sampling 또는 가중치로 어떻게 검증할지 설명해 보세요.
- seed·병렬 실행·데이터 순서가 재현성에 미치는 영향을 분리해 보세요.

---
id: mlsearch-boost-learning-rate-trees
title: learning rate를 절반으로 줄이고 tree 수를 두 배로 늘리면 항상 같은 모델인가요?
difficulty: 중하
category: 머신러닝
tags:
  - gradient boosting
  - learning rate
  - tree count
related:
  - ml-gradient-learning-rate
  - ml-overfitting-generalization
---
# learning rate를 절반으로 줄이고 tree 수를 두 배로 늘리면 항상 같은 모델인가요?

## 구두 답변

항상 같은 모델은 아닙니다. `η`를 절반으로 하고 tree 수를 두 배로 늘리면 비슷한 함수 용량을 기대할 수는 있지만, 부스팅은 각 단계가 앞 단계의 결과에 의존하는 greedy 절차입니다. `η=.1`에서 첫 트리를 `0.1h₁`만큼 더한 경로와 `η=.05`에서 `0.05h₁`만큼 더한 경로는 두 번째 단계의 pseudo-residual이 달라집니다. 그 결과 이후 트리의 분할, 잎 출력, 조기 종료 시점까지 달라집니다.

예를 들어 한 설정을 500개, 다른 설정을 1000개로 두더라도 `η×tree 수`만 비교하지 않겠습니다. 같은 split과 seed 정책에서 단계별 train·validation loss, 최저 validation checkpoint의 tree 수, 평균 깊이, 예측 latency와 모델 크기를 기록하겠습니다. `η=.05`가 더 천천히 내려가면서 800번째에서 최저가 될 수 있고, `η=.1`은 350번째에서 이미 validation이 악화될 수 있습니다. 이는 최종 tree 수를 두 배로 맞춰도 학습 경로가 같지 않다는 구체적인 차이입니다.

작은 learning rate가 무조건 우월한 것도 아닙니다. 계산 예산과 지연 예산이 제한되어 있으면 많은 트리를 평가하는 비용이 커지고, 데이터가 적으면 더 긴 경로가 과적합 기회를 늘릴 수 있습니다. 두 후보를 비교할 때는 동일한 처리 샘플 수·seed·validation 정책을 고정하고, 성능뿐 아니라 비용을 함께 판단하겠습니다. train loss만 같아지는지를 기준으로 삼지 않고, 최종 test는 선택을 잠근 뒤 한 번 사용합니다.


두 경로의 차이는 첫 단계부터 수치로 드러납니다. 어떤 첫 트리 출력이 `h₁(x)=[2,-1]`라면 `.1` 설정은 `[.2,-.1]`, `.05` 설정은 `[.1,-.05]`만 더합니다. 제곱손실 기준 현재 잔차가 `[1,1]`이었다면 다음 목표는 각각 `[.8,1.1]`과 `[.9,1.05]`로 달라집니다. 이후 같은 후보 분할을 보더라도 잎의 최적 상수와 gain이 달라질 수 있습니다. 그러므로 두 실험은 단순히 마지막 누적 계수만 맞추지 말고, 동일한 validation checkpoint 규칙으로 어느 시점에서 멈추는지를 비교해야 합니다.
## 득점 포인트

- learning rate와 tree 수의 곱이 아니라 앞 단계 예측이 다음 gradient를 바꾸는 순차 경로를 근거로 비동등성을 설명합니다.
- `.1/500`과 `.05/1000`을 validation curve, 최적 checkpoint, latency까지 같은 예산에서 비교합니다.
- 작은 learning rate의 일반화 가능성과 tree 증가에 따른 저장·예측 비용을 함께 판단합니다.

## 감점 포인트

- η×tree 수가 같으면 동일한 모델·동일한 score라고 단정합니다.
- train loss만 맞춰 보고 조기 종료, seed, 깊이와 운영 지연을 무시합니다.

## 더 파고들 거리

- 동일한 tree budget과 latency budget에서 η 후보를 어떻게 공정하게 선택할지 설계해 보세요.
- subsampling과 조기 종료가 두 학습 경로의 차이를 어떻게 더 키우는지 추적해 보세요.

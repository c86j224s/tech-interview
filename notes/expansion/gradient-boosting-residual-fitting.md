---
id: gradient-boosting-residual-fitting
title: 그래디언트 부스팅의 순차 잔차 적합
topic: 머신러닝
summary: 앞선 모델의 loss gradient를 다음 약한 학습기의 목표로 삼고 shrinkage·tree 수·subsampling으로 조절합니다.
questionIds: []
prerequisites:
  - gradient-descent
  - loss-objective
  - generalization
related:
  - gradient-descent
  - loss-objective
reviewedAt: '2026-09-19'
---
# 그래디언트 부스팅의 순차 잔차 적합

## 예측을 하나의 함수로 보는 관점

그래디언트 부스팅은 여러 트리를 독립적으로 학습해 평균내는 방식과 출발점이 다릅니다. 첫 모델 뒤에 두 번째 모델을 병렬로 붙이는 대신, 현재 앙상블이 틀린 방향을 다음 약한 학습기가 보정하도록 순차적으로 함수를 더합니다. 입력을 `x`, 실제값을 `y`, 현재 앙상블을 `F_{m-1}(x)`라고 하면 다음 단계는 `F_m(x)=F_{m-1}(x)+η h_m(x)`입니다. 여기서 `h_m`은 새 트리, `η`는 shrinkage 또는 learning rate입니다.

이 표기에서 gradient는 파라미터 벡터에만 존재하는 것이 아닙니다. 각 훈련 표본에서 현재 예측값을 조금 움직였을 때 손실이 어떻게 변하는지를 예측값 축에서 계산할 수 있습니다. 그래서 다음 트리는 “이전 트리의 잔차를 외운다”기보다, 각 입력 위치에서 손실을 줄이는 함수 방향의 음의 gradient를 근사한다고 말하는 편이 정확합니다. 제곱손실에서는 이 방향이 우연히 `y-F`라는 단순한 잔차가 됩니다.

## 초기값과 제곱손실 잔차

제곱손실을 표본별 `L(y,F)=1/2(y-F)^2`로 쓰면 `∂L/∂F=F-y`입니다. 따라서 음의 gradient는 `y-F`입니다. 처음 예측을 모든 표본의 평균으로 두는 이유도 이 손실에서 상수 함수가 최적의 초기값이기 때문입니다. 예를 들어 `y=[3,7]`의 평균은 5이므로 `F_0=[5,5]`로 시작할 수 있습니다. 잔차는 `[-2,2]`이고 다음 트리는 첫 표본에서 음의 방향, 두 번째 표본에서 양의 방향을 예측하도록 학습됩니다.

반면 입력 두 개의 현재 예측이 `F=[2,5]`이고 정답이 `y=[3,7]`라면 음의 gradient는 `[1,2]`입니다. 트리가 이 두 값을 정확히 맞춘다고 가정해 `h=[1,2]`, `η=.1`을 적용하면 새 예측은 `[2.1,5.2]`입니다. 잔차는 `[.9,1.8]`로 줄어듭니다. 이 계산은 설명용 산술이며 특정 라이브러리를 실행한 결과가 아닙니다. 실제 트리는 모든 표본의 목표값을 완벽히 복사하지 않고, 깊이·잎 수·정규화 제약 안에서 분할 가능한 상수 예측을 찾습니다.

| 단계 | 현재 `F` | 음의 gradient | 예시 `h` | `ηh` 적용 뒤 |
| --- | --- | --- | --- | --- |
| 0→1 | `[2,5]` | `[1,2]` | `[1,2]` | `[2.1,5.2]` |
| 1→2 | `[2.1,5.2]` | `[.9,1.8]` | `[.8,1.5]` | `[2.18,5.35]` |

잎마다 같은 값을 내는 트리라면 `h`는 각 잎의 표본에 대한 평균 잔차와 관련됩니다. 즉 트리 구조가 정해진 뒤에도 잎 출력과 learning rate가 별도의 축으로 작동합니다. 이를 생략하고 “residual tree를 추가한다”고만 하면 잔차가 항상 정확히 0이 된다는 오해가 생깁니다.

## 일반 loss의 pseudo-residual

제곱손실의 잔차 표현을 모든 손실에 일반화하면 안 됩니다. 이진 로그손실에서는 현재 raw score 또는 확률에 대한 미분을 계산하고, 그 음의 gradient를 pseudo-residual이라고 부릅니다. 확률 `p`를 직접 다루는 표현에서는 표본별 방향이 `y-p` 형태로 나타날 수 있지만, 모델 API가 raw score를 출력하는지 확률을 출력하는지에 따라 미분 변수와 식이 달라집니다. 절댓값 손실, Huber 손실, 다중 분류 multinomial loss에서도 다음 목표는 `y-F`라는 숫자 잔차가 아니라 현재 손실의 음의 미분입니다.

이 차이는 구현과 디버깅에서 중요합니다. “오차가 큰 행을 다음 트리가 맞춘다”는 설명은 직관으로는 유용하지만, 실제 목적은 각 표본의 손실 곡면에서 내려가는 함수 방향을 근사하는 것입니다. 손실을 바꾸면 같은 데이터라도 pseudo-residual의 크기와 부호가 달라지고, 잎의 최적 출력 계산도 달라질 수 있습니다. 따라서 변경한 loss의 정의역, raw score의 의미, 미분을 어느 출력에 대해 취하는지 함께 기록해야 합니다.

```diagram
{"title":"음의 gradient를 트리로 더하는 흐름","caption":"각 단계에서 현재 예측으로 pseudo-residual을 만들고 새 트리가 그 방향을 근사한 뒤 shrinkage를 거쳐 앙상블에 더합니다.","rows":[[{"id":"data","label":"훈련 표본","detail":["x · y"]}],[{"id":"current","label":"현재 앙상블 F","detail":["Fₘ₋₁(x)"]}],[{"id":"gradient","label":"음의 loss gradient","detail":["제곱손실이면 y−F"]}],[{"id":"tree","label":"새 약한 트리 hₘ","detail":["분할·잎 출력"]}],[{"id":"add","label":"shrinkage 합산","detail":["Fₘ=Fₘ₋₁+ηhₘ"]}]],"edges":[{"from":"data","to":"current","label":"입력·이전 상태"},{"from":"current","to":"gradient","label":"손실 미분"},{"from":"gradient","to":"tree","label":"목표 근사"},{"from":"tree","to":"add","label":"η만큼 추가"}]}
```

## Shrinkage와 트리 수의 상호작용

`η`를 작게 하면 한 트리의 영향이 줄어들어 한 단계에서 과하게 보정할 가능성이 낮아집니다. 대신 같은 수준의 함수 변화를 만들려면 더 많은 트리가 필요할 수 있습니다. 그러나 `η×트리 수`만 같다고 같은 모델은 아닙니다. 두 번째 트리는 첫 번째 트리의 결과에서 계산한 gradient를 보므로 첫 단계의 크기가 달라지면 이후 모든 목표와 분할 후보가 달라집니다. 깊이 제한, 잎의 최소 표본 수, 정규화, 초기값도 경로를 바꿉니다.

예를 들어 `η=.1`로 500개와 `η=.05`로 1000개를 비교할 때는 최종 train loss만 맞추지 않습니다. 같은 데이터 분할과 seed 정책 아래 validation loss 곡선, 선택된 최적 단계, 모델 직렬화 크기, 예측 지연, 단계별 잎 수를 같이 기록합니다. 첫 번째 설정이 350번째에서 최저라면 500번째까지 모두 쓰지 않을 수도 있고, 두 번째 설정은 800번째까지 개선될 수 있습니다. 이 차이는 shrinkage가 단순한 배율이 아니라 greedy한 경로에 영향을 준다는 증거입니다.

## Subsampling과 확률적 부스팅

각 단계에서 전체 표본 대신 `subsample=.7`을 사용하면 해당 단계의 트리 적합에 무작위 표본 마스크가 들어갑니다. 잔차 자체는 전체 앙상블을 기준으로 계산되지만, 트리 분할과 잎 출력은 선택된 70% 표본의 gradient만 보고 결정됩니다. 이로 인해 단계별 트리들이 같은 행의 우연한 패턴에 덜 동조할 수 있고 과적합이 완화될 가능성이 있습니다. 동시에 매 단계의 목표를 부분 표본으로 추정하므로 편향이나 분산, 재현성의 변화가 생깁니다.

`subsample`을 낮추면 항상 좋아진다고 말할 수 없습니다. 데이터가 작거나 특정 희귀 집단이 적으면 마스크가 그 집단을 빠뜨려 해당 slice의 보정이 약해질 수 있습니다. seed를 바꾼 5회 이상 반복에서 평균과 최악 slice를 기록하고, 각 seed의 선택 tree 수와 validation variance를 비교해야 합니다. 한 seed의 점수만으로 stochastic 설정이 우월하다고 결론 내리지 않습니다. 관측해야 할 것은 seed, 단계별 표본 수, 집단별 포함 여부, wall-clock 비용, 최종 예측의 변동입니다.

## 다중 분류의 출력과 loss

다중 분류에서는 클래스마다 additive raw score를 둘 수 있지만, 각 score를 독립 sigmoid에 통과시킨 결과는 합이 1인 확률분포가 아닙니다. multinomial loss를 사용하면 각 입력의 class score 벡터를 softmax로 묶어 `p_k=exp(F_k)/Σ_j exp(F_j)`로 해석합니다. 예를 들어 logits `[2,1,0]`의 softmax는 대략 `[.665,.245,.090]`이며 합이 1입니다. 이 수치는 설명용 계산입니다. 최종 class는 보통 가장 큰 확률의 argmax로 고르지만, 비용이 다른 운영 판정이나 abstain이 필요하면 threshold와 검토 정책을 별도로 정합니다.

다중 클래스 gradient도 클래스별 score에 대한 multinomial loss의 미분으로 만들어집니다. 그러므로 “각 클래스의 잔차를 독립적으로 맞춘다”는 설명만으로는 클래스 간 확률 경쟁과 score 식별성 문제를 놓칩니다. 클래스별 출력의 기준화 방식, 확률 보정 필요성, 불균형 비용을 평가 지표와 함께 고정해야 합니다.

## 구현 선택과 조기 종료

작은 데이터로 첫 두 단계의 `F`, pseudo-residual, 선택 표본, tree output, `ηh`를 출력하면 부호와 적용 순서를 검증할 수 있습니다. 다음으로 고정된 validation을 매 단계 평가하고 가장 좋은 단계의 checkpoint를 저장합니다. 조기 종료 patience와 개선 최소폭은 선택 정책이므로 validation을 반복해서 본 횟수와 함께 기록해야 합니다. 최종 테스트는 정책이 잠긴 뒤 한 번 사용합니다.

실제 라이브러리의 세부 파라미터 이름과 기본값은 버전에 따라 다를 수 있으므로 이 장에서는 scikit-learn stable 문서가 설명하는 stage-wise additive trees, negative loss gradient, shrinkage라는 개념만 근거로 삼습니다. 정확한 릴리스별 기본값이나 특정 실행 성능은 고정하지 않았습니다. `loss`를 바꿀 때는 pseudo-residual의 정의를 다시 대조하고, 모델이 확률을 반환한다고 해서 calibration이 자동으로 보장된다고 해석하지 않습니다.

## 실패 진단과 비용 경계

훈련 손실만 내려가고 validation이 오르면 tree 수·깊이·learning rate를 함께 의심하되 데이터 분할과 누출도 먼저 확인합니다. 반대로 양쪽 손실이 모두 높으면 tree 용량이나 feature 신호, loss 구현, label을 작은 데이터 과적합 시험으로 분리합니다. subsampling으로 점수가 안정돼도 특정 slice가 좋아졌는지 확인하지 않으면 평균 지표 뒤의 회귀를 놓칠 수 있습니다.

부스팅은 단계가 순차적이므로 트리 수가 늘면 예측 지연과 저장 크기가 함께 커집니다. 더 작은 `η`가 validation에 유리해도 latency 예산을 넘으면 운영 선택이 아닙니다. 비교표에는 학습 표본 수, tree 수, 평균 깊이, 예측 시간, validation metric, seed 분산을 적습니다. 계산을 실제로 실행하지 않은 수치는 이 장에 넣지 않았으며, 위의 두 행 업데이트와 softmax 값은 설명용 산술입니다.

## 참고 자료와 검증 범위

- [Gradient tree boosting](https://scikit-learn.org/stable/modules/ensemble.html#gradient-tree-boosting) — 2026-09-19 확인한 scikit-learn stable 문서. stage-wise additive tree, negative loss gradient, shrinkage와 subsampling 관련 개념의 근거로 사용했습니다. 본문 근거는 scikit-learn 1.9.1 문서 스냅샷이며, 이 환경에서 설치된 실행 버전과 estimator 기본값은 확인하지 않았습니다.
- [경사하강법의 보폭과 학습 예산](/tech-interview/notes/gradient-descent/) — 파라미터 공간 gradient와 학습률을 다루는 저장소 노트. 이 장은 그와 구별해 함수 공간에 트리를 더합니다.
- [학습 손실과 운영 지표의 불일치](/tech-interview/notes/loss-objective/) — prediction loss, objective, threshold metric을 구분하는 저장소 노트.
- 이 장의 `[2,5]→[2.1,5.2]`와 `[2,1,0]` 계산은 설명용 산술이며 프레임워크 실행 결과가 아닙니다.

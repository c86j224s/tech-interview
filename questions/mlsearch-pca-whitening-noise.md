---
id: mlsearch-pca-whitening-noise
title: whitening이 작은 eigenvalue 방향의 noise를 키울 수 있는 이유는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - PCA
  - whitening
  - noise
related:
  - ml-gradient-learning-rate
  - ml-overfitting-generalization
---
# whitening이 작은 eigenvalue 방향의 noise를 키울 수 있는 이유는 무엇인가요?

## 구두 답변

PCA 투영값을 `Z=XcV`라고 할 때 whitening은 성분별로 `sqrt(λ)`로 나누어 `Z_j/sqrt(λ_j)`처럼 스케일을 맞춘다고 설명할 수 있습니다. 고유값 100인 축은 10으로 나누지만, 고유값 .01인 축은 .1로 나누므로 10배가 됩니다. 따라서 작은 variance 방향에 있던 측정 noise도 상대적으로 커집니다. scikit-learn 1.9.1 PCA 문서는 singular value 기반 unit-variance scaling을 설명하며 조절 가능한 ε를 API 계약으로 제시하지 않습니다. ε는 프레임워크 중립적인 안정화 예시로만 다루고, 해당 API에서는 component 수를 검증합니다.

Whitening의 장점은 상관된 축을 회전한 뒤 scale을 맞춰 일부 optimizer나 거리 모델의 조건을 정돈할 수 있다는 점입니다. 하지만 단순 회전도 아니고 무손실 변환도 아닙니다. 원래 variance 크기에 담긴 신뢰도 정보를 제거하고, 작은 eigenvalue의 수치 오차나 noise를 강조할 수 있습니다. 그래서 component 수와 whitening 여부를 validation에서 함께 비교합니다. ε는 사용하는 구현이 실제로 노출하는 안정화 옵션일 때만 별도로 비교합니다.

검증은 고유값 목록과 whitening 전후 각 성분의 분산을 출력하고, noise가 의심되는 tail 성분을 보존했을 때 downstream metric과 slice 결과가 어떻게 변하는지 확인하는 순서입니다. PCA와 whitening은 train fold에서만 fit하며 test 분포로 eigenvalue나 epsilon을 선택하지 않습니다. whitening 후 성능이 좋아져도 noise가 사라졌다는 뜻이 아니라, 해당 모델과 평가 분할에서 scale 조정이 유효했다는 제한된 근거로 해석합니다.


두 축만 놓고 보면 배율의 방향이 명확합니다. `λ₁=100`이면 `sqrt(λ₁)=10`이어서 투영값을 0.1배로 만들고, `λ₂=.01`이면 제곱근이 .1이어서 10배로 만듭니다. 원래 두 번째 축의 신호와 noise가 모두 작았다면 whitening 뒤에는 noise의 절대량이 커질 수 있고, 두 축의 분산을 동일하게 만들었다는 사실만으로 신호 대 noise 비율이 좋아지지 않습니다. scikit-learn 1.9.1 문서가 설명하는 `whiten=True`는 singular value와 표본 수를 이용한 unit-variance scaling이며 사용자가 조절하는 ε를 약속하지 않습니다. 따라서 ε를 말할 때는 다른 구현의 안정화식으로 표시하고, 해당 API에서는 `n_components`와 tail 보존 여부를 검증 대상으로 삼아야 합니다.
## 득점 포인트

- 고유값 100과 .01을 각각 제곱근으로 나눠 작은 축이 10배 확대되는 중간 계산을 보여줍니다.
- whitening이 회전뿐 아니라 variance scale 정보를 제거하고 noise를 증폭할 수 있음을 설명합니다.
- component 수·downstream slice 성능을 train fit과 validation 선택 경계 안에서 확인하고, ε는 별도 구현에서만 검토합니다.

## 감점 포인트

- whitening을 단순 회전 또는 무손실 변환이라고 부릅니다.
- 작은 eigenvalue를 모두 보존하면 noise가 반드시 줄어든다고 단정합니다.

## 더 파고들 거리

- 사용하는 PCA 구현이 epsilon을 노출한다면 component cutoff와 함께 작은 eigenvalue 축의 실제 norm을 출력해 보세요.
- whitening 전후 distance·optimizer conditioning·tail noise를 분리 측정해 보세요.

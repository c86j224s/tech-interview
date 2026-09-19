---
id: pca-covariance-eigenvectors
title: PCA의 공분산 고유벡터와 설명 분산
topic: 머신러닝
summary: 중심화 데이터의 공분산 구조에서 주성분을 선택하고 explained variance·whitening·분할 경계를 해석합니다.
questionIds: []
prerequisites:
  - data-splits
  - linear-regression-foundations
  - generalization
related:
  - learning-agent-foundations
  - generalization
reviewedAt: '2026-09-19'
---
# PCA의 공분산 고유벡터와 설명 분산

## PCA가 최적화하는 것은 무엇인가

주성분 분석(PCA)은 지도 label을 예측하는 방향을 직접 찾는 알고리즘이 아니라, 입력 데이터의 평균적인 제곱 재구성 오차를 줄이는 저차원 선형 부분공간을 찾는 방법입니다. 행렬 `X`의 각 열에서 훈련 평균 `μ`를 빼 `Xc=X-μ`를 만들고, 중심화 행렬의 특이값 분해(SVD) `Xc=UΣVᵀ`를 계산합니다. `V`의 행 또는 열 방향이 주성분이며 큰 특이값에 해당하는 방향부터 보존합니다.

공분산 행렬을 `C=XcᵀXc/(n-1)`로 두면 주성분은 `C`의 고유벡터이고, 고유값은 그 방향의 분산과 연결됩니다. SVD는 공분산을 직접 만들지 않고도 같은 방향을 안정적으로 얻는 구현 경로가 될 수 있습니다. 중요한 전제는 중심화입니다. 평균을 빼지 않은 `XᵀX/(n-1)`는 원점에서 본 2차 모멘트에 가깝고, 평균 위치 자체가 큰 방향으로 반영될 수 있습니다.

## 중심화와 평균 방향의 분리

점 `(100,100),(101,100),(100,101)`을 생각해 보겠습니다. 평균은 정확히 `(100.333...,100.333...)`이고 중심화한 점은 `(-.333...,-.333...),(.666...,-.333...),(-.333...,.666...)`입니다. 중심화된 데이터가 나타내는 것은 원점에서 멀리 떨어졌다는 사실이 아니라, 이 작은 주변에서 어느 방향으로 변동했는가입니다. 평균을 빼지 않으면 원점에서 이 점들을 바라보는 큰 벡터 `[100,100]`이 2차 모멘트에 강하게 들어가 첫 방향이 평균 위치와 변동 방향을 섞을 수 있습니다.

이는 PCA가 반드시 평균을 제거해야 한다는 단순 구호와도 다릅니다. 희소 행렬의 저장 비용 때문에 명시적 dense centering을 피하는 구현이 필요할 수 있고, 원점이 의미 있는 물리적 기준인 특수 문제에서는 비중심화 분해를 의도할 수 있습니다. 다만 그 경우 결과를 centered PCA의 주성분과 같은 것으로 부르면 안 됩니다. `mean_`을 train에 저장하고 transform 때 동일하게 빼는지, sparse 입력에서 어떤 solver·centering 계약을 쓰는지 확인해야 합니다.

## SVD와 explained variance의 숫자 추적

중심화된 2차원 데이터의 특이값 제곱을 `σ₁²=9`, `σ₂²=1`이라고 가정하면 전체 제곱 변동은 10이고 첫 주성분의 explained variance ratio는 0.9입니다. `n_components=1`로 투영하면 평균적인 직교 재구성 손실의 큰 부분을 버리지만, 10% 방향의 label signal이 사라질 수 있습니다. 이 수치는 원리를 보이는 설명용 계산입니다. 실제 ratio는 표본 수와 공분산의 분모, solver의 수치 결과에 따라 계산합니다.

`n_components=0.95`는 누적 설명 분산이 95% 이상이 되도록 성분 수를 고르는 기준으로 사용할 수 있지만, 그것은 입력 재구성 목적의 기준이지 downstream 분류·회귀 metric의 최적점을 보장하지 않습니다. 첫 두 성분이 대부분의 variance를 가지고 있어도 작은 variance 방향이 희귀 양성 여부를 담을 수 있습니다. 따라서 component 수는 누적 ratio만 보고 확정하지 않고 validation의 downstream metric, latency, 저장 차원, slice별 성능을 같이 평가합니다.

```diagram
{"title":"중심화에서 저차원 표현까지","caption":"훈련 평균과 중심화가 주성분 방향을 결정하고, validation은 보존할 차원과 downstream 성능을 선택하는 데 사용합니다.","rows":[[{"id":"raw","label":"훈련 입력 X","detail":["원래 평균 위치"]}],[{"id":"center","label":"중심화 Xc","detail":["X−μ_train"]}],[{"id":"svd","label":"SVD·공분산 방향","detail":["V · 고유값"]}],[{"id":"select","label":"성분 선택","detail":["ratio · validation"]}],[{"id":"project","label":"저차원 투영","detail":["XcV_k"]}]],"edges":[{"from":"raw","to":"center","label":"훈련 평균 제거"},{"from":"center","to":"svd","label":"방향 분해"},{"from":"svd","to":"select","label":"분산 비교"},{"from":"select","to":"project","label":"k개 보존"}]}
```

## Whitening과 작은 고유값

PCA 투영값을 `Z=XcV`라고 할 때 whitening은 각 성분을 해당 표준편차인 `sqrt(λ_j)`로 나누는 변환입니다. `Z_white,j=Z_j/sqrt(λ_j)`는 프레임워크 중립적인 설명식입니다. scikit-learn 1.9.1의 `PCA(whiten=True)` 문서는 singular value와 표본 수를 이용한 unit-variance scaling을 설명하지만 사용자가 조절하는 ε를 API 계약으로 제시하지 않습니다. ε·정규화는 다른 구현의 안정화 선택으로 구분합니다. 고유값이 100인 방향과 0.01인 방향을 각각 나누면 첫 축은 1/10, 둘째 축은 1/0.1=10을 곱하는 셈입니다. 원래 작은 방향에 있던 측정 noise도 상대적으로 크게 증폭될 수 있습니다.

Whitening은 성분의 scale을 맞춰 일부 optimizer나 거리 계산에 유용할 수 있지만, 단순 회전이 아닙니다. PCA 투영에서 분산 크기 정보를 제거하고 noise를 키울 수 있으며, 작은 고유값 tail을 줄이는 component 수 선택이 안정성에 영향을 줍니다. 별도 ε 정규화는 프레임워크 중립적인 대안으로만 기록합니다. 작은 eigenvalue 성분을 모두 보존하면 수치적으로 불안정한 tail까지 확대될 수 있어, component 수와 whitening을 함께 validation에서 비교해야 합니다. “white면 정보가 더 좋아진다”거나 “무손실 정규화”라고 표현하지 않습니다.

## 지도 목표와 설명 분산의 충돌

PCA는 label을 보지 않고 `X`만으로 방향을 정합니다. 그래서 큰 분산이 큰 예측 신호라는 보장이 없습니다. 예를 들어 PC1·PC2가 입력 변동의 95%를 설명하지만, 희귀 양성 label은 PC3의 작은 방향에만 놓일 수 있습니다. 95% 설정은 reconstruction error는 작게 만들지만 양성 recall을 낮출 수 있습니다. 반대로 PC를 많이 남기면 signal을 보존하는 대신 classifier의 계산량과 noise 민감성이 증가할 수 있습니다.

이 충돌을 검증할 때는 PCA를 train fold에서 fit하고, component 수와 whitening 여부를 validation에서 선택합니다. 각 후보의 누적 explained variance, downstream metric, threshold별 confusion, 집단별 결과를 같은 validation에서 기록합니다. test는 선택이 잠긴 뒤에 사용합니다. PCA 자체가 비지도라고 해서 test를 component 선택에 사용해도 되는 것은 아닙니다. test 평균과 공분산이 표현 공간의 방향과 좌표를 결정하기 때문입니다.

## 전체 자료 fit이 만드는 누출

전체 자료로 `μ`와 `V`를 계산한 뒤 train/test를 나누면 label을 읽지 않아도 test의 입력 분포가 train 표현에 반영됩니다. test에만 매우 큰 분산 방향이 있다면 전체 PCA의 PC1이 그쪽으로 회전하고, train과 test 모두에서 사용하는 좌표가 train-only PCA와 달라집니다. 이후 classifier는 test의 구조를 반영한 표현에서 학습한 것이 되어 최종 점수가 독립 평가가 아닙니다.

안전한 순서는 `pca.fit(X_train)`, `X_train_low=pca.transform(X_train)`, `X_test_low=pca.transform(X_test)`입니다. 교차 검증이라면 각 fold의 train만으로 mean과 components를 다시 fit합니다. rolling 문제라면 예측 시점 이전 window로 fit한 PCA artifact를 해당 미래 interval에 적용하고, 다음 window에서 새 generation을 만들 수 있습니다. `mean_`, components, explained variance, fit row IDs, cutoff를 함께 기록하면 어떤 미래 정보가 들어갔는지 감사를 할 수 있습니다.

## 구현과 수치 검증

작은 행렬로 중심화 전후를 손으로 계산하고 `Xc`의 각 열 평균이 0에 가까운지 확인합니다. 그다음 SVD로 얻은 component의 직교성 `VᵀV≈I`, 고유값의 비음수성, 선택한 k에서의 누적 ratio를 검사합니다. 부호는 고유벡터의 방향을 뒤집어도 같은 축이므로 component 부호가 다르다고 곧바로 오류로 판정하지 않습니다. 대신 투영과 inverse transform의 재구성, downstream metric, 고유값 순서를 비교합니다.

큰 sparse 행렬에서는 중심화를 명시적으로 materialize할 수 있는지, solver가 memory를 어떻게 쓰는지 별도로 검토합니다. 이미 fit한 PCA를 다른 시점 데이터에 재사용할 때 feature 순서·단위·결측 처리·평균 state가 동일해야 합니다. train/test를 분리하기 전에 결측 대체나 feature selection을 전체 자료에서 한 경우 PCA만 fold 안으로 넣어도 누출이 남습니다.

## 선택 비용과 참고 자료

PCA의 장점은 차원과 선형 상관을 줄여 저장·거리·후속 모델 비용을 낮출 수 있다는 점입니다. 비용은 SVD 계산, mean/components artifact 관리, 해석 가능성 저하, 작은 분산 signal의 손실, whitening noise 증폭입니다. 차원 축소가 필요한지 먼저 baseline과 비교하고, raw 모델·centered PCA·whitened PCA를 같은 분할과 예산에서 평가합니다.

- [PCA](https://scikit-learn.org/stable/modules/decomposition.html#pca) — 2026-09-19 확인한 scikit-learn 1.9.1 문서 스냅샷. centered input의 SVD, explained variance, whitening 개념을 대조했습니다. 설치된 실행 버전과 solver 기본값은 확인하지 않았습니다.
- [학습 데이터 분할과 선택 정보의 누출](/tech-interview/notes/data-splits/) — 전처리 fit 경계와 최종 test 사용 규칙을 다루는 저장소 노트.
- [선형회귀와 학습 과정](/tech-interview/notes/linear-regression-foundations/) — 중심화와 선형 모델 학습의 기초를 연결하는 저장소 노트.

`σ²=[9,1]`, softmax가 아닌 PCA ratio, whitening 배율은 설명용 산술입니다. 특정 프레임워크 실행 결과나 버전별 default를 사실처럼 제시하지 않았습니다.

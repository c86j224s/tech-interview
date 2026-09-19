---
id: feature-scaling-standardization-leakage
title: 특징 스케일링과 표준화 통계 누출
topic: 머신러닝
summary: 평균·표준편차 기반 변환이 거리·경사·정규화에 미치는 효과와 train-only fit 경계를 설명합니다.
questionIds: []
prerequisites:
  - data-splits
  - gradient-descent
  - generalization
related:
  - learning-agent-foundations
  - gradient-descent
reviewedAt: '2026-09-19'
---
# 특징 스케일링과 표준화 통계 누출

## 스케일과 계산 기하

특징의 단위를 바꾸는 일은 값의 표기만 바꾸는 것처럼 보이지만, 모델이 거리를 재거나 gradient를 계산한다면 최적화 문제의 기하도 바뀝니다. 평균과 표준편차로 표준화하는 변환은 `z=(x-μ)/σ`이고, `μ`와 `σ`는 데이터에서 fit한 상태입니다. 중요한 것은 변환식보다 이 상태를 어느 행으로 계산했는가입니다. 훈련 데이터에서만 fit하고 validation·test·운영 데이터에는 transform만 적용해야 평가 자료의 분포 정보가 학습 절차로 새지 않습니다.

스케일링은 모든 모델의 필수 단계가 아닙니다. 유클리드 거리를 사용하는 K-means, 내적과 정규화에 의존하는 모델, gradient 기반 선형·신경망 모델에서는 영향을 크게 받을 수 있습니다. 반면 axis-aligned 결정 트리는 순서와 분할 집합이 유지되는 조건에서 단조 변환에 거의 불변입니다. 이 차이를 모르면 스케일링을 만능 전처리나 누출 해결책으로 오해하게 됩니다.

## StandardScaler의 상태와 fit 경계

StandardScaler류의 변환은 훈련 자료의 각 열 평균과 분산 또는 표준편차를 저장하고, 이후 같은 통계로 새 행을 변환합니다. 훈련 평균이 10, 표준편차가 2인 특징의 새 값 14는 `z=2`가 됩니다. 미래 구간 평균이 20이라고 해서 미래 자료로 다시 기준을 잡아 현재 모델에 넣으면, 모델이 학습 때 사용한 좌표계와 운영 좌표계가 달라집니다. 반대로 rolling 예측에서는 각 시점의 허용된 과거 window로 새 scaler를 fit하는 별도 모델 세대를 만들 수 있습니다.

시계열에서 1~6월을 train, 7월을 validation, 8월을 test로 잡는다면 다음 순서가 안전합니다.

```text
scaler.fit(X_jan_to_jun)
X_train = scaler.transform(X_jan_to_jun)
X_val   = scaler.transform(X_july)
model.fit(X_train, y_jan_to_jun)
score(model, X_val, y_july)
```

1~7월 전체로 먼저 `fit`한 뒤 7월을 평가하는 방식은 validation의 평균·분산을 변환에 사용합니다. label을 읽지 않았어도 test 분포가 component나 scale 선택에 영향을 주므로 누출입니다. 이 과정은 실제 실행이 아니라 절차를 보이는 의사코드입니다.

## 거리 모델에서 좌표축의 비중

K-means의 기본 Lloyd 목적은 각 표본과 할당된 centroid 사이의 제곱 유클리드 거리 합입니다. `거리²=(x₁-c₁)²+(x₂-c₂)²`이므로 한 축을 100배 키우면 그 축의 차이 제곱 기여는 10,000배가 됩니다. 예를 들어 두 점의 원래 차이가 `(1,10)`이면 제곱거리 합은 101입니다. 첫 특징만 100배로 표현하면 차이는 `(100,10)`이 되고 합은 10,100입니다. 동일한 물리적 의미라도 두 번째 축이 centroid 선택을 거의 지배할 수 있습니다.

표준화 후에는 각 열이 훈련 분포의 표준편차 단위로 비교됩니다. 그러나 “모든 특징을 똑같이 중요하게 하라”는 정책과 같은 뜻은 아닙니다. 금액 차이 1원이 고객 행동에서 거리 차이 1m보다 정말 같은 의미인지 도메인 가중치를 별도로 설계해야 합니다. 표준화는 임의의 중요도 정책을 자동으로 정하지 않습니다. K-means 초기화, `k`, seed, empty cluster 처리와 함께 결과를 비교해야 하며, centroid가 바뀌었다고 곧바로 성능 개선이라고 말하지 않고 inertia와 downstream 지표를 함께 봅니다.

## 선형 분류기와 곡률 조건

선형 모델의 score가 `wᵀx+b`이면 특징 한 열을 100배로 바꿀 때 같은 함수를 표현하려면 그 열의 weight를 1/100로 바꿔야 합니다. 정규화가 없고 최적화를 정확히 끝냈다면 예측 함수가 좌표 변환에 맞춰 같은 표현을 가질 수 있습니다. 하지만 L1/L2 penalty는 weight 크기에 직접 비용을 주므로 좌표계가 바뀌면 같은 함수의 penalty가 달라집니다. 경사하강법도 feature scale에 따라 gradient 크기와 Hessian의 조건수가 바뀌어 한 learning rate가 모든 축에서 안정적이기 어려워집니다.

예를 들어 `x₁`이 0~1, `x₂`가 0~1,000,000이면 작은 weight 변화가 두 축에서 만드는 score 변화가 크게 다릅니다. 표준화 후에는 각 축의 수치 범위가 비교 가능한 위치로 이동해 optimizer가 한 방향에만 과도하게 보폭을 쓰는 문제를 완화할 수 있습니다. 이것은 수렴 속도와 수치 안정성에 대한 설명이지, 선형 분류기가 반드시 더 높은 validation 점수를 낸다는 보장은 아닙니다. regularization 계수, intercept 처리, solver, loss, stopping rule을 고정하고 실험해야 합니다.

```diagram
{"title":"스케일링 상태가 평가 경계에 들어가는 위치","caption":"훈련 window에서 통계를 fit한 뒤 같은 좌표계로 검증·테스트를 변환합니다. 미래 통계로 먼저 fit하면 평가 정보가 모델 절차에 섞입니다.","rows":[[{"id":"window","label":"허용된 훈련 window","detail":["과거 행만"]}],[{"id":"fit","label":"scaler fit","detail":["μ · σ 저장"]}],[{"id":"train","label":"훈련 transform","detail":["모델 fit"]},{"id":"future","label":"미래 행","detail":["변환 대상"]}],[{"id":"apply","label":"고정 통계 transform","detail":["validation · test"]}],[{"id":"score","label":"독립 평가","detail":["선택 뒤 사용"]}]],"edges":[{"from":"window","to":"fit","label":"통계 계산"},{"from":"fit","to":"train","label":"같은 좌표계"},{"from":"fit","to":"future","label":"μ·σ 재사용"},{"from":"future","to":"apply","label":"미래 변환"},{"from":"apply","to":"score","label":"경계 보존"}]}
```

## RobustScaler와 극단치 의미

평균과 표준편차는 극단치의 크기에 민감합니다. 거래액 999건이 10이고 한 건이 1,000,000이면 평균은 약 1,010이 됩니다. 실제로는 대부분의 거래가 10 주변인데 표준화 기준이 한 건에 끌려가서 정상 행의 상대적 위치가 압축될 수 있습니다. RobustScaler류는 median과 IQR(사분위 범위) 같은 순위 기반 통계를 사용해 극단값 하나의 영향이 덜하도록 합니다.

그렇다고 큰 값이 항상 오류는 아닙니다. 사기 거래나 대형 계약처럼 운영상 가장 중요한 사례라면 극단치를 누락하거나 억제하는 변환이 신호를 약화할 수 있습니다. 먼저 해당 값이 단위 오류·중복·센서 고장인지, 아니면 실제 rare event인지 분류합니다. 그 뒤 StandardScaler, RobustScaler, 로그 변환, winsorization, 원본·변환 특징 병행을 validation에서 비교하고, 전체 평균이 아닌 slice별 recall·오차·검토량을 확인합니다. 선택한 scaler의 fit 통계와 이상치 처리 정책은 모델 artifact에 함께 저장해야 재현됩니다.

## 결정 트리에서 성립하는 불변성

axis-aligned 결정 트리는 한 특징에서 임계값을 골라 `x_j≤t`와 `x_j>t`로 표본을 나눕니다. 일대일 단조 affine scaling `x'_j=a x_j+b`에서 `a≠0`이면 임계값도 `t'=at+b`로 옮길 수 있어 모든 표본의 순서와 분할 후보가 같습니다. `[1,2,3]`을 `[100,200,300]`으로 바꾸면 같은 sample partition을 만들 수 있습니다. 따라서 결측이 없고, 동일한 알고리즘이 연속값의 모든 threshold 후보를 탐색하며, tie·부동소수점·random seed 처리까지 같다면 예측이 거의 동일할 수 있습니다.

하지만 “항상 완전히 같은 score”라고 단정하지 않습니다. 음의 affine scaling도 가능한 표본 분할을 보존하고 좌우 child 이름만 바꿀 수 있습니다. 실제 차이는 binning·quantization, 결측값의 sentinel과 missing direction, tie-breaking, float precision, stochastic candidate policy에서 생길 수 있습니다. 파생 특징이 여러 열의 거리나 곱을 포함하면 원래 열의 단위만 바꾼다고 동일하지 않습니다. 트리 기반 모델의 표준화 불필요성은 이 조건 안에서의 선택이지 전처리 계약 전체를 면제하는 규칙이 아닙니다.

## 파이프라인 구현과 검증 순서

전처리와 모델을 하나의 pipeline artifact로 취급하면 fit 범위 누출을 줄일 수 있습니다. 교차 검증에서는 각 fold의 train rows로 scaler를 새로 fit하고 validation rows에는 transform만 호출합니다. rolling validation에서는 window ID, fit cutoff, 라벨 가용 시각, scaler 통계 hash를 남깁니다. 동일 사용자나 동일 사건이 서로 다른 split에 들어간다면 scaler만 고쳐도 누출이 해결되지 않습니다.

검증은 작은 표부터 시작합니다. 먼저 수동으로 `μ`, `σ`, median, IQR을 계산해 한 행의 transformed value를 대조합니다. 다음으로 전체 fit과 train-only fit의 통계가 다른지 확인하고, validation 행 ID가 fit 목록에 없는지 검사합니다. K-means는 스케일 변환 전후 centroid·inertia·seed 분산을 보고, 선형 모델은 초기 gradient norm·parameter delta·validation metric을 같은 예산에서 비교합니다. 트리는 분할된 sample ID가 같은지 먼저 확인한 뒤 score 차이가 있으면 missing·tie·binning을 조사합니다.

## 비용·한계와 참고 자료

스케일링은 작은 CPU 비용으로 거리와 optimizer 조건을 개선할 수 있지만, 통계 상태를 잘못 공유하면 평가가 낙관적으로 변합니다. robust 변환은 극단치에 덜 흔들리는 대신 분포의 tail 정보를 약하게 할 수 있고, rolling fit은 시간에 따른 적응 비용과 모델 버전 증가를 만듭니다. 표준화가 label 누출이나 미래 feature 생성 오류를 고치는 것은 아니며, 전체 파이프라인의 시간·그룹 계약을 검증해야 합니다.

- [Standardization or mean removal and variance scaling](https://scikit-learn.org/stable/modules/preprocessing.html#standardization-or-mean-removal-and-variance-scaling) — 2026-09-19 확인한 scikit-learn scikit-learn 1.9.1 문서 스냅샷. training mean/scale 저장과 outlier 민감성의 근거로 사용했습니다. 본문 근거는 scikit-learn 1.9.1 문서 스냅샷이며, 설치된 실행 버전과 estimator 기본값은 확인하지 않았습니다.
- [K-means clustering](https://scikit-learn.org/stable/modules/clustering.html#k-means) — 2026-09-19 확인한 scikit-learn 1.9.1 문서 스냅샷. inertia와 centroid 기반 거리 목적을 대조했습니다.
- [Decision Trees](https://scikit-learn.org/stable/modules/tree.html) — 2026-09-19 확인한 scikit-learn 1.9.1 문서 스냅샷. tree split이 feature threshold를 이용한다는 범위에서 불변성 조건을 설명했습니다.
- [학습 데이터 분할과 선택 정보의 누출](/tech-interview/notes/data-splits/) — fit·transform 경계와 시간 분할을 다루는 저장소 노트.

수치 예시는 식으로 직접 계산한 설명용 산술이며 scikit-learn을 이 환경에서 실행한 결과가 아닙니다. 라이브러리 버전, solver, seed, 결측·양자화 정책이 정해지지 않은 상태에서 특정 동일 score나 성능 향상을 주장하지 않았습니다.

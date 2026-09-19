---
id: kmeans-initialization-distance-quality
title: K-means 초기화·거리·군집 품질
topic: 머신러닝
summary: >-
  할당과 중심 재계산을 반복하는 K-means에서 초기화, inertia, silhouette, empty cluster, 스케일과 seed를
  검증합니다.
questionIds: []
prerequisites:
  - data-splits
  - generalization
  - linear-regression-foundations
related:
  - learning-agent-foundations
  - generalization
reviewedAt: '2026-09-19'
---
# K-means 초기화·거리·군집 품질

## 목적 함수와 거리 계약

K-means는 각 표본을 가장 가까운 중심에 할당하고 같은 label의 평균으로 중심을 갱신합니다. 유클리드 거리 기준의 목적은 `inertia = Σ_i min_k ||x_i-μ_k||²`입니다. 이 식은 멀리 떨어진 표본을 제곱으로 크게 벌주므로 좌표 단위, 이상치, 범주형 인코딩이 결과를 결정합니다. “군집이 좋다”는 말은 inertia가 낮다는 뜻인지, 제품에서 해석 가능한 집단이라는 뜻인지 먼저 분리해야 합니다.

예를 들어 `[0,1,9,10]`, K=2, 중심 `[1,9]`이면 첫 할당은 `{0,1}`, `{9,10}`입니다. 갱신 중심은 `0.5`, `9.5`이고 inertia는 `0.5²+0.5²+0.5²+0.5²=1.0`입니다. 이 계산은 해당 좌표계의 값이며 다른 스케일에서 얻은 inertia와 그대로 비교할 수 없습니다.

## Lloyd 반복 상태

한 iteration을 `assign → update → check`로 로그화하면 실패 위치를 추적할 수 있습니다. 초기 중심 `[1,9]`에서 counts가 `[2,2]`, 새 중심이 `[0.5,9.5]`, inertia가 1.0이라면 다음 할당도 같고 movement는 0입니다. 여기서 종료한 것은 그 초기화가 만든 해의 수렴이지 전역 최적 증명이 아닙니다. 중심이 이동하지 않아도 동점 규칙이나 부동소수점 tolerance가 바뀌면 경계 표본의 label이 달라질 수 있습니다.

실험 레코드에는 data version, feature schema hash, 결측 처리, transform, K, metric, init, seed, 초기화 횟수, tolerance, max_iter, iteration별 counts와 inertia를 보관합니다. 중심 배열만 보관하면 feature 순서가 바뀌었는지 알아낼 수 없습니다. 군집 번호도 임의의 배열 순서이므로 run 간 비교에서는 중심 좌표와 표본 집합을 매칭합니다.

## K-means++ 확률

무작위 초기화는 첫 중심들이 한 덩어리에 몰릴 수 있습니다. k-means++의 표준 선택 단계는 첫 중심을 정한 뒤 각 점 `x`에 대해 현재 선택된 중심까지의 최소 거리 `D(x)`를 구하고, 다음 중심을 `D(x)² / Σ_j D(x_j)²` 확률로 뽑는 방식입니다. 첫 중심의 선택은 구현 계약에 따라 균등 무작위 등으로 둘 수 있으므로 library default를 가정하지 않고 기록합니다.

첫 중심을 0으로 선택하고 후보의 제곱거리가 `[1,4,9]`라면 합은 14이고 확률은 `[1/14,4/14,9/14]`, 즉 약 `[0.071,0.286,0.643]`입니다. 이미 선택된 중심과 거리가 0인 중복점은 weight가 0이 됩니다. 모든 후보가 0이면 분모가 0이므로 남은 점에서 균등 선택하거나 종료하는 별도 정책이 필요합니다. k-means++는 나쁜 초기화를 줄일 확률을 높이지만 global optimum이나 한 번의 실행 안정성을 보장하지 않습니다.

## 스케일과 좌표 변환

한 축을 1,000배 바꾸면 해당 축의 제곱거리 항은 1,000,000배가 됩니다. 이는 단위 변환을 올바른 값으로 표현한 것일 수도 있고, 의도치 않은 feature weighting일 수도 있습니다. 표준화가 필요하다면 학습 분할에서 평균·표준편차를 fit하고 다른 분할에는 같은 transform을 적용합니다. 그러나 표준화 전후 inertia는 좌표 단위와 objective가 달라진 값이므로 한 순위표에서 “더 낮다”라고 비교하면 안 됩니다. 각각의 좌표계 안에서 seed baseline과 domain 지표를 비교합니다.

## K 선택과 품질 지표

K가 커지면 기존 분할을 유지하며 중심을 추가할 수 있어 training inertia는 내려가거나 같습니다. 따라서 K=10의 최저값만으로 결정하지 않습니다. elbow는 `K`를 하나 늘렸을 때 감소폭이 급격히 줄어드는 지점을 찾는 휴리스틱입니다. silhouette는 각 점의 자기 군집 평균 거리 `a`, 가장 가까운 다른 군집까지의 평균 거리 `b`로 `(b-a)/max(a,b)`를 계산하며, 전체 평균 외에 군집별 분포와 경계점을 확인해야 합니다.

예를 들어 inertia가 K=2,3,4,10에서 `[100,55,43,31]`이면 감소폭은 45,12,12입니다. K=3 근처가 후보지만 silhouette가 K=4에서 높고 제품이 네 가지 운영 유형을 요구한다면 K=4를 검토할 수 있습니다. 반대로 silhouette가 좋아도 긴 타원, 서로 다른 밀도, 연결 구조에서는 K-means 가정이 맞지 않을 수 있습니다.

## 빈 군집 복구

어떤 iteration에서 label counts가 `[5,3,0,2]`가 되면 세 번째 중심의 평균은 계산할 수 없습니다. 0 벡터를 넣거나 K를 조용히 3으로 줄이면 objective와 결과 계약이 달라집니다. 애플리케이션은 largest-error point를 빈 군집의 새 중심으로 옮길지, 아직 선택되지 않은 점을 재초기화할지, K를 중단할지를 명시해야 합니다. 이 동작은 일반적인 K-means 수학의 자동 결론이 아니라 구현 정책입니다.

largest-error 정책이라면 현재 할당에서 자기 중심까지 제곱거리가 가장 큰 점을 donor로 선택하고, donor가 빠진 군집의 중심과 새 중심을 다시 계산한 뒤 전체 할당을 한 번 더 합니다. 기록에는 empty label, donor ID, 이전·이후 counts, inertia, 복구 횟수, seed, 정책 버전을 남깁니다. 복구가 반복되면 데이터 중복·K 과다·초기화 문제를 조사하고, 결과를 정상 수렴으로 포장하지 않습니다.

## 재현성과 비용

반복 횟수와 초기화 실행 수가 많아질수록 `O(R·I·n·K·d)` 비용이 듭니다. 여러 seed 중 최저 inertia 하나만 보고 안정적이라고 말하지 말고 중앙값, 분위수, 군집 cardinality와 표본별 label 변동을 함께 봅니다. mini-batch는 계산량과 메모리를 줄일 수 있지만 전체 평균을 정확히 반복한 결과와 같다고 할 수 없으므로 batch 순서와 수렴 오차를 기록합니다.

```python
x=[0,1,9,10]; c=[1,9]
labels=[0 if abs(v-c[0]) <= abs(v-c[1]) else 1 for v in x]
centers=[sum(v for v,l in zip(x,labels) if l==k)/labels.count(k) for k in range(2)]
inertia=sum((v-centers[l])**2 for v,l in zip(x,labels))
print(labels, centers, inertia)
# [0, 0, 1, 1] [0.5, 9.5] 1.0
```

이는 설명용 Python 실행에 대한 작은 산술 검산입니다. 실제 library의 `labels_`, `cluster_centers_`, `inertia_`와 재실행 결과를 같은 fixture에서 대조해야 합니다.

```diagram
{"title":"K-means 상태와 품질 검증","caption":"초기화 확률과 반복 중 label 상태를 분리해 기록해야 지역해와 복구 정책을 구분할 수 있습니다.","rows":[[{"id":"init","label":"초기화","detail":["random 또는 ++","seed · 확률"]}],[{"id":"assign","label":"할당","detail":["제곱거리","counts"]}],[{"id":"update","label":"갱신","detail":["평균 중심","empty 검사"]}],[{"id":"quality","label":"품질 판정","detail":["inertia·silhouette","domain 목적"]}]],"edges":[{"from":"init","to":"assign","label":"중심 선택"},{"from":"assign","to":"update","label":"label별 평균"},{"from":"update","to":"quality","label":"상태 비교"},{"from":"quality","to":"assign","label":"다음 반복"}]}
```

## 참고 자료와 확인 경계

- https://scikit-learn.org/stable/modules/clustering.html#k-means — Lloyd 반복, inertia, k-means++의 질적 장점, local minimum 가능성을 본문에서 확인했습니다. 정확한 첫 중심 convention, `n_init` 기본값, 일반 KMeans의 empty-cluster 복구 방식은 이 장에서 library 버전 불변 사실로 주장하지 않았습니다.
- https://scikit-learn.org/stable/modules/preprocessing.html#standardization-or-mean-removal-and-variance-scaling — 훈련 자료의 통계로 fit하고 다른 자료에 재사용하는 원칙과 이상치 민감도를 확인했습니다. K-means 경계와 전후 inertia 비교는 별도 해석입니다.

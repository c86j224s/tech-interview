---
id: random-forest-bagging-subspaces
title: 랜덤 포레스트의 배깅과 특성 부분공간
topic: 머신러닝
summary: bootstrap 표본과 노드별 특성 부분집합으로 상관된 트리의 분산을 줄이는 원리와 OOB 평가의 한계를 설명합니다.
questionIds: []
prerequisites:
  - generalization
  - data-splits
  - classification-metrics
related:
  - generalization
reviewedAt: '2026-09-19'
---
# 랜덤 포레스트의 배깅과 특성 부분공간

## 앙상블 목표와 두 무작위성

단일 깊은 결정 트리는 표본의 작은 변화나 강한 한 feature에 따라 첫 split부터 달라질 수 있습니다. 랜덤 포레스트는 행을 bootstrap으로 다시 뽑고, 각 node split에서 일부 feature만 후보로 보아 여러 tree를 만듭니다. 분류에서는 tree vote 또는 class probability를 집계합니다. 핵심은 tree 수만 늘리는 것이 아니라 예측 오류의 상관을 낮추면서 개별 tree의 신호 손실을 감당할 균형을 찾는 것입니다.

scikit-learn ensemble 본문에서 bootstrap은 replacement 표본, `max_features`는 node별 후보 feature 수로 설명됩니다. 둘은 서로 다른 무작위화 층입니다. forest의 확률은 평균된 tree 출력이지 자동으로 calibrated probability가 아니므로 운영 해석은 별도 보정·검증 계약을 가져야 합니다.

## Bootstrap과 OOB 집계

N행에서 N번 복원 추출할 때 한 행이 빠질 확률은 `(1-1/N)^N`이고 큰 N에서 `e^-1≈0.367879`, 즉 약 36.8%입니다. 실제 유한 N과 seed에서는 행별 OOB 비율이 다릅니다. tree A의 inclusion mask가 특정 행에서 0이면 그 행은 A의 OOB 후보이고, mask가 1인 tree의 예측은 그 행의 OOB 집계에서 제외합니다.

행마다 OOB tree의 예측을 모아 score를 만들며, 어떤 행은 초기 forest에서 OOB tree가 하나도 없을 수 있습니다. tree 수가 늘면 빈칸이 줄지만 자동으로 사라진다고 단정하지 말고 count를 기록합니다. 이 방식은 별도 validation을 떼지 않고 빠른 개발 신호를 주지만, 동일 row가 일부 tree의 학습에 사용되었다는 전체 구성과 분리된 독립 test는 아닙니다.

## OOB의 평가 경계

OOB score를 보면서 `n_estimators`, depth, `max_features`, class weight, threshold를 반복 조절하면 OOB를 validation처럼 소모합니다. 같은 사용자 여러 시점의 행이 섞이면 OOB가 새 사용자 일반화를 뜻하지 않고, 시간 데이터에서는 미래 관측이 bootstrap pool에 들어가 미래 조건을 희석할 수 있습니다. 그룹 분할이나 시간 holdout이 목표라면 OOB를 개발용 참고로만 쓰고 고정 모델을 독립 자료에서 평가합니다.

실제 검증 로그에는 tree별 inclusion mask, 행별 OOB count, 그룹·시간 혼합 여부, OOB와 held-out 지표를 함께 남깁니다. OOB가 높아도 threshold와 calibration을 같은 자료에서 재선택하면 최종 지표가 낙관적으로 보일 수 있습니다.

## Feature 부분공간과 상관

`max_features=1.0`에서 강한 `x1`이 항상 후보에 포함되면 bootstrap만 달라도 tree들이 같은 split을 선택할 수 있습니다. node별 후보를 줄이면 어떤 tree는 `x1`을 보지 못하고 `x2,x3`로 다른 경로를 만들어 prediction correlation을 낮출 수 있습니다. 그러나 x1이 유일한 신호라면 그 tree의 bias가 커지고, 신호가 서로 대체 가능한 20개 feature라면 다양성 이득이 더 클 수 있습니다.

동일 variance `σ²`, tree 상관 `ρ` 가정에서 M개 평균의 분산은 `σ²[ρ+(1-ρ)/M]`입니다. M을 100에서 500으로 늘리면 `(1-ρ)/M`만 줄고 `ρσ²`는 남습니다. 반대로 `max_features`를 낮추면 ρ와 개별 tree variance·bias를 동시에 바꿉니다. 따라서 두 knob를 같은 효과라고 보고 나무 수만 늘리면 높은 상관으로 인한 포화가 남습니다.

```diagram
{"title":"행과 feature의 이중 무작위화","caption":"bootstrap은 tree가 볼 행을 바꾸고 feature 부분공간은 node의 split 후보를 바꿔 예측 상관을 조절합니다.","rows":[[{"id":"data","label":"훈련 행렬","detail":["N행 · F특징","label 분포"]}],[{"id":"boot","label":"Bootstrap 행","detail":["복원 추출","OOB mask"]},{"id":"sub","label":"Node 후보","detail":["max_features","split subset"]}],[{"id":"trees","label":"다양한 tree","detail":["경로 차이","오류 상관"]}],[{"id":"agg","label":"집계 score","detail":["vote·평균","OOB·held-out"]}]],"edges":[{"from":"data","to":"boot","label":"행 표본화"},{"from":"data","to":"sub","label":"특징 제한"},{"from":"boot","to":"trees","label":"학습 자료"},{"from":"sub","to":"trees","label":"split 후보"},{"from":"trees","to":"agg","label":"집계"}]}
```

## 불균형 sampling과 확률

양성 prevalence가 1%인 10,000행에는 약 100 positive가 있습니다. 전체 bootstrap 표본에서 positive가 한 번도 선택되지 않을 확률은 대략 `(1-.01)^10000≈e^-100`으로 작지만, 특정 node로 내려간 지역의 positive 수는 훨씬 적어질 수 있습니다. balanced bootstrap이나 class weight는 tree가 보는 class count와 weighted impurity를 바꾸므로, 그 뒤의 vote fraction을 실제 prevalence의 probability로 바로 읽을 수 없습니다.

설명용 비교에서 일반 sampling이 `TP=70,FP=80,FN=30`, balanced 후보가 `TP=85,FP=240,FN=15`라면 recall은 70%에서 85%로 오르지만 precision은 `70/150=46.7%`에서 `85/325=26.2%`로 떨어집니다. review budget 100을 balanced 후보의 FP 포함 양성 큐가 넘으면 threshold나 자동·수동 구간을 다시 설계해야 합니다. 이 숫자는 forest 실행 결과가 아니라 산술 예시입니다.

## Importance와 대체 정보

MDI는 training split에서 감소한 impurity와 도달 표본 비율을 누적하며, high-cardinality feature를 선호할 수 있습니다. permutation importance는 held-out 행에서 한 feature를 섞은 뒤 score 감소를 측정합니다. 질문이 다르므로 두 값이 다르다고 한쪽을 진실값으로 고르지 않습니다.

`zip_code`와 `city_id`가 같은 신호를 담으면 zip만 섞어도 city가 보완해 score 감소가 작습니다. 이는 zip이 무정보라는 뜻이 아니라 단독 제거의 조건부 영향이 작다는 뜻입니다. 개별 permutation, 둘을 함께 섞는 group permutation, shuffle 반복 분산, 시간·그룹 slice를 함께 보며 인과 효과나 제거 우선순위로 확대하지 않습니다.

## 구현·메모리·검증

작은 forest에서는 mask를 저장해 OOB tree 목록을 만든 뒤 학습에 포함된 tree가 집계에서 빠지는지 검증합니다. `max_features` 후보마다 pairwise prediction correlation, validation metric, calibration, fit/predict latency를 seed 여러 개로 기록합니다. class imbalance에서는 positive count와 weighted impurity도 tree별로 확인합니다.

모델 저장 크기를 학습 시간 표현과 혼동하지 않아야 합니다. tree 하나의 저장 노드는 잎 수와 내부 노드 수에 비례하고, 최대 N개 잎의 이진 tree라면 node 수는 최대 `2N-1`이므로 M개 저장 노드는 대략 `O(MN)`입니다. 실제 배열 dtype, feature index, threshold, value 차원이 추가 메모리를 정하며 깊이·leaf 제한으로 줄어듭니다. 어떤 문서의 `O(MN log N)` 표현은 구현의 거친 모델 size/비용 설명으로 한정하고, 보편적인 serialization 공간 법칙으로 옮기지 않습니다. fit 시간과 메모리는 라이브러리 release·데이터·하드웨어를 고정해 측정합니다.

## 실패 경계와 참고 자료

OOB를 독립 test로 부르거나 OOB를 보며 무제한 튜닝하면 평가가 오염됩니다. balanced score의 .7을 운영 확률로 단정하지 말고 calibration 자료와 실제 prevalence를 확인합니다. `n_jobs`가 벽시계 시간을 선형으로 줄인다는 보장도 없습니다.

- [scikit-learn Random Forests](https://scikit-learn.org/stable/modules/ensemble.html#random-forests-and-other-randomized-tree-ensembles) — 2026-09-19 본문 확인. bootstrap, OOB, max_features, variance·importance 경고를 대조했으며 exact release는 고정하지 않았습니다.
- [scikit-learn Probability Calibration](https://scikit-learn.org/stable/modules/calibration.html) — reliability curve와 독립 calibrator 자료 원칙을 확인했습니다.
- [Generalization](/tech-interview/notes/generalization/)과 [Classification metrics](/tech-interview/notes/classification-metrics/) — 평가 경계와 운영 threshold 연결 자료입니다.

여기서 bootstrap 확률, 분산식, confusion matrix, 저장공간 차수는 설명용 산술·구조 추론입니다. forest를 실행하지 않았으므로 특정 seed의 OOB score나 성능 향상을 주장하지 않습니다.

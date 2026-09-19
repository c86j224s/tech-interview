---
id: decision-tree-impurity-pruning
title: 결정 트리의 불순도·분할·가지치기
topic: 머신러닝
summary: 분할 후보의 불순도 감소를 비교하고 깊이·잎 크기·cost-complexity pruning으로 일반화를 제어합니다.
questionIds: []
prerequisites:
  - tree-foundations
  - generalization
  - classification-metrics
related:
  - balanced-search-tree
reviewedAt: '2026-09-19'
---
# 결정 트리의 불순도·분할·가지치기

## 노드 상태와 분할 목적

분류 트리는 노드에 도착한 표본 집합과 그 label 분포를 상태로 저장하고, feature `j`와 경계 `t`로 두 자식을 만듭니다. 수치 feature의 기본 경로는 `x_j≤t`와 나머지이며, 목표는 자식 하나를 정답으로 증명하는 것이 아니라 weighted child impurity를 최소화하는 것입니다.

```text
G(Q,θ) = (nL/n)H(QL) + (nR/n)H(QR)
gain = H(Q) - G(Q,θ)
```

같은 노드에서 후보를 비교할 때만 gain 숫자를 비교합니다. Gini와 entropy의 단위가 다르므로 Gini gain .1과 entropy gain .1을 서로 우열 비교하면 안 됩니다. sample weight가 있으면 `n`과 class count를 가중 합으로 해석해야 합니다.

## Gini·Entropy와 순위 반전

이진 label 비율을 `p`라 하면 Gini는 `2p(1-p)`, entropy는 `-p log₂p-(1-p)log₂(1-p)`입니다. 둘 다 순수 노드에서 0이고 `p=.5`에서 최대지만, 중간 purity를 벌주는 곡률이 다릅니다. 그래서 자식 크기와 purity 조합이 달라지면 후보 순위가 바뀔 수 있습니다.

검산 가능한 label 순서를 `[0,1,0,0,0,1,0]`으로 두고 cut 1과 cut 2를 비교합니다. parent Gini는 약 0.40816, entropy는 약 0.86312입니다. cut 1의 weighted child impurity는 Gini 0.38095, gain 0.02721이며 entropy child 0.78711, gain 0.07601입니다. cut 2는 Gini child 0.37143, gain 0.03673이지만 entropy child 0.80138, gain 0.06174입니다. 따라서 Gini는 cut 2, entropy는 cut 1을 택합니다. 이것은 곡률이라는 말을 실제 child 크기·purity·gain으로 연결한 반례입니다.

## 연속값 후보와 중복값

노드 표본을 feature 값으로 정렬한 뒤 서로 다른 인접값 사이만 후보로 만듭니다. `[10,10,20,30]`에서 10 내부를 가르면 같은 feature 값을 임의로 두 자식에 나누게 되므로 후보가 아닙니다. 10과 20 사이의 15, 20과 30 사이의 25가 후보입니다. 정렬된 `(10,0),(10,1),(20,1),(30,0)`에서 cut 15의 children은 `[0,1] | [1,0]`, cut 25는 `[0,1,1] | [0]`입니다.

prefix class count를 왼쪽으로 한 행씩 이동시키고 오른쪽 count를 전체에서 빼면 각 후보의 Gini·entropy를 다시 스캔하지 않고 계산할 수 있습니다. sample weight, missing 값, histogram 근사, categorical encoding을 추가하면 후보와 비용 계약이 달라지므로 “모든 실수값”을 구현했다고 가정하지 않습니다.

## 사전 중지와 성장 비용

`max_depth`, `min_samples_split`, `min_samples_leaf`, `min_impurity_decrease`는 후보를 평가하기 전 또는 split 승인 단계에서 성장을 제한합니다. 깊은 트리는 training impurity를 낮추지만 작은 입력 변화에도 경로가 바뀌어 분산이 커질 수 있습니다. 너무 강한 제한은 상호작용을 자르므로 train·validation이 함께 낮은 underfit과 train만 높은 overfit을 구분해야 합니다.

각 node에서 모든 feature와 후보를 훑으면 표본·feature·후보 수가 비용을 결정합니다. 정렬을 node마다 다시 하면 비용이 커지고, prefix count나 histogram은 속도를 줄이는 대신 근사·메모리 경계를 도입할 수 있습니다. 정확한 fit 시간이나 node 배열 크기는 데이터와 라이브러리 버전을 고정해 측정해야 합니다.

```diagram
{"title":"트리 분할에서 부분 트리까지","caption":"불순도 후보 비교가 재귀적 성장으로 이어지고, 이후 weakest-link 비용으로 부분 트리를 선택합니다.","rows":[[{"id":"q","label":"혼합 노드","detail":["표본 Q","impurity H"]}],[{"id":"cand","label":"경계 후보","detail":["고유 인접값","missing 정책"]}],[{"id":"gain","label":"가중 gain","detail":["child count","criterion 비교"]}],[{"id":"full","label":"성장 트리","detail":["잎 수","train error"]}],[{"id":"sub","label":"부분 트리","detail":["R(T)+α|L|","validation 선택"]}]],"edges":[{"from":"q","to":"cand","label":"후보 생성"},{"from":"cand","to":"gain","label":"자식 평가"},{"from":"gain","to":"full","label":"greedy 재귀"},{"from":"full","to":"sub","label":"weakest link"}]}
```

## Cost-complexity 경로

충분히 큰 트리를 만든 뒤 `Rα(T)=R(T)+α|L|`을 평가하면 terminal impurity와 잎 수 사이의 trade-off를 비교할 수 있습니다. 가지 `T_t`를 단일 node `t`로 줄이는 비용이 같아지는 값은 `α_eff=(R(t)-R(T_t))/(|L(T_t)|-1)`입니다. 가장 작은 weakest link를 먼저 제거하면 nested subtree path가 만들어집니다.

설명용 후보가 `(α=.001, leaves=64, validation error=.25)`, `(α=.02, leaves=18, .18)`, `(α=.1, leaves=5, .23)`이라면 가운데를 선택할 이유가 있습니다. alpha가 클수록 validation이 단조롭게 좋아진다는 뜻은 아니며, test를 보며 alpha를 재선택하면 test가 validation으로 바뀝니다. sample weight가 들어가면 R의 단위도 바뀌므로 alpha 숫자를 다른 weight 계약 사이에서 그대로 비교하지 않습니다.

## 결측 라우팅과 추론 계약

결측은 0이라는 유효값과 다릅니다. 가능한 계약은 train-only 대치와 indicator, 별도 missing category, split별 missing 방향 학습, 보류·fallback입니다. 학습 때와 추론 때 같은 모델 artifact와 규칙을 사용해야 합니다. missingness가 label 생성 이후의 정보를 담으면 indicator가 누출이 될 수 있습니다.

확인한 scikit-learn tree 본문은 각 non-missing threshold에서 결측을 왼쪽과 오른쪽으로 보내는 경우를 평가하고, 학습 중 해당 feature에 missing이 없으면 추론 때 표본이 많은 child로 보내는 구현 동작을 설명합니다. 이는 모든 tree 이론의 보편 규칙이 아닙니다. 다른 엔진은 surrogate split, 별도 child, 오류 반환을 택할 수 있으므로 feature별 missing 상태와 policy를 artifact에 저장하고 이식 테스트를 해야 합니다.

## 검증·실패·참고 자료

작은 label 배열로 두 criterion의 parent·child·gain을 각각 출력하고, `[10,10,20,30]`에서 중복값 내부 후보가 생성되지 않는지 단위 테스트합니다. pruning path에는 alpha, leaf 수, train impurity, validation metric을 함께 기록합니다. 운영 결측률이 학습 1%에서 20%로 바뀌면 missing slice의 error와 leaf 분포를 별도로 감시합니다.

- [scikit-learn Decision Trees](https://scikit-learn.org/stable/modules/tree.html) — 2026-09-19 본문 확인. impurity, threshold, missing routing, cost-complexity 설명을 대조했으나 exact release는 고정하지 않았습니다.
- [Tree foundations](/tech-interview/notes/tree-foundations/) — 자료구조 트리와 학습 split 상태를 구분하는 배경입니다.
- [Generalization](/tech-interview/notes/generalization/) — train·validation 차이를 해석하는 연결 자료입니다.

위 숫자는 안전한 설명용 산술이며 scikit-learn 실행 결과가 아닙니다. 구현별 missing 지원, tie-breaking, splitter 비용은 배포 버전과 데이터 형태를 고정한 뒤 다시 확인해야 합니다.

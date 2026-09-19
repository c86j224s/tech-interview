---
id: mlsearch-tree-gini-entropy-split
title: 같은 노드에서 Gini와 entropy가 서로 다른 분할을 고를 수 있는 조건은 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - Gini
  - entropy
  - split
related:
  - ml-classification-metrics
  - ml-overfitting-generalization
---
# 같은 노드에서 Gini와 entropy가 서로 다른 분할을 고를 수 있는 조건은 무엇인가요?

## 구두 답변
두 기준 모두 `gain=parent impurity-weighted child impurity`를 최대화하지만 곡률이 달라 child 크기와 중간 purity가 섞일 때 순위가 바뀔 수 있습니다. 실제 반례로 정렬 label `[0,1,0,0,0,1,0]`의 cut 1과 cut 2를 보겠습니다. parent Gini는 약 .40816, entropy는 .86312입니다. cut 1은 Gini child .38095, gain .02721이고 entropy child .78711, gain .07601입니다. cut 2는 Gini child .37143, gain .03673이지만 entropy child .80138, gain .06174입니다. 그러므로 Gini는 cut 2, entropy는 cut 1을 고릅니다. Gini gain .03673과 entropy gain .07601을 서로 비교하는 것이 아니라 각 criterion 안의 순위를 비교해야 합니다. sample weight, missing routing, tie-breaking은 별도의 구현 변수입니다.


반례의 핵심은 parent가 같아도 후보가 만드는 child의 크기와 purity 조합이 다르다는 데 있습니다. cut 1은 한쪽이 단일 0이고 나머지가 두 양성을 포함한 혼합 노드라 entropy가 상대적으로 큰 개선을 부여합니다. cut 2는 앞의 두 표본을 한쪽에 묶어 Gini의 중간 혼합 감소가 더 커집니다. 계산 순서는 parent class count를 먼저 세고, 각 cut의 좌·우 count, weighted child, gain을 기준별로 따로 출력하는 방식이 안전합니다. 실제 선택에서는 criterion을 바꾼 뒤 pruning·leaf size·확률 출력도 같이 검증해야 하며, criterion 숫자만으로 운영 비용을 결정하지 않습니다.
## 득점 포인트
- parent·weighted child·gain을 모두 계산해 “곡률 차이”를 검산 가능한 상태로 만듭니다.
- 두 기준 사이 숫자의 단위 비교를 피하고 criterion별 후보 순위를 비교합니다.
- 선택 뒤 validation metric과 test 고정 경계를 설명합니다.

## 감점 포인트
- entropy gain .07이 Gini gain .03보다 항상 좋은 분할이라고 말합니다.
- 단순 `[1,1,0,0]` 예만 들고 순위가 실제로 달라지는 조건을 제시하지 않습니다.
- train impurity 0을 일반화 성공이나 calibrated probability로 해석합니다.

## 더 파고들 거리
- sample weight를 한 양성 표본에 부여했을 때 두 gain이 어떻게 달라지는지 계산해 보세요.
- 동일 gain tie에서 feature 순서와 seed가 결과에 주는 영향을 재현 테스트로 설계해 보세요.

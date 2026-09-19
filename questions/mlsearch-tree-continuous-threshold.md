---
id: mlsearch-tree-continuous-threshold
title: 연속 특징의 결정 트리 threshold 후보를 만들 때 정렬과 중복값은 어떤 역할을 하나요?
difficulty: 중하
category: 머신러닝
tags:
  - decision tree
  - threshold
  - continuous feature
related:
  - ml-loss-objective
  - ml-train-validation-test
---
# 연속 특징의 결정 트리 threshold 후보를 만들 때 정렬과 중복값은 어떤 역할을 하나요?

## 구두 답변
노드의 표본을 feature 값으로 정렬하고, 서로 다른 인접값 사이만 후보로 삼는 것이 기본 CART 탐색입니다. `[10,10,20,30]`에서는 같은 10 내부를 가르지 않고 10과 20 사이의 15, 20과 30 사이의 25를 봅니다. 동일값을 임의로 양쪽에 나누면 입력값만으로 재현되지 않는 split이 되기 때문입니다. `(10,0),(10,1),(20,1),(30,0)`에서 15의 children은 `[0,1] | [1,0]`, 25의 children은 `[0,1,1] | [0]`입니다. 각 class count로 weighted Gini나 entropy를 계산하고, prefix count를 이동시켜 후보마다 전체를 다시 세는 비용을 줄입니다. sample weight·missing·histogram 근사는 구현 계약을 바꿀 수 있습니다.


정렬은 단순한 구현 편의가 아니라 split이 입력값만으로 결정된다는 재현성 조건을 지킵니다. prefix count에서 cut 15 뒤의 왼쪽은 양성 1·음성 1, 오른쪽도 양성 1·음성 1이고, cut 25 뒤에는 왼쪽 양성 2·음성 1, 오른쪽 음성 1입니다. 따라서 parent와 child의 weighted impurity를 같은 criterion으로 비교할 수 있습니다. 값이 같은 행 사이를 나누면 동일한 10이 입력될 때 어느 쪽으로 갈지 별도 순서 정보가 필요해 모델 artifact가 불완전해집니다. 운영 범위 밖 값은 보통 학습된 가장자리 경계로 routing되지만, 이 동작은 구현 테스트로 확인합니다.

threshold 후보의 순서는 tie 처리와 feature 순서에 영향을 주므로 동일한 gain 후보를 만났을 때의 선택 규칙도 기록합니다. 정렬·prefix 구현의 단위 테스트에는 모든 값이 동일한 경우 후보가 0개가 되는 상태와 한쪽 child가 비는 경계가 승인되지 않는 상태도 포함합니다.
## 득점 포인트
- 정렬 후 고유 인접 경계만 후보라는 규칙과 중복값 내부 분할의 문제를 설명합니다.
- 두 threshold에서 왼쪽·오른쪽 label 상태를 실제로 추적합니다.
- threshold 후보는 train에서 만들고 validation은 설정 비교에 사용한다는 경계를 지킵니다.

## 감점 포인트
- 가능한 모든 실수값을 무한히 시험해야 한다고 말합니다.
- 운영 test 값이나 결측을 본 뒤 후보 목록을 다시 만들고 성능을 보고합니다.
- sample weight와 missing routing이 항상 기본 후보와 같다고 단정합니다.

## 더 파고들 거리
- 결측을 방향 라우팅하는 방법과 대치+indicator를 동일 validation 분할에서 비교해 보세요.
- exact split과 histogram 근사의 속도·정확도 비용을 feature 수별로 측정해 보세요.

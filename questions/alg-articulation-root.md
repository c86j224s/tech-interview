---
id: alg-articulation-root
title: 'DFS root가 articulation point가 되는 조건이 일반 정점의 low[child] 조건과 다른 이유는 무엇인가요?'
difficulty: 하
category: 알고리즘
tags:
  - articulation point
  - DFS root
  - low-link
related:
  - graph-representation
---
# DFS root가 articulation point가 되는 조건이 일반 정점의 low[child] 조건과 다른 이유는 무엇인가요?

## 구두 답변

DFS root에는 strict ancestor가 없기 때문에 일반 정점 조건을 그대로 적용하지 않고, DFS tree의 직접 child 수가 2개 이상인지 봅니다. root에서 각각 A와 B로 내려간 두 child subtree 사이에 root를 거치지 않는 간선이 없다면 root를 삭제하는 순간 두 subtree가 서로 다른 연결 요소가 됩니다. 그래서 root는 child count가 2 이상이면 articulation point이고, child가 하나이면 보통 절단점이 아닙니다.

non-root 정점 `v`는 `low[child] >= tin[v]`인 child가 하나라도 있으면 articulation point입니다. child가 v까지는 되돌아올 수 있어도 v의 조상보다 위로 올라갈 수 없다면 v를 삭제한 뒤 그 subtree가 나머지 그래프와 연결되지 않기 때문입니다. root에는 비교할 조상 `tin[parent]`가 없으므로 이 해석을 `low` 부등식 하나로 표현할 수 없습니다.

예를 들어 root R에서 A와 B를 각각 처음 방문하고 A subtree와 B subtree 사이에 back edge가 없다고 하겠습니다. R을 지우면 A 쪽과 B 쪽은 분리됩니다. 반대로 R의 child가 A 하나뿐이면 R을 지운 뒤에도 A subtree 전체가 하나의 연결 요소로 남으므로 root child count만으로는 절단점이 되지 않습니다. 구현은 각 DFS 시작마다 root child count를 0으로 초기화하고, root의 직접 tree edge만 세어야 합니다.

삭제 후 component를 직접 세면 조건이 더 분명해집니다. R-A, R-B에서 삭제 전 component가 하나이고 R 삭제 후 두 개가 되지만, R-A-X에서 R 삭제 후에도 A-X 한 component만 남습니다. R-A와 R-B 사이에 평행 간선이 여러 개 있어도 root child는 정점 방문이 아니라 새 tree edge의 직접 발견 수로 셉니다. 한 간선은 tree edge, 다른 간선은 back edge가 되어 같은 child subtree를 두 번 세지 않습니다. 비연결 요소 C-D를 다음 root로 처리할 때 R의 count를 재사용하지 않으며, 전역 timer만 이어집니다. 이 검사를 작은 그래프의 삭제 기준 구현과 비교하면 root 예외와 edge-ID 정책을 동시에 검증할 수 있습니다.

## 득점 포인트

- root 조건을 `child count >= 2`, non-root 조건을 `low[child] >= tin[v]`로 분리합니다.
- root에는 parent나 strict ancestor가 없다는 구조적 이유를 설명합니다.
- root의 직접 child와 descendant를 혼동하지 않고 연결 요소 분리를 그립니다.
- 비연결 그래프의 각 DFS root마다 child count를 새로 시작한다고 말합니다.

## 감점 포인트

- root에도 non-root의 `low[child] >= tin[v]`만 적용하면 충분하다고 합니다.
- root가 child 하나를 가진 경우에도 항상 articulation이라고 단정합니다.
- DFS 전체의 방문 자손 수를 root child 수로 세어 조건을 판정합니다.
- bridge의 strict `>` 조건을 articulation root 판정에 그대로 사용합니다.

## 더 파고들 거리

- root가 아닌 정점에서 equality와 strict greater-than이 각각 articulation·bridge에 어떻게 쓰이는지 한 그래프로 비교해 보세요.
- 고립 정점과 여러 연결 요소가 있는 그래프에서 root 표식을 어떻게 초기화하고 검증할까요?

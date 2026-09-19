---
id: alg-bridge-parallel-edge
title: 무방향 그래프에서 DFS parent로 가는 평행 간선이 두 개라면 bridge 판정 코드는 무엇을 조심해야 하나요?
difficulty: 중하
category: 알고리즘
tags:
  - bridge
  - low-link
  - parallel edge
related:
  - graph-representation
---
# 무방향 그래프에서 DFS parent로 가는 평행 간선이 두 개라면 bridge 판정 코드는 무엇을 조심해야 하나요?

## 구두 답변

부모 정점 번호가 같다는 이유로 모든 부모 간선을 건너뛰면 안 되고, DFS가 방금 타고 들어온 **간선 하나만** 건너뛰어야 합니다. 평행 간선 두 개가 `u-v` 사이에 있다면 하나는 tree edge가 되고 다른 하나는 `v`의 서브트리에서 `u`로 돌아가는 back edge입니다. 두 번째 간선이 `low[v]`를 `tin[u]`까지 낮추므로 `low[v] > tin[u]`가 성립하지 않고 tree edge는 bridge가 아닙니다.

그래서 인접 리스트 항목을 단순한 이웃 정점이 아니라 `(to, edgeId)`로 저장합니다. `dfs(v, parentEdgeId)`에서 `edgeId == parentEdgeId`인 항목 하나만 skip하고, 그 외에 이미 방문한 정점으로 향하는 간선은 `low[v] = min(low[v], tin[to])`로 반영합니다. 부모 정점 번호만 저장한 코드는 두 평행 간선을 모두 skip해 `low[v]`를 높게 남기고, 실제로는 cycle이 있는데 bridge라고 보고할 수 있습니다.

예를 들어 `A-B`를 두 번 저장하고 첫 번째 간선으로 B에 내려갔다면 B에서 두 번째 `A` 항목은 parent vertex가 같아도 다른 edge ID입니다. 이를 back edge로 처리하면 `low[B] == tin[A]`가 됩니다. equality는 우회 연결이 있다는 뜻이므로 bridge 조건의 strict `>`와도 맞습니다. 역방향 인접 항목에는 같은 논리 간선 ID를 붙여야 하며, 자기 간선을 허용하는지는 별도 입력 정책으로 정해야 합니다.

이 차이는 adjacency를 만들 때부터 보장해야 합니다. 논리 간선 7을 양쪽에 저장한 항목과 논리 간선 9를 양쪽에 저장한 항목이 같은 edge ID를 공유해야 하며, 방향별 배열 위치를 ID로 착각하면 역방향 parent edge를 건너뛸 수 없습니다. 간선 하나를 실제로 삭제해 연결 요소를 세는 기준 구현에서는 ID 7 삭제 후에도 ID 9가 남아 요소 수가 변하지 않습니다. self-loop는 보통 두 끝점이 같은 간선이라 bridge가 아니지만, 입력에서 허용할지와 low 갱신에서 무시할지를 명시하는 편이 안전합니다. 이 작업은 탐색 자체는 O(V+E)이지만 깊은 경로의 재귀 스택이 V까지 커질 수 있다는 운영 비용도 가집니다.

## 득점 포인트

- 부모 정점과 부모 **간선**을 구별하고, incoming edge ID 하나만 skip한다고 설명합니다.
- `low[child] > tin[parent]`가 bridge 조건이며 equality는 평행·back edge 때문에 bridge가 아니라고 연결합니다.
- `u-v` 두 간선에서 한 간선 삭제 뒤 다른 간선이 남는 구체 상태를 추적합니다.
- 무방향 간선의 양쪽 인접 항목이 같은 edge ID를 공유해야 함을 언급합니다.

## 감점 포인트

- `to == parent`인 모든 항목을 건너뛰는 코드를 안전하다고 말합니다.
- 평행 간선을 단순히 중복 입력 오류로 삭제해 버리고 입력 계약을 설명하지 않습니다.
- bridge 조건에 `>=`를 써 equality도 bridge라고 판정합니다.
- 이미 방문한 정점에 대해 항상 `low[to]`를 사용해 back edge 처리를 설명합니다.

## 더 파고들 거리

- 평행 간선과 자기 간선을 함께 허용하는 그래프에서 edge ID를 어떻게 생성하고 결과에 보존할까요?
- 간선 삽입으로 bridge가 cycle에 흡수될 때 정적 low-link 재계산과 동적 자료구조는 어떻게 달라질까요?

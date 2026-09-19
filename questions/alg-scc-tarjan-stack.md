---
id: alg-scc-tarjan-stack
title: 'Tarjan에서 low[v]가 tin[v]와 같을 때 스택에서 어디까지 꺼내 하나의 SCC를 만들나요?'
difficulty: 중하
category: 알고리즘
tags:
  - SCC
  - Tarjan
  - low-link
  - stack
related:
  - algorithm-topological-cycle
---
# Tarjan에서 low[v]가 tin[v]와 같을 때 스택에서 어디까지 꺼내 하나의 SCC를 만들나요?

## 구두 답변

`low[v]==tin[v]`는 현재 미확정 스택에서 v보다 더 이른 조상으로 올라가는 경로가 없다는 뜻이므로 v가 SCC root입니다. 이때 스택의 top에서 하나씩 pop하여 v를 만나는 순간까지의 정점을 한 component로 묶습니다. v 자신도 포함하고, v 위에 있는 정점만 꺼내야 합니다. `A→B`, `B→A`를 A에서 DFS하면 A와 B가 스택에 있고 B의 back edge가 `low[B]`를 `tin[A]`까지 낮춥니다. A에서 root 조건이 성립하면 pop 순서는 `B`, `A`, 결과는 `{A,B}`입니다.

스택은 단순한 현재 재귀 경로가 아니라 아직 SCC가 확정되지 않은 정점의 저장소입니다. 자식 DFS가 끝나면 `low[v]=min(low[v],low[to])`를 반영하고, 이미 방문한 이웃 `to`에 대해서는 `onStack[to]`일 때만 `tin[to]`를 후보로 씁니다. `to`가 이전에 pop되어 다른 component에 배정됐다면 현재 component로 돌아가는 back edge가 아니므로 무시합니다. 방문된 이웃을 모두 low 후보로 쓰면 앞서 닫힌 SCC를 다시 연결해 잘못 합칠 수 있습니다.

`A→B→A`와 `B→C`에서는 C에 되돌아오는 간선이 없으므로 C는 별도 SCC가 되고, pop 직후 `onStack[C]=false`로 표시합니다. 최종 component ID나 pop 순서는 DFS 인접 순서에 따라 달라도 partition은 같아야 합니다. disconnected graph는 모든 미방문 정점에서 DFS를 시작하고, 재귀 깊이가 큰 입력에서는 call stack 한계도 선택 비용에 포함합니다.

`low` 갱신의 구분은 코드 한 줄의 순서에도 영향을 줍니다. 아직 방문하지 않은 자식이면 재귀가 끝난 뒤 `low[to]`를 사용하고, 이미 방문한 정점이면 `onStack[to]`일 때만 `tin[to]`를 사용합니다. 이미 방문한 이웃이 pop된 상태라면 그 이웃으로 가는 간선은 low 갱신에서 제외합니다. 예를 들어 C를 먼저 방문해 별도 SCC로 확정한 뒤 A→C를 처리할 때, onStack을 검사하지 않으면 A의 low를 옛 C의 tin으로 잘못 낮출 수 있습니다. 새로 방문한 DFS 자식의 low 전파와 이미 방문한 이웃의 onStack 검사는 다른 분기입니다.


## 득점 포인트

- `low[v]==tin[v]`를 SCC root 판정으로 해석합니다.
- top에서 v까지, v를 포함해 pop한다는 정확한 경계를 말합니다.
- `A↔B`에서 `B,A`가 빠져 `{A,B}`가 되는 상태를 추적합니다.
- stack 안의 back edge와 stack 밖 확정 정점을 구분합니다.
- pop 후 `onStack=false`와 disconnected DFS를 언급합니다.

## 감점 포인트

- root 조건에서 스택 전체를 pop합니다.
- v를 남겨 두어 다음 component와 합칩니다.
- 방문된 모든 이웃의 `tin`을 low 후보로 사용합니다.
- 이미 확정된 stack 밖 정점을 현재 SCC로 다시 연결합니다.
- 한 시작점의 DFS가 그래프 전체를 자동으로 처리한다고 가정합니다.

## 더 파고들 거리

- 코드에서 DFS tree edge, 아직 stack에 있는 back edge, 확정된 cross edge를 어떤 상태값으로 구별하나요?
- 재귀 깊이가 V에 가까울 때 반복형 Tarjan과 Kosaraju 중 무엇을 선택할지 설명해 보세요.

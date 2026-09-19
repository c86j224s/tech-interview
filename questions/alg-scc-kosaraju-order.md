---
id: alg-scc-kosaraju-order
title: Kosaraju에서 첫 DFS의 종료 순서를 저장한 뒤 transpose를 역순으로 탐색하는 이유는 무엇인가요?
difficulty: 중하
category: 알고리즘
tags:
  - SCC
  - Kosaraju
  - transpose
related:
  - algorithm-topological-cycle
---
# Kosaraju에서 첫 DFS의 종료 순서를 저장한 뒤 transpose를 역순으로 탐색하는 이유는 무엇인가요?

## 구두 답변

첫 DFS가 남기는 것은 발견 순서가 아니라 각 정점의 종료 순서입니다. 응축 그래프에서 서로 다른 SCC 사이에 `C1→C2`가 있으면 첫 pass의 component별 최대 종료 시각이 두 component의 방향을 구분하는 순서가 됩니다. 간선을 뒤집은 transpose에서는 방향이 `C2→C1`이 되므로, 마지막으로 끝난 정점부터 transpose DFS를 시작하면 한 SCC 안에서 수집이 닫히고 이미 처리하지 않은 다른 SCC로 새지 않습니다. 이 finish-order와 transpose의 조합이 두 번째 DFS의 경계를 만든다는 것이 이유입니다.

예를 들어 `{A,B}` 내부에 `A↔B`, `{C,D}` 내부에 `C↔D`, 그리고 `B→C`가 있다고 하겠습니다. 원래 응축 간선은 `X→Y`, transpose는 `Y→X`입니다. 첫 pass의 종료시각에 따라 X가 먼저 두 번째 시작점으로 선택되는 순서를 얻으면 transpose에서 X에서 나가는 외부 간선이 없어 X만 pop할 수 있습니다. 반대로 임의 discovery order를 사용하면 transpose 탐색이 이미 다른 component로 연결된 방향을 따라 경계를 넘을 수 있습니다. 실제 정점 목록은 인접 리스트 순서에 따라 달라도 분할은 같아야 합니다.

구현에서는 첫 pass의 finish 배열을 보존하고, 두 번째 pass 전에 `visited`만 초기화합니다. 각 두 번째 DFS가 방문한 정점에 새 component ID를 부여하며, disconnected graph라면 첫 pass도 모든 미방문 정점에서 시작합니다. Kahn 위상 정렬의 큐 순서와 finish order는 같은 자료가 아니고, transpose를 만들 때 원래 그래프의 adjacency를 덮어쓰지 않도록 두 표현을 분리하거나 역간선을 별도로 저장해야 합니다.

두 번째 pass의 각 시작점에서 모은 정점은 transpose에서 도달 가능한 집합이지만, finish 우선순위가 보장하는 방향 때문에 그 집합이 정확히 하나의 원래 SCC가 됩니다. 따라서 첫 pass의 배열을 단순히 역순으로 `for` 순회하거나 stack에서 pop하는 것은 괜찮지만, 그 배열을 정점 번호순으로 다시 정렬하면 안 됩니다. 테스트에서는 `{A,B}`와 `{C,D}`의 component ID가 0,1인지 1,0인지를 고정하지 말고, 각 ID 내부의 상호 도달성과 ID 사이의 단방향 간선을 검사해야 인접 리스트 순서에 독립적인 결과가 됩니다.


## 득점 포인트

- discovery order가 아니라 exit/finish time을 쓰는 목적을 말합니다.
- `X→Y`가 transpose에서 `Y→X`가 되는 상태를 추적합니다.
- 두 번째 pass에서 방문 표식만 초기화하고 finish order는 보존한다고 설명합니다.
- `{A,B}`, `{C,D}` 예에서 component 경계가 닫히는 방향을 보여 줍니다.
- disconnected graph와 component ID 재할당을 구현 조건으로 제시합니다.

## 감점 포인트

- 첫 DFS에서 발견한 순서를 그대로 두 번째 pass에 사용합니다.
- transpose에서도 원래 방향 간선을 동시에 따라야 한다고 말합니다.
- 두 번째 DFS 방문 정점들을 하나의 새 component로 표시하지 않습니다.
- 첫 pass의 visited를 초기화하지 않아 두 번째 탐색이 비어 버립니다.
- Kahn의 진입차수 큐 순서를 Kosaraju finish order와 같은 의미로 취급합니다.

## 더 파고들 거리

- Tarjan의 `low`와 stack이 finish-order 저장 없이 같은 SCC 경계를 어떻게 확정하나요?
- transpose adjacency를 별도로 저장하는 비용과 edge 목록을 뒤집어 재구성하는 비용을 어떻게 비교하나요?

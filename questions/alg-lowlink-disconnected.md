---
id: alg-lowlink-disconnected
title: 그래프가 여러 연결 요소로 나뉘었을 때 bridge와 articulation point를 모두 찾으려면 DFS를 어떻게 시작해야 하나요?
difficulty: 하
category: 알고리즘
tags:
  - low-link
  - disconnected graph
  - DFS
related:
  - graph-representation
---
# 그래프가 여러 연결 요소로 나뉘었을 때 bridge와 articulation point를 모두 찾으려면 DFS를 어떻게 시작해야 하나요?

## 구두 답변

방문하지 않은 각 정점에서 DFS를 새로 시작해야 합니다. 전역 `visited`, `tin`, `low` 배열은 유지하지만 `for v in vertices` outer loop가 모든 정점을 검사하면서 아직 방문되지 않은 정점을 새 DFS root로 넘깁니다. 한 source에서 시작한 DFS는 다른 연결 요소로 건너갈 수 없으므로 한 번만 호출하면 그 요소 밖의 bridge와 articulation point를 놓칩니다.

예를 들어 A-B와 C-D가 별도 요소라면 A에서 시작한 DFS는 A-B의 간선만 봅니다. outer loop가 C를 만났을 때 두 번째 DFS를 시작해야 C-D도 bridge로 기록됩니다. DFS root의 child count는 각 호출마다 0으로 초기화해야 합니다. 첫 요소 root의 child 수를 다음 요소에 더하면 child가 하나뿐인 두 번째 root를 잘못 articulation으로 표시할 수 있습니다.

전역 discovery timer는 DFS가 이어지는 순서대로 계속 증가해도 됩니다. 중요한 것은 각 정점이 한 번만 방문되고, 재귀에서 부모로 들어온 간선 하나만 제외되며, root 여부와 직접 child count가 호출별로 구분되는 것입니다. 모든 요소를 돌면 시간은 인접 리스트 기준 `O(V+E)`입니다. 설명용으로는 A-B, C-D, 고립 정점을 함께 넣어 각 요소의 root 상태가 독립적인지 확인하겠습니다.

예를 들어 요소 하나를 R-A, R-B로 만들고 다른 요소를 C-D, 마지막으로 E를 고립시킵니다. A와 B가 R의 직접 child가 되면 R 제거 뒤 `{A}`와 `{B}`가 남아 articulation이고, C-D는 두 번째 DFS에서 별도의 bridge입니다. E는 방문만 되고 결과에는 절단 구조가 없습니다. timer를 1,2,...로 계속 올리는 것은 discovery 순서의 전역 일관성을 위한 선택이고, `rootChildren`을 매 호출 0으로 두는 것은 root 판정의 지역 상태입니다. 각 tree edge의 역방향 adjacency에서는 parentEdgeId 하나만 skip해야 하므로 요소가 바뀌어도 edge ID 계약은 유지됩니다. 작은 기준 구현으로 간선·정점을 실제로 삭제해 component 수를 비교하면 누락을 찾을 수 있습니다.

## 득점 포인트

- 전역 `visited`를 유지하면서 모든 미방문 정점에서 outer DFS를 시작합니다.
- 각 DFS 호출의 root child count를 0으로 초기화하고 직접 child만 센다고 설명합니다.
- 연결 요소별로 bridge와 articulation 결과가 누락되는 구체 입력을 듭니다.
- timer는 전역으로 계속 증가해도 되고, root 판정 상태는 호출별이라는 차이를 구분합니다.

## 감점 포인트

- source 하나에서 실행한 DFS 결과가 전체 그래프를 덮는다고 말합니다.
- 연결 요소가 바뀔 때 `visited`를 지워 이미 방문한 정점을 다시 순회합니다.
- root child count를 전역 누적 변수로 두어 서로 다른 요소의 자식을 합칩니다.
- 고립 정점을 누락해 그래프 정점 수와 결과 배열의 의미를 깨뜨립니다.

## 더 파고들 거리

- 재귀 깊이가 정점 수까지 커질 때 반복형 DFS로 low-link 상태를 어떻게 저장할까요?
- 간선 ID를 쓰는 비연결 그래프에서 각 root의 parent edge와 결과를 어떻게 초기화할까요?

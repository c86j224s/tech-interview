---
id: alg-flow-edmonds-karp-complexity
title: >-
  Edmonds-Karp가 Ford-Fulkerson과 같은 증가 경로 방법인데도 capacity 값에 독립적인 O(VE²) 상한을 갖는
  이유는 무엇인가요?
difficulty: 중하
category: 알고리즘
tags:
  - Edmonds-Karp
  - BFS
  - complexity
related:
  - bfs-dfs-shortest-path
---
# Edmonds-Karp가 Ford-Fulkerson과 같은 증가 경로 방법인데도 capacity 값에 독립적인 O(VE²) 상한을 갖는 이유는 무엇인가요?

## 구두 답변

Edmonds–Karp는 매번 임의의 증가 경로가 아니라 BFS가 찾은 간선 수 기준 최단 residual path를 선택합니다. 이 선택 때문에 어떤 간선이 최단 경로의 병목으로 포화된 뒤 같은 방식으로 다시 중요한 간선이 되려면 source에서 그 간선까지 또는 그 이후의 BFS 거리가 증가해야 합니다. 한 간선이 임계적으로 사용되는 횟수가 제한되어 전체 augmentation 횟수는 `O(VE)`가 되고, 각 BFS가 `O(E)`이므로 `O(VE²)`가 됩니다.

Ford–Fulkerson의 일반적인 DFS 선택은 capacity와 경로 선택에 따라 augmentation 횟수가 달라질 수 있습니다. 큰 capacity를 한 번에 많이 보내는 경우도 있지만, 나쁜 경로 선택은 작은 증가를 반복할 수 있어 숫자 capacity에 기대는 분석이 됩니다. Edmonds–Karp의 bound는 보낼 총량 `F`를 반복 횟수로 세는 것이 아니라, BFS 층 거리와 포화 edge의 재사용 횟수를 세는 그래프 구조 분석입니다.

따라서 이 상한을 주장하려면 실제 구현이 매 반복 BFS로 양의 residual만 탐색하고 parent edge를 기록해야 합니다. 임의 DFS를 쓰면서 같은 bound를 붙이거나, 인접 리스트 대신 비싼 자료구조를 사용하고 한 BFS를 `O(E)`로 보지 않는 것은 계약 밖입니다. 이 분석은 최대 flow 값이 몇인지와 무관하다는 의미이지, 입력을 binary search한다는 뜻은 아닙니다.

이 분석에서 “임계적 사용”은 단순히 어떤 간선을 한 번 방문했다는 뜻이 아닙니다. BFS 최단 경로의 병목으로 포화되어 이후 residual에서 다시 같은 방향 후보가 되려면, 그 간선을 포함한 최단거리 수준이 충분히 증가해야 한다는 관계를 세는 것입니다. 그래서 유량값이 10^9이어도 한 번에 큰 bottleneck을 보낼 수 있고, 반대로 작은 capacity라도 그래프 구조에 따라 많은 augment가 발생할 수 있습니다. 인접 리스트에서 각 BFS가 모든 residual edge를 최대 한 번 검사한다는 전제가 빠지면 `O(E)` 항도 다시 확인해야 합니다.


## 득점 포인트

- BFS 최단 residual path 선택이 거리 단조 증가와 연결된다고 설명한다.
- augmentation 횟수 `O(VE)`와 BFS 한 번 `O(E)`를 곱한다.
- Ford–Fulkerson의 경로 선택·capacity 의존성과 구별한다.

## 감점 포인트

- 증가 경로를 아무렇게나 선택해도 Edmonds–Karp 상한이라고 한다.
- `O(VE²)`를 flow value `F`에 비례하는 상한으로 설명한다.
- BFS가 residual reverse edge를 제외해도 분석이 유지된다고 가정한다.

## 더 파고들 거리

- adjacency matrix에서 BFS를 구현할 때 한 반복의 간선 검사 비용과 최종 상한 표기를 어떻게 바꿔야 하나요?
- Dinic의 level graph와 Edmonds–Karp의 한 경로 BFS 선택은 어떤 공통 불변식과 차이를 가지나요?

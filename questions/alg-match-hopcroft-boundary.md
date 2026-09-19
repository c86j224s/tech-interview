---
id: alg-match-hopcroft-boundary
title: Kuhn의 반복 DFS가 느린 큰 이분 그래프에서 Hopcroft-Karp로 바꿔도 어떤 계약은 그대로인가요?
difficulty: 중하
category: 알고리즘
tags:
  - matching
  - Hopcroft-Karp
  - augmenting path
related:
  - bfs-dfs-shortest-path
---
# Kuhn의 반복 DFS가 느린 큰 이분 그래프에서 Hopcroft-Karp로 바꿔도 어떤 계약은 그대로인가요?

## 구두 답변

알고리즘을 Kuhn에서 Hopcroft–Karp로 바꿔도 문제의 결과 계약은 최대 카디널리티 매칭이어야 한다는 점과, 증가 경로가 더 이상 없으면 최적이라는 조건은 그대로입니다. 달라지는 것은 증가 경로를 찾는 방식입니다. Hopcroft–Karp는 BFS로 현재 최단 증가 경로의 층을 만들고 DFS로 그 층을 따르는 여러 vertex-disjoint 경로를 한 phase에서 찾아 매칭을 묶어 늘립니다.

Kuhn은 시작 정점 하나를 DFS로 시도하고 성공하면 다음 시작점으로 넘어가는 방식이라 같은 영역을 반복해서 훑을 수 있습니다. Hopcroft–Karp는 먼저 자유 정점에서 BFS 층을 만들고, 최단 길이 경로만 따라가도록 DFS를 제한합니다. 한 phase에서 여러 증가 경로를 뒤집으므로 큰 희소 그래프에서 반복 DFS의 병목을 줄일 수 있습니다. 그래도 각 성공 경로는 matched/unmatched 간선 교대를 만족해야 하고, 끝점은 자유 상태여야 합니다.

예를 들어 같은 입력에서 두 알고리즘이 서로 다른 간선을 선택해도 됩니다. 하나는 `L1-R1`, `L2-R2`, 다른 하나는 `L1-R2`, `L2-R1`을 반환할 수 있습니다. 비교할 것은 edge ID가 동일한지가 아니라 각 정점이 최대 한 번만 쓰이는지, 간선이 입력에 존재하는지, 매칭 크기가 최대값과 같은지입니다. Hopcroft–Karp로 바꾼다고 가중치 합을 최대화하거나 일반 그래프 매칭을 해결하는 것은 아니므로 모델을 먼저 확인해야 합니다.

계약을 바꿀 때 특히 확인할 것은 “최대”의 의미입니다. Kuhn과 Hopcroft–Karp 모두 각 정점의 차수가 1 이하인 매칭을 반환하고, 더 이상 증가 경로가 없을 때 cardinality가 최대라는 모델을 공유합니다. 하지만 Hopcroft–Karp가 phase에서 모은 경로는 서로 정점을 공유하지 않아야 동시에 뒤집을 수 있습니다. 예를 들어 두 경로가 같은 `R2`를 끝점으로 사용하면 한 phase의 일괄 갱신 후 `R2`의 상대가 두 명이 되는 오류가 생깁니다. 따라서 속도 교체의 검증은 edge set 동일성보다 불변식, cardinality, 입력 간선 여부를 비교해야 합니다.


## 득점 포인트

- 두 알고리즘 모두 증가 경로 부재와 maximum cardinality를 결과 계약으로 공유한다고 말한다.
- BFS 층과 DFS phase의 역할을 구분한다.
- 서로 다른 유효 matching edge set도 cardinality·endpoint 불변식으로 비교한다.

## 감점 포인트

- Hopcroft–Karp가 모든 종류의 매칭 최적화 문제를 해결한다고 말한다.
- BFS를 쓴다는 이유만으로 최단 경로 문제와 같은 보장을 주장한다.
- 반환된 간선 집합이 한 가지 기준 해와 다르면 틀렸다고 판정한다.

## 더 파고들 거리

- shortest augmenting path phase에서 vertex-disjoint가 아닌 경로를 함께 취급하면 어떤 endpoint 충돌이 생기는지 설명해 보세요.
- 최대 카디널리티가 아니라 최대 weight matching이 필요할 때 문제 표현과 알고리즘 선택이 어떻게 달라지는지 비교해 보세요.

---
id: graph-search
title: BFS에서 Dijkstra와 A*까지
topic: 알고리즘
summary: 간선 수·비용·휴리스틱의 차이로 탐색을 선택하고 큐와 거리 갱신을 따라갑니다.
questionIds: [bfs-dfs-shortest-path, astar-heuristic, astar-open-closed, algorithm-dijkstra-negative-edge, graph-representation, jps-symmetry-pruning, jps-plus-preprocessing]
---

# BFS에서 Dijkstra와 A*까지

## 최소화하는 값을 먼저 정합니다

같은 간선 비용이면 가장 적은 간선 수의 경로가 최저 비용입니다. 비용이 다르면 간선 수가 적어도 총비용은 더 클 수 있습니다. 알고리즘 선택은 그래프 모양보다 **무엇을 최소화하는가**에서 시작합니다.

| 조건 | 출발점 |
| --- | --- |
| 모든 간선 비용이 같음 | BFS |
| 비용이 0 또는 1 | 0-1 BFS |
| 일반 비음수 비용 | Dijkstra |
| 비음수 비용과 적절한 목표 하한 추정 | A* |
| 음수 간선 허용 | Bellman–Ford 등 조건에 맞는 방법 |

DFS는 연결 탐색·백트래킹 등에 유용하지만 첫 발견 경로가 최단이라는 일반 보장은 없습니다.

## BFS의 층별 확장

```text
distance[*] = unknown
queue = empty
for each unique source:
    distance[source] = 0
    queue.push_back(source)
while queue not empty:
    u = queue.pop_front()
    for v in neighbors(u):
        if distance[v] is unknown:
            distance[v] = distance[u] + 1
            parent[v] = u
            queue.push_back(v)
```

큐에 넣을 때 방문을 표시하면 같은 노드를 여러 번 넣는 일을 줄입니다. 거리 0인 층 다음에 거리 1, 2가 처리되므로 동일 비용에서 첫 발견 거리가 최소입니다. 인접 리스트에서는 O(V+E) 시간, 거리·큐·부모에 O(V) 보조 공간을 사용합니다.

여러 시작점을 모두 거리 0으로 넣으면 각 정점에서 가장 가까운 시작점까지의 거리를 한 번에 구합니다. 동점 원천의 선택은 큐·이웃 순서에 따라 다를 수 있습니다.

## Dijkstra의 거리 완화

```text
best[source] = 0
heap.push((0, source))
while heap not empty:
    (d, u) = heap.pop_min()
    if d != best[u]: continue       // 오래된 후보
    for (v, cost) in edges(u):
        candidate = d + cost
        if candidate < best[v]:
            best[v] = candidate
            parent[v] = u
            heap.push((candidate, v))
```

현재 최소 거리 후보를 꺼냈을 때 나중 경로로 더 작아지지 않는다는 근거는 **비음수 간선**입니다. `S→A=2, S→B=5, B→A=-4`에서는 A를 2로 확정한 뒤 1의 경로가 나올 수 있어 이 전제가 깨집니다.

이진 힙과 인접 리스트를 사용하는 구현은 일반적으로 O((V+E) log V) 규모의 비용을 갖습니다. 지연 삭제 구현의 힙 항목 수와 메모리는 실제 완화 횟수에도 영향을 받습니다.

## A*가 추가하는 것

A*는 우선순위를 `f=g+h`로 둡니다. g는 지금까지의 실제 비용이고 h는 목적지까지의 추정 비용입니다. h가 실제 남은 비용을 넘지 않으면 허용적입니다. 인접 노드에 대해 `h(u) <= cost(u,v)+h(v)`이면 일관적입니다.

허용적이지만 일관적이지 않은 h에서는 더 싼 g를 찾았을 때 closed 노드를 다시 열어야 할 수 있습니다. h=0은 Dijkstra와 같은 우선순위를 만듭니다. 목표를 **처음 발견**한 순간과 올바른 종료 조건에서 **확정**하는 순간을 구분해야 합니다.

4방향 균일 격자의 Manhattan 거리, 대각 이동을 허용한 격자의 적절한 하한처럼 실제 이동 모델과 h를 맞춥니다. 벽 모서리 통과·에이전트 반경·지형 비용이 바뀌면 기존 추정과 가지치기 전제를 다시 검증합니다.

## 게임 경로에서 더 필요한 계약

계산한 경로는 특정 맵·목표·에이전트 프로필 버전의 결과입니다. 문이 닫히거나 목표가 바뀌면 현재 실행 전 재검증이 필요합니다. 경로 스무딩도 실제 footprint와 비용을 보존하는지 검사해야 합니다. JPS는 특정 격자의 대칭 경로를 제거하는 최적화이며 임의 가중 그래프의 만능 대체재가 아닙니다.

## 직접 확인하기

작은 그래프에서 모든 시작·목표 쌍을 비교합니다. BFS는 단위 비용 Dijkstra와, A*는 h=0 기준과 거리·도달성을 대조합니다. 경로 모양이 다르다는 이유만으로 실패로 보지 않고 경로의 유효 간선·총비용·부모 복원을 확인합니다. 음수·0 비용·동점·도달 불가·순환·늦은 더 싼 경로를 별도 사례로 둡니다.

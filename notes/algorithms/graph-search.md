---
id: graph-search
title: BFS의 층별 탐색과 최단 거리
topic: 알고리즘
summary: 동일한 이동 비용에서 큐의 층 순서와 방문 시점이 최단 거리와 부모 복원을 어떻게 보장하는지 작은 그래프로 추적합니다.
questionIds: [bfs-dfs-shortest-path]
---

# BFS의 층별 탐색과 최단 거리

## 먼저 최단의 의미를 고정합니다

길찾기에서 “가장 짧다”는 말은 먼저 무엇을 세는지 정해야 합니다. 모든 이동이 같은 비용이고 한 간선을 건널 때마다 비용이 1씩 늘어난다면, 총비용을 최소화하는 일은 간선 수를 최소화하는 일과 같습니다. 이때 출발점에서 가까운 층을 모두 처리한 뒤 다음 층으로 넘어가는 **너비 우선 탐색**(Breadth-First Search), 즉 BFS가 맞습니다.

반대로 DFS는 한 가지 가지를 깊게 따라가므로 목표를 먼저 만났다는 사실만으로 최단 경로가 되지 않습니다. 간선마다 비용이 다르면 간선 수가 적은 길이 총비용이 더 클 수도 있으므로 BFS의 보장도 사라집니다. 이 노트의 전제는 방향 그래프의 모든 간선 비용이 1이고, 이웃을 읽는 동안 그래프가 바뀌지 않는다는 것입니다. 함수에 넘기는 `source`, `target`, 이웃 정점은 먼저 그래프의 유효한 정점 집합에 속하는지 검증해야 하며, 존재하지 않는 정점을 `INF`로 표시해 정상적인 도달 불가 정점처럼 다루지 않습니다.

## 예제 그래프를 거리 층으로 펼칩니다

다음 그래프는 `S`에서 `G`로 가는 두 가지 방향을 함께 보여 줍니다. 이웃은 표에 적은 순서대로 읽는다고 하겠습니다.

| 정점 | 나가는 이웃(간선 비용) |
| --- | --- |
| `S` | `A(1)`, `B(1)` |
| `A` | `C(1)`, `D(1)` |
| `B` | `D(1)` |
| `C` | `G(1)` |
| `D` | `E(1)` |
| `E` | `G(1)` |
| `G` | 없음 |

`S→A→C→G`는 세 번 이동하고, `S→A→D→E→G`는 네 번 이동합니다. `B→D`는 `D`에 도착하는 또 하나의 방법이지만 `A`에서 이미 거리 2로 발견한 뒤입니다. 그래프의 구조를 거리 층으로 읽으면 아래와 같습니다.

```diagram
{"title":"BFS의 층별 확장","caption":"화살표는 단위 비용의 방향 간선만 나타냅니다. 간선을 처리한 뒤 새 정점을 큐 뒤에 넣는 enqueue 상태 변화는 아래 표와 본문에서 따로 추적합니다. 노드의 detail은 출발점에서 기록된 거리입니다.","rows":[[{"id":"s","label":"S","detail":["거리 0","시작"]}],[{"id":"a","label":"A","detail":["거리 1"]},{"id":"b","label":"B","detail":["거리 1"]}],[{"id":"c","label":"C","detail":["거리 2"]},{"id":"d","label":"D","detail":["거리 2"]}],[{"id":"g","label":"G","detail":["거리 3","목표"]},{"id":"e","label":"E","detail":["거리 3"]}]],"edges":[{"from":"s","to":"a","label":"1"},{"from":"s","to":"b","label":"1"},{"from":"a","to":"c","label":"1"},{"from":"a","to":"d","label":"1"},{"from":"b","to":"d","label":"1"},{"from":"c","to":"g","label":"1"},{"from":"d","to":"e","label":"1"},{"from":"e","to":"g","label":"1"}]}
```

그림의 핵심은 `A`와 `B`를 모두 처리하기 전에는 거리 2인 `C`, `D`를 처리하지 않는다는 점입니다. 그림의 화살표는 그래프에 존재하는 간선이고, 큐의 뒤 삽입은 그 간선을 실제로 처리한 뒤의 별도 상태 변화입니다. `D`가 `B`에서도 보이지만 이미 발견된 정점은 다시 큐에 넣지 않습니다. 이 방문 시점을 큐 삽입 때 고정해야 중복과 부모 덮어쓰기를 피할 수 있습니다.

## 큐와 거리를 한 단계씩 추적합니다

큐의 왼쪽을 다음에 꺼낼 위치로 표시했습니다. 거리 표에는 이미 발견한 정점만 적었습니다. 이 노트의 반환 계약은 항상 전체 `distance`와 `parent`를 제공하므로, 목표를 발견하거나 큐에서 꺼내도 전체 결과를 위해 큐가 빌 때까지 계속합니다.

| 단계 | 꺼낸 정점과 처리 | 큐(앞→뒤) | `distance` |
| ---: | --- | --- | --- |
| 0 | 시작 상태 | `[S]` | `{S: 0}` |
| 1 | `S`에서 `A=1`, `B=1` 발견 | `[A, B]` | `{S: 0, A: 1, B: 1}` |
| 2 | `A`에서 `C=2`, `D=2` 발견 | `[B, C, D]` | `{S: 0, A: 1, B: 1, C: 2, D: 2}` |
| 3 | `B` 처리, `D`는 이미 발견됨 | `[C, D]` | `{S: 0, A: 1, B: 1, C: 2, D: 2}` |
| 4 | `C`에서 `G=3` 발견 | `[D, G]` | `{S: 0, A: 1, B: 1, C: 2, D: 2, G: 3}` |
| 5 | `D`에서 `E=3` 발견 | `[G, E]` | `{S: 0, A: 1, B: 1, C: 2, D: 2, E: 3, G: 3}` |
| 6 | `G`를 꺼내도 전체 처리를 계속 | `[E]` | `{S: 0, A: 1, B: 1, C: 2, D: 2, E: 3, G: 3}` |
| 7 | `E` 처리, `G`는 이미 발견됨 | `[]` | `{S: 0, A: 1, B: 1, C: 2, D: 2, E: 3, G: 3}` |

`G`의 부모는 처음 발견한 `C`로 남고, 부모를 거꾸로 따라가면 `G←C←A←S`, 즉 `S→A→C→G`가 됩니다. 같은 최단 거리로 나중에 도착한 경로가 있더라도 이 구현은 첫 부모 하나만 보관하므로 모든 최단 경로를 열거하지는 않습니다.

## 정확한 슈도코드와 불변식

다음은 인접 리스트를 순회하는 BFS와 경로 복원을 분리한 슈도코드입니다. `INF`는 유효한 정점 중 아직 도달하지 않은 정점에만 쓰며, 함수 입구에서 `source`와 선택된 `target`이 그래프에 존재하는지 먼저 검증합니다. 반환 형태는 혼동을 피하려고 항상 전체 `distance`와 `parent`를 반환하고, `target`을 주면 별도 필드에 그 정점의 거리와 복원 경로를 함께 담습니다. 전체 결과가 필요하므로 목표를 발견해도 큐를 끝까지 처리합니다.

```text
validate_bfs_input(graph, source, target):
    if source not in graph.vertices:
        return invalid_input("unknown source")
    if target is not NONE and target not in graph.vertices:
        return invalid_input("unknown target")
    for u in graph.vertices:
        for v in graph.out_neighbors(u):
            if v not in graph.vertices:
                return invalid_input("edge points to unknown vertex")
    return valid

bfs_shortest(graph, source, target = NONE):
    validation = validate_bfs_input(graph, source, target)
    if validation is invalid:
        return validation

    distance[v] = INF for every v in graph.vertices
    parent[v] = NONE for every v in graph.vertices
    queue = empty FIFO queue

    distance[source] = 0
    queue.push_back(source)

    while queue is not empty:
        u = queue.pop_front()
        for v in graph.out_neighbors(u):
            if distance[v] == INF:
                distance[v] = distance[u] + 1
                parent[v] = u
                queue.push_back(v)

    result = {distance: distance, parent: parent}
    if target is not NONE:
        result.target = target
        result.target_distance = distance[target]
        result.target_path = restore(parent, source, target)
    return result

restore(parent, source, target):
    path = empty list
    v = target
    while v is not NONE:
        path.push_front(v)
        if v == source:
            return path
        v = parent[v]
    return empty path
```

`target`을 생략하면 전체 결과만 반환하고, 지정하면 그 전체 결과에 `target_distance`와 `target_path`를 덧붙입니다. 따라서 목표를 찾은 뒤에도 다른 유효 정점의 `distance`와 `parent`는 같은 반환 객체 안에서 의미가 유지됩니다. 목표가 그래프에는 있지만 도달할 수 없으면 `target_distance=INF`, `target_path=empty path`입니다. 반대로 그래프에 없는 목표는 `INF` 결과가 아니라 사전 검증의 `invalid_input`입니다.

반복 불변식은 세 가지로 잡으면 됩니다. 첫째, 큐에 들어간 정점의 `distance`는 실제로 존재하는 출발점 경로의 길이입니다. 둘째, 이미 큐에 들어갔거나 꺼낸 정점은 그보다 짧은 경로가 남아 있지 않은 최단 거리로 기록되어 있습니다. 셋째, 큐의 정점들은 거리의 비감소 순서로 놓입니다. 어떤 정점 `v`가 더 짧은 경로로 뒤늦게 발견되려면 그 경로의 직전 정점이 먼저 꺼내져야 하는데, 그 직전 정점은 더 짧은 층에 있으므로 이미 `v`를 발견했어야 합니다. 따라서 처음 발견한 거리를 고정할 수 있습니다.

## DFS와 가중치가 만드는 반례

이 예제에서 `S`의 이웃을 `[B, A]` 순서로 DFS가 깊게 처리하면 `S→B→D→E→G`를 먼저 반환할 수 있습니다. 그 경로는 길이 4이고, BFS가 찾은 `S→A→C→G`의 길이 3보다 깁니다. 목표에 먼저 닿은 경로와 최단 경로를 혼동하면 안 되는 이유가 이 작은 그래프 안에 있습니다.

또한 이 알고리즘은 간선 수를 세는 알고리즘이지 임의의 비용 합을 최소화하는 알고리즘이 아닙니다. 예를 들어 한 간선의 비용이 5이고 두 간선의 비용이 각각 1인 입력에서는 BFS가 한 번 이동하는 길이를 먼저 고르지만 실제 최저비용은 두 번 이동하는 길이입니다. 비용 모델이 바뀌면 방문을 처음 고정하는 근거도 함께 다시 세워야 합니다.

## 복잡도 전제와 직접 확인할 입력

정점의 이웃을 인접 리스트에서 한 번씩 읽고 `push_back`, `pop_front`, 방문 배열 조회가 상수 시간이라고 가정하면 시간 복잡도는 `O(V+E)`, `distance`·`parent`·큐의 보조 공간은 `O(V)`입니다. 인접 행렬에서 모든 정점의 행을 매번 훑는 구현이라면 간선이 희소해도 이웃 검사량은 `O(V²)`가 될 수 있습니다.

앞의 입력으로 `target=G`를 주면 예상 결과는 전체 거리 표와 함께 목표 거리 3, 경로 `S→A→C→G`입니다. `target=E`이면 목표 거리 3, 경로 `S→A→D→E`가 됩니다. 그래프에는 있지만 출발점 `S`에서 도달할 수 없는 정점을 목표로 주면 전체 결과의 해당 거리는 `INF`, 목표 경로는 빈 목록이어야 합니다. 그래프에 없는 정점을 `source`나 `target`으로 주면 배열 조회 전에 `invalid_input`으로 거절해야 합니다. 이 경우들과 더불어 `B`에서 `D`를 다시 발견하려는 순간 `parent[D]`가 바뀌지 않는지 확인하면 층·방문·복원 계약을 함께 점검할 수 있습니다.

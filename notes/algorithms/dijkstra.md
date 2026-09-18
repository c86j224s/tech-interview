---
id: dijkstra
title: Dijkstra의 비음수 간선과 거리 확정
topic: 알고리즘
summary: 비음수 가중 그래프에서 완화와 우선순위 큐의 최소 후보 추출이 언제 최단 거리를 확정하는지 작은 그래프로 추적합니다.
questionIds: [algorithm-dijkstra-negative-edge]
---

# Dijkstra의 비음수 간선과 거리 확정

이 노트는 ‘현재 가장 싼 후보를 확정해도 되는가’를 거리 표와 힙의 상태로 판별하는 방법을 다룹니다. 먼저 간선을 따라 누적 비용을 계산하는 **완화**(relaxation)를 이해하고, 그 결과 중 최솟값만 확정 집합으로 옮기는 이유를 확인합니다. 이후 목표를 일찍 찾는 경우와 전체 거리표가 필요한 경우를 구분하고, 음수 간선·오래된 힙 항목·오버플로를 입력 계약의 문제로 진단합니다.

## 이동 횟수 대신 누적 비용 최소화

도로마다 통행료가 다르면 두 간선을 건너는 길이 한 간선의 길보다 쌀 수 있습니다. 이런 문제에서 필요한 값은 출발점부터의 누적 비용 `g[v]`이고, 아직 가장 싼 후보를 **우선순위 큐**(priority queue)에서 꺼내 다음으로 확장합니다. 이 방식이 꺼낸 정점의 거리를 영구적으로 확정할 수 있는 핵심 전제는 모든 간선 비용이 0 이상이라는 점입니다.

이 노트의 입력은 유한한 정적 그래프 스냅샷이고, `source`와 선택된 `target`은 그래프의 정점이어야 합니다. 모든 간선의 끝점이 등록되어 있고 비용이 유한한 비음수 수이며, 누적 비용의 덧셈이 표현 범위를 넘지 않는다고 가정합니다. 슈도코드는 이 전제를 호출자 말만 믿지 않고 탐색 전에 그래프 전체의 간선을 사전 검증합니다. 따라서 목표를 일찍 확정해도 아직 읽지 않은 간선의 음수 비용을 놓치지 않습니다.

아래 슈도코드는 `decrease-key`가 없는 이진 최소 힙을 사용합니다. 더 낮은 거리를 찾을 때 새 힙 항목을 넣고, 예전 항목은 꺼낼 때 버리는 **지연 삭제**(lazy deletion) 방식입니다. 따라서 힙에 같은 정점이 여러 번 보이는 것이 정상이며, 현재 `dist`와 힙 항목의 비용을 비교해야 합니다.

`target`을 주면 목표가 `settled`되는 순간 멈출 수 있지만, 그 반환은 목표 결과와 현재까지의 부분 상태를 구분해야 합니다. 전체 정점의 최단 거리 표가 필요하면 `target` 없이 끝까지 실행해야 합니다.

거리 완화는 현재 알려진 `dist[u]`에 간선 비용을 더해 `dist[v]`보다 작을 때만 `dist[v]`와 `parent[v]`를 함께 바꾸는 연산입니다. 즉 힙은 최단 경로 자체가 아니라 ‘이미 발견한 경로 비용의 후보’를 보관하고, `settled`는 그 후보가 더 이상 개선되지 않는다는 판정의 결과입니다. 이 두 상태를 섞으면 힙에 먼저 들어간 경로를 최종 경로로 잘못 반환하게 됩니다.

## 가중 그래프와 예제 입력

정점과 간선은 다음과 같습니다. 표의 비용은 모두 정수이고, 각 정점의 이웃은 적힌 순서로 완화한다고 하겠습니다.

| 정점 | 나가는 이웃(비용) |
| --- | --- |
| `S` | `A(5)`, `B(1)` |
| `B` | `A(2)`, `C(8)` |
| `A` | `C(1)`, `G(8)` |
| `C` | `G(3)` |
| `G` | 없음 |

`S→A`를 바로 타면 비용 5이지만 `S→B→A`는 `1+2=3`입니다. 또 `C`는 처음에 `B`를 통해 비용 9로 발견됐다가 `A`를 통해 4로 낮아집니다. 목표까지의 최종 경로는 `S→B→A→C→G`, 비용 `1+2+1+3=7`입니다.

```diagram
{"title":"Dijkstra의 거리 확정","caption":"화살표의 숫자는 비음수 간선 비용이며, 화살표는 그래프 구조만 나타냅니다. 힙의 오래된 후보 표시는 아래 상태 표에서만 †로 표시합니다.","rows":[[{"id":"s","label":"S","detail":["거리 0","시작"]}],[{"id":"a","label":"A","detail":["직행 5","개선 3"]},{"id":"b","label":"B","detail":["거리 1"]}],[{"id":"c","label":"C","detail":["개선 9→4"]}],[{"id":"g","label":"G","detail":["최종 7","목표"]}]],"edges":[{"from":"s","to":"a","label":"5"},{"from":"s","to":"b","label":"1"},{"from":"b","to":"a","label":"2"},{"from":"b","to":"c","label":"8"},{"from":"a","to":"c","label":"1"},{"from":"a","to":"g","label":"8"},{"from":"c","to":"g","label":"3"}]}
```

그림에서 `S→A`는 먼저 힙에 들어가지만 `B`를 꺼낸 뒤 `A`의 거리가 5에서 3으로 내려갑니다. `A`와 `C`의 오래된 후보를 그대로 남겨 두어도, pop 시점에 최신 거리와 다르면 확장하지 않는다는 경계가 중요합니다.

## 우선순위 큐와 거리 상태의 단계별 변화

힙 항목은 `(키, 정점)`으로 적고, `†`는 그 정점의 현재 `dist`보다 큰 오래된 항목입니다. 힙 내부 전체가 정렬되어 있다는 뜻은 아니므로 표에서는 이해를 위해 최솟값부터 나열했습니다.

| 단계 | pop 및 처리 | 힙(최솟값→) | `dist` | 확정 집합 |
| ---: | --- | --- | --- | --- |
| 0 | 시작 | `[(0,S)]` | `{S:0}` | `{}` |
| 1 | `(0,S)` 확정, `A=5`, `B=1` 완화 | `[(1,B),(5,A)]` | `{S:0, A:5, B:1}` | `{S}` |
| 2 | `(1,B)` 확정, `A:3`으로 개선, `C=9` | `[(3,A),(5,A†),(9,C)]` | `{S:0, A:3, B:1, C:9}` | `{S,B}` |
| 3 | `(3,A)` 확정, `C:4`로 개선, `G=11` | `[(4,C),(5,A†),(9,C†),(11,G)]` | `{S:0, A:3, B:1, C:4, G:11}` | `{S,B,A}` |
| 4 | `(4,C)` 확정, `G=7`로 개선 | `[(5,A†),(7,G),(9,C†),(11,G†)]` | `{S:0, A:3, B:1, C:4, G:7}` | `{S,B,A,C}` |
| 5 | `(5,A†)`는 현재 `dist[A]=3`이므로 건너뜀 | `[(7,G),(9,C†),(11,G†)]` | `{S:0, A:3, B:1, C:4, G:7}` | `{S,B,A,C}` |
| 6 | `(7,G)` 확정, 목표 종료 | `[(9,C†),(11,G†)]` | `{S:0, A:3, B:1, C:4, G:7}` | `{S,B,A,C,G}` |

`G`는 `A`를 처리할 때 비용 11로 먼저 발견됐지만, `C`를 통해 7로 줄어든 뒤에야 확정됩니다. `parent`도 거리 갱신과 동시에 바뀌어 `parent[A]=B`, `parent[C]=A`, `parent[G]=C`가 됩니다. 목표를 단지 힙에 넣었다는 이유로 반환하면 비용 11을 내놓을 수 있으므로, 최소 후보로 꺼내는 순간과 발견 순간을 구별해야 합니다.

## 정확한 슈도코드

```text
validate_dijkstra_input(graph, source, target):
    if source not in graph.vertices:
        return invalid_input("unknown source")
    if target is not NONE and target not in graph.vertices:
        return invalid_input("unknown target")

    for u in graph.vertices:
        for (v, weight) in graph.out_edges(u):
            if v not in graph.vertices:
                return invalid_input("edge points to unknown vertex")
            if not is_finite_number(weight) or weight < 0:
                return invalid_input("edge cost must be finite and nonnegative")
    return valid

dijkstra(graph, source, target = NONE):
    validation = validate_dijkstra_input(graph, source, target)
    if validation is invalid:
        return validation

    dist[v] = INF for every v in graph.vertices
    parent[v] = NONE for every v in graph.vertices
    settled = empty set
    heap = empty min-heap of (distance_snapshot, vertex)
    stopped_for_target = false

    dist[source] = 0
    heap.push((0, source))

    while heap is not empty:
        (d, u) = heap.pop_min()
        if d != dist[u]:
            continue                 // 지연 삭제된 후보
        if u in settled:
            continue

        settled.add(u)
        if target is not NONE and u == target:
            stopped_for_target = true
            break                    // target 결과만 확정

        for (v, weight) in graph.out_edges(u):
            candidate = checked_add(d, weight)
            if candidate overflows:
                return invalid_input("distance overflow")
            if candidate < dist[v]:
                dist[v] = candidate
                parent[v] = u
                heap.push((candidate, v))

    if target is NONE:
        return {
            kind: "all_distances",
            distances: dist,
            parents: parent,
            settled: settled,
            all_distances_complete: true
        }

    target_result = {
        vertex: target,
        distance: dist[target],
        path: restore(parent, source, target)
    }
    return {
        kind: "target_result",
        target: target_result,
        distances_so_far: dist,
        parents_so_far: parent,
        settled: settled,
        all_distances_complete: not stopped_for_target
    }

restore(parent, source, target):
    path = empty list
    seen = empty set
    v = target
    while v is not NONE:
        if v in seen:
            return invalid_search_state("parent cycle")
        seen.add(v)
        path.push_front(v)
        if v == source:
            return path
        v = parent[v]
    return empty path
```

`target`을 주지 않으면 힙이 빌 때까지 실행하므로 `distances`와 `parents`가 전체 결과이고 `all_distances_complete=true`입니다. `target`을 주면 목표를 `settled`에 넣은 순간 멈추므로 `target.distance`와 `target.path`만 확정 결과로 노출합니다.

함께 반환하는 `distances_so_far`와 `parents_so_far`는 현재까지의 상태일 뿐이며, `settled`에 포함되지 않은 정점의 값을 전체 최단 거리로 해석하면 안 됩니다. 이 경우 `all_distances_complete=false`입니다.

반대로 목표가 그래프에는 있지만 도달할 수 없어 힙이 끝나면 `distance=INF`, 빈 경로, `all_distances_complete=true`가 됩니다. 목표가 그래프에 없는 경우는 `INF`가 아니라 사전 검증의 `invalid_input`입니다.

이 사전 검증은 첫 pop 전에 그래프 전체의 간선을 읽습니다. 따라서 목표가 일찍 확정되더라도 아직 탐색하지 않은 가지에 음수 간선이 숨어 있는 입력을 정상적인 Dijkstra 결과로 반환하지 않습니다. `checked_add`는 유한 비용 가정이 깨지는 정수 오버플로도 입력 오류로 처리합니다. `dist[v]`를 낮출 때 `parent[v]`도 같은 논리적 갱신으로 바꿔야 합니다.

그렇지 않으면 비용 배열은 최적인데 복원한 부모는 예전 비싼 경로를 가리킬 수 있습니다. 이 슈도코드는 정수처럼 정확히 비교할 수 있는 비용을 가정합니다. 부동소수점 비용을 사용한다면 무작정 `epsilon`을 넣어 오래된 항목을 판별하기보다 버전 번호나 명시된 비교 정책을 함께 저장해야 합니다.

## 거리 확정의 불변식과 음수 반례

`settled`에 넣는 순간의 `dist[u]`가 최단 거리라는 주장은 힙의 다음 후보를 실제 경로의 앞부분과 비교하면 이해할 수 있습니다. `d`로 pop된 `u`보다 더 싼 경로가 있다고 가정하고, 그 경로에서 아직 `settled`에 들어가지 않은 첫 정점을 `x`라고 하겠습니다. `x` 바로 앞의 정점은 이미 확정되어 있으므로, 그 정점을 처리할 때 `x`까지의 경로 비용이 힙에 들어갔어야 합니다. 그 비용은 더 싼 전체 경로의 비용보다 클 수 없습니다.

모든 간선이 0 이상이면 `x` 뒤의 간선들이 누적 비용을 다시 낮출 수 없습니다. 따라서 힙에는 `d`보다 작은 후보가 남아 있어야 하는데, `d`가 최솟값으로 pop되었다는 사실과 모순입니다. 예제에서는 `A=3`을 먼저 확정하고, 나중에 꺼낸 옛 항목 `A=5`를 버립니다. 목표도 처음 발견한 비용 11이 아니라, 개선된 `G=7`이 최소 후보로 꺼내지는 순간 확정합니다.

비음수 전제를 빼고 사전 검증까지 생략한 변형에서는 같은 구조가 실패합니다. `S→A=2`, `S→B=5`, `B→A=-4`, `A→G=1`만 있는 입력을 보겠습니다. `S`를 처리하면 `A=2`, `B=5`가 되고, `A`를 먼저 확정해 `G=3`을 만든 뒤 목표 `G`를 반환할 수 있습니다. 하지만 실제 경로 `S→B→A→G`의 비용은 `5-4+1=2`입니다.

`B`를 나중에 처리하면 이미 확정한 `A`를 1로 낮춰야 하지만, 바로 그 재확정을 허용하지 않는 것이 표준 Dijkstra의 전제입니다. 이 노트의 구현은 이 입력을 첫 pop 전에 `invalid_input`으로 거절하므로 3을 정상 결과로 반환하지 않습니다. 우선순위 큐를 다른 종류로 바꾸는 것만으로 음수 간선 문제를 해결할 수는 없습니다.

## 복잡도 전제와 확인 대상 입력 조건

유한한 정적 인접 리스트, 이진 최소 힙, 간선 비용·비교·덧셈이 상수 시간이고 전체 사전 검증을 통과한 유한·비음수 비용만 사용한다고 가정합니다. `dist+weight`가 표현 범위를 넘지 않아야 합니다.

`decrease-key` 없이 지연 삭제를 쓰면 성공적인 완화가 힙 항목을 최대 `O(E+V)`개 만들 수 있어 시간은 `O((V+E) log(V+E))`, 힙까지 포함한 공간은 최악 `O(V+E)`입니다. 위치 맵을 둔 `decrease-key` 힙처럼 활성 후보만 관리하는 구현은 보통 `O((V+E) log V)`와 `O(V)` 보조 공간으로 설명합니다.

실제 그래프의 다중 간선과 힙 재구축 정책이 이 상한의 전제를 바꿀 수 있습니다.

예제 그래프의 목표 `G`는 거리 7이고 부모 경로는 `S→B→A→C→G`여야 합니다. 검사 중 `(5,A†)`, `(9,C†)`, `(11,G†)`가 확장되지 않는지 확인하면 지연 삭제 계약을 점검할 수 있습니다. 별도의 음수 입력에서는 전체 사전 검증이 첫 pop 전에 `weight < 0`를 발견해 `invalid_input`을 반환해야 합니다. 그 입력의 실제 최단비용은 2이지만, 이 Dijkstra 호출의 기대 결과는 2를 반환하는 것이 아니라 음수 간선 입력을 거절하는 것입니다. 음수 간선을 처리해야 한다면 Bellman–Ford 등 다른 알고리즘으로 넘겨야 합니다.

재현 연습으로 예제에서 `G`를 발견하는 순간의 값과 확정 순간의 값을 각각 기록해 봅니다. `A` 처리 직후에는 `G=11`이지만 `C` 처리 뒤에는 `G=7`이고, `(11,G†)`는 pop 시점에 버려져야 합니다. 이어서 음수 반례를 넣으면 탐색 결과 3을 계산하기 전에 전체 간선 검증이 `invalid_input`을 반환해야 하므로, ‘틀린 최단 거리’와 ‘지원하지 않는 입력의 거절’을 구분해 확인할 수 있습니다.

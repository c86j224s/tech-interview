---
id: astar
title: A*의 허용성·일관성과 올바른 종료
topic: 알고리즘
summary: 허용적 휴리스틱과 일관성의 차이를 재확장 사례로 추적하고 목표를 언제 최단 경로로 확정해도 되는지 설명합니다.
questionIds: [astar-heuristic, astar-open-closed, astar-inconsistent-reopen-example]
---

# A*의 허용성·일관성과 올바른 종료

A*를 이해할 때는 우선순위 큐의 숫자보다 그 숫자가 나타내는 하한을 추적해야 합니다. 각 정점의 `g`는 지금까지 발견한 경로 비용이고 `h`는 아직 남은 비용의 하한이므로, 목표를 발견했다는 사실과 최단 비용을 확정했다는 사실 사이에 차이가 생깁니다. 아래 예시는 이 차이가 재오픈과 종료 조건을 어떻게 결정하는지 작은 상태 변화로 보여 줍니다.

## 목표 방향 휴리스틱과 최단 경로 보장 조건

Dijkstra는 지금까지의 실제 비용 `g(n)`이 작은 정점을 먼저 봅니다. 목표가 분명한 길찾기라면 아직 남은 비용의 하한을 알려 주는 **휴리스틱**(heuristic) `h(n)`을 더해 `f(n)=g(n)+h(n)`이 작은 후보를 먼저 볼 수 있습니다. 이것이 A*입니다. `h`가 좋으면 목표 쪽 후보를 먼저 보지만, 방향을 잘 짚는 것과 최단 경로를 보장하는 것은 같은 말이 아닙니다.

이 노트에서는 `h`가 실제 남은 비용을 넘지 않는 **허용성**(admissibility)은 만족하지만, 간선마다 값이 매끄럽게 이어지는 **일관성**(consistency)은 깨지는 경우를 추적합니다. 이때 같은 정점을 더 낮은 `g`로 다시 발견하면 닫힌 표시를 풀고 **재확장**(reopen)해야 합니다. 목표를 OPEN에 처음 넣은 순간도 종료 시점이 아닙니다.

## 실제 그래프와 고정 휴리스틱 값

다음 네 정점의 방향 그래프를 사용합니다. 그래프는 유한한 정적 스냅샷이고, 모든 간선 비용은 유한한 비음수 수이며 `g+cost`가 표현 범위를 넘지 않는다고 가정합니다. 이 노트에서 휴리스틱은 탐색 중 바뀌지 않는 유한한 비음수 값으로 고정하고, `h(G)=0`을 요구합니다. 이 `h≥0`은 여기서 둔 별도 전제이며, 허용성의 핵심 상한 자체와 같은 말은 아닙니다.

| 정점 | 나가는 이웃(비용) | `h(n)` | 실제 남은 최단비용 `δ(n,G)` |
| --- | --- | ---: | ---: |
| `S` | `A(3)`, `B(1)` | 0 | 5 |
| `A` | `G(3)` | 0 | 3 |
| `B` | `A(1)` | 4 | 4 |
| `G` | 없음 | 0 | 0 |

최적 경로는 `S→B→A→G`이고 비용은 `1+1+3=5`입니다. `S→A→G`는 비용 6입니다. 그림에서 노드 detail의 `h`와 화살표의 실제 비용을 함께 보시면, A*가 왜 처음에는 `A`를 더 좋아하는지 확인할 수 있습니다.

```diagram
{"title":"A*의 재확장 경계","caption":"화살표의 숫자는 실제 간선 비용이고 노드 detail의 h는 목표까지의 추정 하한입니다. B→A에서 h(B)=4가 1+h(A)=1보다 커 일관성이 깨지므로 A를 다시 열어야 합니다.","rows":[[{"id":"s","label":"S","detail":["h=0","g=0"]}],[{"id":"a","label":"A","detail":["h=0","처음 g=3"]},{"id":"b","label":"B","detail":["h=4","g=1"]}],[{"id":"g","label":"G","detail":["h=0","목표"]}]],"edges":[{"from":"s","to":"a","label":"3"},{"from":"s","to":"b","label":"1"},{"from":"b","to":"a","label":"1"},{"from":"a","to":"g","label":"3"}]}
```

## 허용성·일관성 판정 계산

이 노트의 고정된 비음수 휴리스틱 전제 아래에서는 허용성을 `h(n)≤δ(n,G)`로 확인합니다. 위 값은 `h(S)=0≤5`, `h(A)=0≤3`, `h(B)=4≤4`, `h(G)=0≤0`이므로 허용적입니다. 별도로 둔 `h(n)≥0`과 유한성은 구현 입력 조건이며, 허용성의 정의가 모든 문맥에서 반드시 비음수까지 요구한다는 뜻은 아닙니다. 따라서 이 예에서 휴리스틱 자체가 최적해보다 앞서 나가 최적 경로를 버리지는 않습니다.

일관성은 모든 간선 `u→v`에 대해 `h(u) ≤ cost(u,v)+h(v)`를 요구합니다. `S→A`, `S→B`, `A→G`에서는 각각 `0≤3`, `0≤5`, `0≤3`이지만 `B→A`에서는 `4≤1+0`이 거짓입니다. 이 불연속 때문에 `B`가 아직 처리되지 않았는데도 `A`의 초기 후보 `f=3`이 `B`의 후보 `f=5`보다 작아집니다. 일관성이 있었다면 이런 식으로 닫힌 `A` 뒤에서 더 싼 `g`가 튀어나오는 상황을 별도 재오픈 없이 다루기 쉬웠을 것입니다.

## OPEN·CLOSED·`g` 상태 추적

힙 항목은 `(f, g, 정점)`이고 `†`는 현재 `g`와 맞지 않는 오래된 후보입니다. `CLOSED`에서 정점을 제거하는 순간이 재오픈입니다. 목표는 처음 발견된 뒤에도 OPEN의 더 낮은 하한을 확인해야 하므로 중간 검사 행을 넣었습니다.

| 단계 | pop 및 갱신 | OPEN(최솟값→) | `g` 거리 | CLOSED |
| ---: | --- | --- | --- | --- |
| 0 | 시작 | `[(0,0,S)]` | `{S:0, A:∞, B:∞, G:∞}` | `{}` |
| 1 | `S` 확장: `A=3,f=3`, `B=1,f=5` | `[(3,3,A),(5,1,B)]` | `{S:0, A:3, B:1, G:∞}` | `{S}` |
| 2 | `A` 확장: `G=6,f=6` | `[(5,1,B),(6,6,G)]` | `{S:0, A:3, B:1, G:6}` | `{S,A}` |
| 2.5 | `G`를 발견했지만 `min f=5 < g[G]=6`이므로 계속 | `[(5,1,B),(6,6,G)]` | `{S:0, A:3, B:1, G:6}` | `{S,A}` |
| 3 | `B` 확장: `A=2`로 개선, 닫힌 `A`를 제거하고 재오픈 | `[(2,2,A),(6,6,G)]` | `{S:0, A:2, B:1, G:6}` | `{S,B}` |
| 4 | 재오픈된 `A` 확장: `G=5,f=5`로 개선 | `[(5,5,G),(6,6,G†)]` | `{S:0, A:2, B:1, G:5}` | `{S,B,A}` |
| 5 | `(5,5,G)`를 pop해 목표 확정 | `[(6,6,G†)]` | `{S:0, A:2, B:1, G:5}` | `{S,B,A,G}` |

첫 `G` 후보의 부모는 `A`이고 비용 6입니다. 단계 3에서 `A`의 `g`를 3에서 2로 낮추면 `parent[A]=B`로 바뀌지만, 아직 `A`를 다시 확장하지 않았으므로 `g[G]`는 잠시 6에 남습니다. 이때 `parent[G]=A`를 따라간 간선 합은 5가 되어 부모 사슬과 자식 `g`가 일시적으로 어긋날 수 있습니다.

재오픈된 `A`를 확장한 단계 4에서야 `G`의 `g`도 5로 낮아지고, 목표를 처음 발견한 단계 2에서 종료하면 이 개선을 보지 못합니다. 반대로 목표를 최소 유효 `f`로 pop하는 단계 5에서는 더 싼 열린 경로가 남아 있지 않다는 것을 확인할 수 있습니다.

## 재오픈을 포함한 정확한 슈도코드

```text
validate_astar_input(graph, start, goal, h):
    if start not in graph.vertices:
        return invalid_input("unknown start")
    if goal not in graph.vertices:
        return invalid_input("unknown goal")

    for v in graph.vertices:
        if v not in h or not is_finite_number(h[v]) or h[v] < 0:
            return invalid_input("h must be defined, finite, and nonnegative")
    if h[goal] != 0:
        return invalid_input("h(goal) must be zero")

    for u in graph.vertices:
        for (v, cost) in graph.out_edges(u):
            if v not in graph.vertices:
                return invalid_input("edge points to unknown vertex")
            if not is_finite_number(cost) or cost < 0:
                return invalid_input("edge cost must be finite and nonnegative")
    return valid

astar(graph, start, goal, h):
    validation = validate_astar_input(graph, start, goal, h)
    if validation is invalid:
        return validation
    heuristic[v] = h[v] for every v in graph.vertices  // 탐색 중 고정

    g[v] = INF for every v in graph.vertices
    parent[v] = NONE for every v in graph.vertices
    parent_cost[v] = NONE for every v in graph.vertices
    closed = empty set
    open = empty min-heap of (f_snapshot, g_snapshot, sequence, vertex)

    g[start] = 0
    open.push((heuristic[start], 0, next_sequence(), start))

    while open is not empty:
        (f_snapshot, g_snapshot, _, u) = open.pop_min()
        if g_snapshot != g[u]:
            continue                 // 오래된 후보
        if u in closed:
            continue

        closed.add(u)
        if u == goal:
            path = restore(parent, parent_cost, start, goal, g[u])
            if path is invalid:
                return invalid_search_state("parent path does not match g")
            return {kind: "target_result", path: path, cost: g[u]}

        for (v, cost) in graph.out_edges(u):
            candidate = checked_add(g[u], cost)
            if candidate overflows:
                return invalid_input("distance overflow")
            if candidate < g[v]:
                g[v] = candidate
                parent[v] = u
                parent_cost[v] = cost
                closed.discard(v)     // 닫힌 정점이면 재오픈
                f = checked_add(candidate, heuristic[v])
                if f overflows:
                    return invalid_input("priority overflow")
                open.push((f, candidate, next_sequence(), v))

    return no path

restore(parent, parent_cost, start, goal, expected_cost):
    reverse_path = empty list
    seen = empty set
    total = 0
    v = goal
    while v != start:
        if v in seen or parent[v] is NONE:
            return invalid_search_state("missing or cyclic parent")
        seen.add(v)
        reverse_path.push(v)
        if parent_cost[v] is NONE:
            return invalid_search_state("missing parent edge cost")
        total = checked_add(total, parent_cost[v])
        if total overflows:
            return invalid_search_state("parent cost overflow")
        v = parent[v]
    reverse_path.push(start)
    if total != expected_cost:
        return invalid_search_state("parent path cost mismatch")
    return reverse(reverse_path)
```

`f_snapshot`은 우선순위를 설명하기 위해 저장하며, 실제 pop 검사는 `g_snapshot`과 현재 `g[u]`를 비교해 합니다. `parent`, `parent_cost`는 `g`를 낮추는 같은 블록에서 갱신해 목표 확정 시 현재 부모 간선과 비용을 함께 복원합니다. `sequence`는 동일한 `f`의 순서를 재현하기 위한 보조 키일 뿐 최적성의 근거는 아닙니다. 전체 간선과 휴리스틱을 첫 pop 전에 검증하므로 목표를 일찍 pop해도 아직 읽지 않은 간선의 음수 비용을 정상 입력으로 처리하지 않습니다.

## 불변식과 올바른 종료 조건

허용적 휴리스틱을 재오픈과 함께 사용할 때 지켜야 할 상태 불변식은 다음과 같습니다.

- 현재 `g[v]`는 출발점에서 `v`까지 발견된 경로 비용 중 가장 작은 값이며, 실제 최단 거리의 상한입니다. `g[v]`를 낮춘 직후에는 `parent[v]`와 `parent_cost[v]`를 함께 갱신하지만, 부모가 닫힌 정점일 수 있으므로 그 부모 사슬을 따라간 모든 중간 상태가 즉시 현재 `g`와 일치한다고 가정하지 않습니다.
- `closed`의 정점은 현재 `g`로 이웃 확장을 마친 상태입니다. 더 낮은 `g`가 발견되면 `closed.discard(v)`와 새 OPEN 삽입을 함께 해 그 뒤의 간선도 다시 완화합니다.
- 목표를 pop해 확정하는 순간에는 `restore`가 `parent`와 `parent_cost`를 따라 목표에서 시작점까지 되짚고, 각 부모 간선의 합이 확정된 `g[goal]`과 같은지 확인합니다. 그 검사를 통과한 뒤에만 반환 경로가 현재 목표 비용을 표현한다고 말합니다.
- 유효한 OPEN 항목의 `f=g+h`는 그 후보를 거쳐 갈 수 있는 완성 경로 비용의 하한입니다. 이 노트의 허용성 조건 `h≤δ` 때문에 h가 남은 실제 비용보다 크지 않기 때문입니다.

목표 `G`가 처음 OPEN에 들어간 단계에서는 그 경로의 비용이 6이라는 사실만 알 수 있습니다. 아직 OPEN에는 `B`를 거쳐 더 싸질 수 있는 후보가 있고, 이 후보의 `f=5`는 현재 목표 비용 6보다 작으므로 `G`의 비용을 확정할 수 없습니다. `B`가 처리되고 `A`가 재오픈된 뒤에야 `G`의 `g`가 5로 내려갑니다.

따라서 목표를 발견했거나 `g[goal]`을 처음 기록한 순간에는 멈추지 않습니다. 오래된 힙 항목을 버리고 현재 `g`와 맞는 후보만 남긴 OPEN에서 목표가 최소 `f`로 pop될 때 `restore`를 거쳐 종료합니다. 목표 비용을 `C`로 유지하는 구현이라면 `min_valid_f(OPEN) >= C`일 때도 같은 하한 논리로 안전하지만, 그 비교에서 제외할 오래된 항목을 정확히 판별해야 합니다.

일관성이 추가로 성립하면 간선마다 `h(u)≤cost(u,v)+h(v)`가 이어져 `f`가 경로를 따라 내려가지 않고, 비음수 비용 조건 아래 닫힌 정점을 다시 열 필요가 없습니다. 하지만 허용적이라는 사실만으로 일관성까지 따라오는 것은 아니므로, 이 둘을 하나의 용어처럼 다루면 안 됩니다.

작은 그래프를 손으로 검증할 때는 각 pop 직후 `g`, `f`, CLOSED를 기록하고, 목표 후보가 생긴 뒤에도 OPEN의 최소 유효 `f`와 목표 비용을 비교하십시오. 예상 결과는 재오픈을 끄거나 목표 발견 즉시 반환하면 6, 재오픈과 최소 유효 `f` 종료를 사용하면 5입니다. 값이 다르면 먼저 휴리스틱 허용성, 오래된 힙 항목 제거, 닫힌 정점의 `discard` 여부를 순서대로 확인합니다.

## 복잡도 전제와 재오픈 반례

유한한 정적 인접 리스트, 이진 힙, 비용·휴리스틱 계산·비교가 상수 시간이고 모든 간선 비용과 휴리스틱 값이 유한하며 비음수라고 가정합니다. `h`는 탐색 중 고정되고 `h(goal)=0`이며, `g+cost`와 경로 합산이 표현 범위를 넘지 않아야 합니다.

일관된 `h`라서 정점을 한 번씩만 확장하면 표준적인 지연 삭제 구현은 대략 `O((V+E) log(V+E))` 시간과 `O(V+E)` 힙 포함 공간을 사용하며, decrease-key를 쓰면 보통 `O((V+E) log V)`, `O(V)` 보조 공간으로 정리합니다. 허용적이지만 일관되지 않은 `h`에서는 재오픈 횟수가 입력과 휴리스틱에 따라 커질 수 있습니다.

유효 확장 횟수를 `X`, 성공적인 완화를 `I`라고 두면 시간은 힙 연산과 확장 간선 수를 포함해 `O((I + Σ outdegree(확장 정점)) log(V+I))`, 공간은 지연 삭제 시 `O(V+I)`로 잡는 편이 정직합니다. `X`나 `I`를 별도 상한 없이 `O(E log V)`라고 쓰면 재확장을 숨기게 됩니다.

일관성 있는 `h`에서의 한 번 확장 전제와, 일관성이 없는 `h`에서의 재오픈 전제를 섞지 않습니다.

이 노트의 네 정점을 그대로 실행해 보십시오. 재오픈을 끄거나 목표 발견 즉시 반환하면 6을 내놓지만 실제 최적비용은 5입니다. 재오픈을 켜고 목표를 최소 유효 `f`로 pop하면 `S→B→A→G`, 비용 5가 나옵니다. 이 작은 예에서는 표에 계산해 둔 실제 남은 비용 `δ(B,G)=4`를 오라클로 삼아 `h(B)>4`를 대조할 수 있습니다. 그 오라클 검사에서 허용성이 실패하면 일반 A*의 최단성 주장을 유지하면 안 되며, 실제 최단비용을 모르는 일반 입력에서는 이렇게 자동 판정할 수 없습니다.

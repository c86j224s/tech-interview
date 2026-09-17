---
id: pathfinding-foundations
title: 길찾기 모델과 알고리즘 선택
topic: 알고리즘
summary: 이동 공간을 상태와 비용으로 정확히 모델링하고 Grid·NavMesh·Voxel에서 BFS·Dijkstra·A*를 선택하는 기준을 작은 예제로 설명합니다.
questionIds: []
prerequisites: [computer-science-foundations, graph-storage]
related: [dijkstra, astar, astar-frontier, path-execution]
reviewedAt: '2026-09-17'
---

# 길찾기 모델과 알고리즘 선택

## 문제 정의

길찾기는 두 점을 잇는 선을 그리는 작업이 아니라, 어떤 상태에서 어떤 다음 상태로 이동할 수 있는지와 그 이동에 얼마의 비용을 부여할지를 정하는 작업입니다. 같은 출발점과 목표점이라도 네 방향 이동, 대각선 이동, 계단, 문, 예약된 시간대를 허용하는지에 따라 탐색해야 할 그래프가 달라집니다.

먼저 상태를 정합니다. 상태는 탐색이 다음 결정을 내리는 데 필요한 정보의 묶음입니다. 작은 지상 게임에서는 `(cell)`이면 충분할 수 있지만, 방향에 따라 선회 비용이 달라지면 `(cell, incomingDirection)`, 특정 시각의 점유를 고려하면 `(cell, tick)`이 필요합니다.

상태에서 빠진 정보는 탐색을 빠르게 만들 수 있어도 잘못된 경로를 낳습니다. 반대로 필요하지 않은 정보를 넣으면 같은 위치를 여러 상태로 복제해 탐색량과 메모리가 늘어납니다. “이 위치에 도착한 뒤의 합법적인 선택과 비용이 정말 항상 같은가?”를 기준으로 상태를 최소화합니다.

간선은 한 상태에서 다음 상태로 가는 합법적인 한 번의 이동입니다. 간선에는 이동 거리, 지형 비용, 문 통과 비용처럼 합산할 값을 둡니다. 충돌 가능 여부는 비용에 섞지 말고 먼저 합법성 판정을 통과시킨 뒤 비용을 더해야 실패 원인을 보존할 수 있습니다.

기초 BFS의 층 불변식과 부모 복원은 [`graph-search`](/tech-interview/notes/graph-search/)에서 다루므로 여기서는 이동 공간과 비용 모델이 바뀔 때 그 전제가 어떻게 달라지는지에 집중합니다.

## 이동 공간 표현

Grid는 공간을 셀로 나누고 이웃 셀을 간선으로 연결하는 표현입니다. 셀 점유와 건설·파괴를 직접 반영하기 쉽고, 이동 규칙을 반복 적용하기도 쉽습니다. 해상도가 낮으면 좁은 통로가 사라지거나 장애물 경계가 계단처럼 보이는 문제가 생깁니다.

NavMesh는 걸을 수 있는 표면을 다각형과 포털로 묶은 표현입니다. Recast 공식 페이지는 Recast를 게임용 navigation-mesh toolset과 navmesh generation의 영역으로, Detour를 runtime navmesh loading·pathfinding·navmesh queries의 영역으로 소개합니다. 이 구분은 생성 데이터와 런타임 질의를 나누는 근거이지 특정 릴리스의 ABI 보장은 아닙니다.

Voxel은 공간을 작은 부피 셀로 나누므로 여러 높이, 층, 동굴, 수직 이동을 표현하기에 유리합니다. 대신 셀 수가 커지고 고체와 빈 공간을 어떤 보수 규칙으로 판정할지 결정해야 합니다. 3차원에서 셀 한 변을 두 배로 하면 같은 부피의 셀 수는 대략 1/8이지만, 좁은 통로와 얇은 벽의 정보 손실은 단순한 셀 수 감소보다 중요한 품질 문제입니다.

지상 표면이 주된 정적 공간이면 NavMesh가 자연스럽고, 셀 단위 변경이 잦으면 Grid가 단순합니다. 여러 층과 자유로운 부피 이동이 핵심이면 Voxel이 맞을 수 있습니다. 일반성이 가장 큰 표현보다 이동 차원과 변경 패턴에 맞는 표현을 선택해야 합니다.

```diagram
{"title":"이동 공간의 그래프 변환","caption":"원본 공간과 에이전트 조건을 합쳐 탐색 그래프를 만들고, 탐색 결과를 실행 전에 다시 검증합니다.","rows":[[{"id":"world","label":"원본 지형·장애물"},{"id":"profile","label":"에이전트 크기·능력"}],[{"id":"space","label":"Grid·NavMesh·Voxel 이동 공간"}],[{"id":"graph","label":"상태·합법 간선·비용 그래프"}],[{"id":"path","label":"탐색 경로"}],[{"id":"verify","label":"실행 직전 충돌 검증"}]],"edges":[{"from":"world","to":"space","label":"공간 파생"},{"from":"profile","to":"space","label":"통과 조건"},{"from":"space","to":"graph","label":"이동 규칙"},{"from":"graph","to":"path","label":"검색"},{"from":"path","to":"verify","label":"실행 경계"}]}
```

## 에이전트 조건

빈 셀은 점 하나가 지나갈 수 있다는 뜻일 뿐, 몸체가 지나갈 수 있다는 뜻은 아닙니다. 평면에서 회전 없이 이동하는 반경 `r`의 원형 에이전트라면 장애물에 반경을 더한 영역을 중심점의 금지 영역으로 바꿀 수 있습니다. 이 변환을 장애물 팽창이라고 합니다.

폭이 `W`인 통로를 반경 `r`인 몸체가 지나가려면 접촉 등호와 수치 여유를 고려해 대략 `W > 2r`이어야 합니다. 실제 시스템에서는 높이, 경사, 계단, 선회, 비원형 몸체가 더해지므로 반경 하나로 모든 이동을 설명하지 않습니다. 이 기하 전제는 [`navigation-clearance`](/tech-interview/notes/navigation-clearance/)의 깊은 설명과 연결됩니다.

대각선 규칙도 고정해야 합니다. 2×2 격자에서 대각선 양쪽 직교 셀이 모두 막혀 있다면 두 셀의 모서리만 비어 있다는 이유로 통과시키지 않는 보수적인 선택이 흔합니다. 탐색기와 실제 충돌 검사가 서로 다른 corner 규칙을 사용하면 탐색 성공 뒤 실행 실패가 발생합니다.

profile은 에이전트의 크기와 능력 묶음입니다. 같은 맵이라도 큰 몸체, 높은 계단을 못 오르는 몸체, 물을 건너지 못하는 몸체는 서로 다른 그래프를 봅니다. 캐시 키에는 profile과 map 또는 overlay의 버전을 넣어 작은 에이전트의 결과를 큰 에이전트에게 잘못 재사용하지 않아야 합니다.

## 비용 모델

이동 횟수와 이동 비용은 같은 값이 아닙니다. 모든 간선 비용이 1이면 경로 비용은 이동 횟수이고, BFS는 층별로 간선 수가 가장 작은 경로를 보장합니다. 간선 비용이 다르면 한 칸짜리 늪 비용 5가 평지 두 칸 비용 2보다 비쌀 수 있으므로 누적 비용을 비교해야 합니다.

Dijkstra는 유한한 정적 그래프에서 비음수 간선 비용을 전제로 누적 비용이 가장 작은 후보를 우선순위 큐에서 꺼냅니다. 음수 간선이 있으면 이미 확정한 정점의 비용이 뒤에서 낮아질 수 있으므로 확정 논리가 깨집니다. 비용의 유한성, 덧셈의 오버플로 여부도 입력 계약에 포함합니다. 자세한 거리 확정과 지연 삭제는 [`dijkstra`](/tech-interview/notes/dijkstra/)를 참조합니다.

A*는 Dijkstra의 누적 비용 `g`에 목표까지의 비용 하한을 추정하는 휴리스틱 `h`를 더해 `f = g + h`가 작은 후보를 먼저 선택합니다. 휴리스틱이 실제 남은 비용을 넘지 않는 성질을 허용성이라고 합니다. 4방향 단위 격자의 Manhattan 거리는 대표적인 하한이지만, 이동 규칙과 비용 단위가 바뀌면 다시 검증해야 합니다.

휴리스틱이 방향을 잘 안내한다는 사실만으로 최적성이 생기지는 않습니다. 허용적이지만 일관되지 않은 휴리스틱에서는 더 싼 `g`가 닫힌 정점에 늦게 도착할 수 있어 재오픈이 필요합니다. 이 차이는 [`astar`](/tech-interview/notes/astar/)와 [`astar-frontier`](/tech-interview/notes/astar-frontier/)에서 별도 반례로 깊게 다룹니다.

## 알고리즘 선택

| 입력 전제 | 기본 선택 | 종료와 반환의 의미 |
| --- | --- | --- |
| 모든 이동 비용이 1 | BFS | 큐의 층 순서가 간선 수의 최솟값을 보장 |
| 비음수 비용, 목표 없음 | Dijkstra | 전체 거리장을 완성할 때까지 실행 |
| 비음수 비용, 목표 지향, 검증된 하한 | A* | 목표가 최소 유효 후보로 확정될 때 종료 |
| 비용 모델과 휴리스틱 계약 불명확 | 보수적 일반 탐색 또는 입력 거절 | 최단성 주장을 하지 않음 |

목표가 하나이고 실제 남은 비용의 하한을 만들 수 있으면 A*가 적합합니다. 모든 셀에서 하나의 목표까지 비용이 필요하면 목표를 한 번 탐색하는 A*보다 목표에서 역방향 Dijkstra 또는 BFS로 전체 거리장을 만드는 편이 구조적으로 맞습니다. 여러 에이전트가 같은 목표로 움직이는 Flow Field는 이 전체 거리장을 공유하는 별도 방식입니다.

목표를 발견한 순간과 확정한 순간도 구분합니다. BFS의 전체 거리 반환은 목표를 발견해도 큐를 끝까지 처리해야 하고, Dijkstra와 A*의 목표 전용 반환은 목표가 최소 후보로 꺼내지는 경계를 사용합니다. 부분 상태를 전체 최단 거리 표처럼 노출하지 않도록 반환 종류를 분리합니다.

동적 맵을 탐색하는 동안 지형이 바뀌면 알고리즘 선택 이전에 스냅샷 경계가 필요합니다. 탐색이 시작할 때 읽은 맵 버전과 결과를 적용할 때의 버전이 다르면 경로를 성공으로 표시하지 않고 폐기하거나 재계산 대상으로 돌립니다.

## 격자 예제

다음 5×5 Grid에서 `S`에서 `G`로 네 방향 이동을 허용하고 `#`를 막힌 셀로 둡니다. 이 예제에는 위쪽 우회로와 아래쪽 우회로가 있으며, 각 경로의 간선 수는 8입니다.

```text
행0  S . . # .
행1  . # . # .
행2  . # . . .
행3  . # # # .
행4  . . . . G
```

이웃을 동쪽보다 남쪽부터 읽는다고 하면 BFS는 `S`에서 아래쪽 가지를 먼저 큐에 넣을 수 있습니다. 그렇더라도 `distance`에는 두 가지 경로가 모두 8로 기록됩니다. 목표를 처음 발견한 부모는 이웃 순서에 따라 달라질 수 있지만, 비용 8이라는 최단성은 변하지 않습니다.

| 거리 층 | 대표 셀 | 의미 |
| ---: | --- | --- |
| 0 | `S=(0,0)` | 출발 상태 |
| 1 | `(1,0)`, `(0,1)` | 한 번 이동한 후보 |
| 2 | `(2,0)`, `(0,2)` | 두 번 이동한 후보 |
| 3 | `(3,0)`, `(1,2)` | 두 가지 통로의 진행 |
| 4 | `(4,0)`, `(2,2)` | 두 경로가 각각 계속됨 |
| 5–7 | `(4,1..3)`, `(2,3)`, `(2,4)`, `(3,4)` | 목표에 접근하는 층 |
| 8 | `G=(4,4)` | 두 경로의 최단 간선 수 |

이제 `(3,0)`으로 들어가는 이동의 terrain cost를 4로 올리고 나머지 이동 비용을 1로 둡니다. 아래쪽 경로의 비용은 `1+1+4+1+1+1+1+1=11`이고, 위쪽 경로의 비용은 8입니다. BFS는 여전히 간선 수만 세므로 아래쪽 경로를 선택할 수 있지만, Dijkstra는 위쪽 경로를 선택합니다. “최단”이라는 단어가 간선 수인지 누적 비용인지에 따라 알고리즘과 결과가 달라지는 이유입니다.

## 상태 추적

BFS에서는 거리와 부모를 셀을 처음 발견하는 순간 함께 기록합니다. 큐가 거리의 비감소 순서로 처리되므로 처음 발견한 거리를 고정할 수 있습니다. 같은 거리로 나중에 도착한 경로는 고정된 동점 정책에 따라 버리거나 부모를 바꿀 수 있지만, 모든 최단 경로를 보존하는 것은 아닙니다.

Dijkstra에서는 오래된 힙 항목이 남을 수 있습니다. 어떤 셀의 후보가 비용 5로 들어갔다가 다른 경로를 통해 3으로 개선되면 `(5, cell)`은 나중에 꺼내져도 현재 거리와 다르므로 버립니다. 부모는 거리 3을 만든 직전 상태와 같은 논리적 갱신에서 바꿉니다.

A*에서는 `g`, `h`, `f`, `parent`, `closed`를 함께 기록합니다. 목표가 힙에 처음 들어갔다는 사실은 후보가 생겼다는 뜻일 뿐입니다. 일관성이 없는 휴리스틱을 허용하는 구현에서는 닫힌 정점의 더 싼 `g`를 발견했을 때 다시 열고 뒤따르는 간선을 재완화합니다.

## 반환 계약

호출자는 성공, 도달 불가, 잘못된 입력, 미완료를 구분할 수 있어야 합니다. 그래프에 없는 목표는 거리 `INF`가 아니라 `invalid_input`입니다. 그래프에는 있지만 출발점에서 도달하지 못한 목표는 `unreachable`이며 경로는 빈 목록입니다.

전체 거리장이 필요한 호출은 `all_distances_complete=true`와 함께 모든 정점의 거리와 부모를 반환합니다. 목표 전용 호출이 목표를 확정해 중단했다면 목표 경로만 완전한 결과이고, 나머지 `distances_so_far`는 부분 상태로 이름을 구별합니다.

경로 복원은 부모를 목표에서 출발점까지 거꾸로 따라갑니다. 부모 갱신과 비용 갱신이 분리되면 거리값은 새 경로인데 부모는 예전 경로인 모순이 생길 수 있으므로 한 논리적 갱신으로 묶습니다. 복원 중 cycle, 존재하지 않는 부모, 경로 합과 보고된 비용의 불일치는 오류 상태로 처리합니다.

```text
search(snapshot, start, goal, profile):
    validate_vertices_edges_costs(snapshot, start, goal, profile)
    graph = build_or_load_graph(snapshot, profile)
    if graph.costs_are_all_one:
        result = bfs(graph, start, goal)
    else if goal is NONE:
        result = dijkstra_all(graph, start)
    else:
        result = astar_with_verified_heuristic(graph, start, goal)
    validate_return_state(result)
    return attach(snapshot.version, profile.version, result)
```

위 코드는 특정 언어의 실행 코드가 아니라 의사코드입니다. `build_or_load_graph`가 반환한 데이터는 탐색이 끝날 때까지 스냅샷 수명이 유지되어야 하고, 비동기 작업이면 취소 통지와 실제 작업 종료 뒤에만 참조를 회수해야 합니다.

## 운영 적용

좁은 문과 계단을 지나는 지상 NPC를 생각해 보겠습니다. NavMesh 질의는 시작점과 목표점에 가까운 polygon을 찾고 polygon reference corridor를 반환할 수 있습니다. 공식 `dtNavMeshQuery` 문서는 `findPath`를 시작 polygon에서 끝 polygon까지의 경로로, `findStraightPath`를 corridor를 string-pulling waypoint로 변환하는 질의로 설명합니다. 이 결과가 미래 이동의 충돌 검사를 끝냈다는 뜻은 아닙니다.

시작점이 NavMesh에 붙지 않거나 목표가 미로딩 tile에 있으면 Grid fallback 또는 정상적인 대기를 반환합니다. tile, source geometry, profile, dynamic overlay의 버전이 일치하지 않으면 오래된 polygon reference를 실행하지 않습니다. 이 장에서는 실제 Recast bake나 query를 실행하지 않았으므로 특정 처리 시간이나 현재 릴리스 동작을 주장하지 않습니다.

운영 로그에는 `requestId`, `mapVersion`, `profileVersion`, `algorithm`, `expandedNodes`, `resultKind`, `pathCost`, `pathLength`, `replanReason`을 남깁니다. 비용과 길이가 함께 있어야 smoothing 뒤 길이는 줄었지만 terrain 비용은 늘어난 경우를 구분할 수 있습니다.

## 검증 범위

작은 그래프에서 Dijkstra를 기준 결과로 삼고 모든 start/goal 조합의 도달성·비용·부모 경로를 BFS와 A*에 대조합니다. 균일 비용, 가중 비용, 음수 비용, overflow, 잘못된 정점, 대각 corner, profile mismatch, unknown tile을 각각 별도 입력으로 둡니다.

경로 실행 검증은 탐색 검증과 분리합니다. 탐색이 합법 간선을 반환했는지 확인한 뒤 실제 footprint sweep과 이동 직전의 map version을 확인합니다. smoothing이나 funnel로 경로가 바뀌면 새 선분을 같은 충돌·비용 규칙으로 재검증합니다.

## 참고 자료와 검증 범위

- [Recast Navigation 공식 프로젝트 페이지](https://recastnav.com/) — 2026-09-17 확인. 특정 소프트웨어 release/version이 없는 공식 개요이며 navmesh generation과 Detour runtime query 역할의 근거로만 적용했습니다.
- [Recast Navigation 공식 README](https://github.com/recastnavigation/recastnavigation/blob/main/README.md) — 2026-09-17 확인. 표시된 `main` 브랜치 문서이며 input geometry의 voxel rasterization과 tiled navmesh 개념의 근거입니다. 고정 릴리스 계약은 아닙니다.
- [`dtNavMeshQuery` API reference](https://recastnav.com/classdtNavMeshQuery.html) — 2026-09-17 확인. 공식 API 문서 페이지에서 nearest polygon, polygon corridor, straight-path 변환과 buffer 주의를 확인했습니다. release 번호와 API revision, 성능은 확인하지 않았습니다.
- [Implementation of A*](https://www.redblobgames.com/pathfinding/a-star/implementation.html) — 2026-09-17 확인. 특정 소프트웨어 release가 아닌 저자 관리 교육 자료이며 FIFO와 `g+h` 우선순위 설명에 사용했습니다.
- [Grid pathfinding optimizations](https://www.redblobgames.com/pathfinding/grids/algorithms.html) — 2026-09-17 확인. 특정 구현 release가 없는 교육 자료이며 Grid의 graph 모델과 균일 비용에서 BFS를 선택하는 설명에 사용했습니다.
- 예제 숫자는 본문 산술과 상태 흐름을 설명하기 위한 계산입니다. 실제 Recast/Detour bake·query, 게임 엔진 충돌, 성능 벤치마크는 실행하지 않았습니다.

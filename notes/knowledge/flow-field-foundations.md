---
id: flow-field-foundations
title: Flow Field와 다중 에이전트 이동
topic: 게임 서버
summary: 공통 목표를 향하는 여러 에이전트가 하나의 역방향 거리장과 방향장을 공유하는 원리, 갱신 경계, 예약과 회피의 역할을 설명합니다.
questionIds: []
prerequisites: [pathfinding-foundations, dijkstra]
related: [path-execution, space-time-reservations, behavior-lifetime, astar-frontier]
reviewedAt: '2026-09-17'
---

# Flow Field와 다중 에이전트 이동

## 다중 출발점과 공통 목표

같은 성문으로 달려가는 NPC가 100명이라고 해 보겠습니다. 각 NPC마다 현재 위치에서 성문까지 A*를 반복하면 출발점만 다르고 목표 방향의 계산은 반복됩니다. 목표가 하나이고 이동 규칙과 비용이 같은 경우 목표에서 전체 공간으로 한 번 전파한 결과를 공유하는 편이 자연스럽습니다.

Flow Field는 보통 거리장과 방향장을 함께 가리킵니다. 거리장은 각 cell에서 목표까지 도달하는 데 필요한 누적 비용이고, 방향장은 현재 cell에서 더 낮은 비용으로 향하는 다음 이동 방향입니다. 방향장 조회는 경로 전체를 배열로 저장하는 것과 달리 에이전트가 현재 위치에서 매 순간 다음 방향을 읽게 합니다.

이 방식은 “많은 출발점, 하나의 목표”에 맞습니다. 목표가 서로 다르면 field를 나누거나 개별 탐색을 사용해야 합니다. 에이전트 profile과 비용 규칙이 다르면 같은 field를 공유할 수 없으며, 같은 거리장이라도 footprint와 이동 가능성이 다르면 방향을 적용하기 전에 별도 검증이 필요합니다.

Flow Field는 길찾기 결과 전체가 아니라 공유 가능한 안내 자료입니다. 예약, 충돌, 목표 최신성, 행동 취소는 field가 대신하지 않습니다. 다중 agent의 시간·공간 예약은 [`space-time-reservations`](/tech-interview/notes/space-time-reservations/)에서, 행동과 callback 수명은 [`behavior-lifetime`](/tech-interview/notes/behavior-lifetime/)에서 깊게 다루므로 이 장은 거리장 생성과 실행 경계를 연결합니다.

## 그래프 변환

Grid의 각 이동 가능한 cell을 정점으로 보고 이웃 cell로 이동하는 합법적인 이동을 간선으로 봅니다. 벽, corner 규칙, agent footprint, 일방통행, 층 portal은 모두 간선 생성 조건에 들어갑니다. 빈 cell만 보고 field를 만들면 실제 몸체가 통과하지 못하는 방향이 생길 수 있습니다.

목표 `G`에서 시작해 각 간선을 거꾸로 따라가면 각 cell에 `G`까지의 비용을 기록할 수 있습니다. 무방향 Grid라면 같은 이웃 관계를 사용하면 됩니다. 방향 간선이라면 목표로 들어가는 원래 간선을 역방향으로 읽는 구조가 필요합니다. 방향을 뒤집지 않고 출발점에서 목표로 전파하면 many-to-one의 모든 출발점 비용을 만들 수 없습니다.

모든 간선 비용이 1이면 BFS의 층 전파로 거리장을 만들 수 있습니다. terrain cost, 경사, 문 비용처럼 비음수 가중치가 있으면 Dijkstra의 누적 비용 전파를 사용합니다. 비용이 음수이면 Dijkstra의 확정 전제가 깨지므로 field 구성 전에 입력을 거절하거나 다른 알고리즘 계약으로 넘깁니다.

가중치가 출발 방향이나 도착 시각에 따라 달라지는 모델에서는 cell 하나가 충분한 상태가 아닐 수 있습니다. `(cell, incomingDirection)` 또는 `(cell, tick)`을 field의 상태 축으로 넣어야 forward 이동 비용을 정확히 표현할 수 있습니다. 상태를 확장하지 않고 cell 숫자만 저장한다면 그 field의 비용 의미와 최적성 주장을 좁혀야 합니다.

## 거리장 구성

거리장 표를 `D[cell]`로 두고 목표의 값을 0으로 초기화합니다. 아직 도달하지 않은 cell은 `INF` 또는 명시적인 unknown 상태로 둡니다. BFS는 queue에 목표를 넣고 새 cell을 `D[current]+1`로 기록하며, Dijkstra는 최소 누적 비용을 우선순위 큐에서 꺼내 더 싼 값을 완화합니다.

방향 간선의 역방향 거리장을 만들 때는 역간선의 비용이 원래 forward edge의 비용과 일치해야 합니다. 예를 들어 `u→v`의 비용이 7이면 역방향 전파에서 `v`에서 `u`로 돌아갈 때도 7을 더해야 `D[u]`가 `u`에서 `v`를 거쳐 목표로 가는 비용을 뜻합니다. 일방통행을 무시한 채 이웃만 대칭으로 만들면 도달성부터 달라집니다.

다음 5×5 맵에서 `G`를 목표로 둡니다.

```text
행0  . . . # .
행1  . # . # .
행2  . . G . .
행3  # . # # .
행4  . . . . .
```

네 방향 균일 비용에서 `G`의 거리는 0, 위·왼쪽·오른쪽의 바로 연결된 cell은 1입니다. 행0의 오른쪽 위 영역은 벽 때문에 직접 접근할 수 없고 열린 통로를 따라 거리 층이 늘어납니다. `INF`로 남은 영역은 “멀다”가 아니라 현재 규칙에서 목표에 도달할 수 없다는 뜻입니다.

```diagram
{"title":"목표에서 퍼지는 거리장과 방향장","caption":"목표를 거리 0으로 두고 역방향으로 전파한 뒤, 각 cell에서 더 낮은 이웃을 방향 후보로 선택합니다.","rows":[[{"id":"goal","label":"공통 목표 G","detail":["distance=0"]}],[{"id":"distance","label":"역방향 거리장","detail":["reachable cell 비용"]}],[{"id":"direction","label":"방향장","detail":["최적 비용·비순환 후속"]}],[{"id":"agents","label":"다수 에이전트의 local query","detail":["현재 cell→다음 방향"]}]],"edges":[{"from":"goal","to":"distance","label":"BFS·Dijkstra 전파"},{"from":"distance","to":"direction","label":"부모·비용 관계 선택"},{"from":"direction","to":"agents","label":"공유 안내"}]}
```

## 방향장 산출

모든 간선 비용이 양수라면 각 cell의 방향은 이웃 중 `D[next] < D[cell]`인 후보를 찾는 방식으로 만들 수 있습니다. 균일 비용에서는 정확히 1만큼 낮은 이웃을 선택합니다. 가중치가 있으면 거리 차이만 보지 말고 `D[next] + cost(cell,next) = D[cell]` 또는 그에 준하는 완화 관계를 확인해야 합니다.

예를 들어 현재 cell의 `D=7`이고 동쪽 이웃의 `D=3`, 동쪽 이동 비용이 4라면 `3+4=7`이므로 최적 비용을 유지하는 방향 후보입니다. 남쪽 이웃의 `D=5`라도 이동 비용이 3이면 `5+3=8`이므로 단순히 거리 숫자가 더 작다는 이유로 선택해서는 안 됩니다.

비용 0 간선을 허용하면 최적 경로에서도 D가 줄지 않을 수 있습니다. 이때 거리값만 보고 방향을 독립 선택하면 0비용 순환이 생길 수 있으므로, 역방향 탐색에서 확정한 목표 지향 부모 트리나 비순환 보조 순위를 함께 저장합니다.

동일한 최저 후보가 여러 개면 tie-break를 고정합니다. 북쪽, 동쪽, 남쪽, 서쪽 순서를 고정하면 같은 입력에서 같은 방향장이 만들어집니다. 동점 선택은 최적 비용을 바꾸지 않지만 에이전트가 어느 길목으로 몰리는지와 replay 결과를 바꿀 수 있습니다.

방향장을 벡터로 저장할 수도 있고 이웃 index나 부모 방향 코드로 저장할 수도 있습니다. 저장 형식은 map version, profile, cost profile과 함께 버전이 맞아야 합니다. 계산이 끝난 field를 공개할 때는 거리와 방향이 서로 다른 세대가 되지 않도록 하나의 불변 bundle로 발행합니다.

## 비용과 공유 범위

5×5 예제의 중앙 통로에 terrain cost 4를 넣으면 BFS field와 Dijkstra field가 달라집니다. BFS는 칸 수가 적은 쪽을 선택하지만 Dijkstra는 비싼 cell을 우회하는 길의 누적 비용이 낮으면 그쪽에 더 작은 값을 기록합니다. 같은 위치에서 field를 읽는 에이전트라도 비용 규칙이 다르면 서로 다른 방향을 받아야 합니다.

field의 거리 단위는 한 가지로 고정합니다. 이동 횟수, 실제 거리, terrain cost, 선회 cost를 혼합하면서 표 이름을 모두 `distance`라고 쓰면 운영자가 품질을 해석하기 어렵습니다. `costToGoal`처럼 의미를 드러내거나 실제 거리와 누적 비용을 별도 채널로 저장합니다.

선회 비용을 포함하면 cell 하나만으로는 다음 방향의 비용을 알 수 없습니다. `(cell, incomingDirection)` 상태를 만들거나 선회 비용을 field 계산에서 제외하고 실행 계층의 local policy로 처리해야 합니다. 후자의 경우 field는 전체 비용에 대해 최적이라는 자료가 아니므로 그 주장을 하지 않습니다.

profile이 다른 두 agent가 같은 field를 공유할 수 있는 조건은 이동 가능한 cell과 간선 비용이 실제로 같을 때뿐입니다. 큰 agent가 통과하지 못할 좁은 통로가 field에 포함되어 있다면 profile별 field를 만들거나 clearance 기반 질의로 그 방향을 차단합니다. 작은 agent field의 경로가 큰 agent에 안전하다고 가정하지 않습니다.

## 에이전트 실행

각 simulation tick에서 에이전트는 현재 위치를 field cell로 변환하고 방향장을 조회합니다. 조회 결과가 unknown, unreachable, stale이면 이전 방향을 계속 밀어붙이지 않고 정지·fallback·개별 재탐색 중 하나를 선택합니다. cell 변환은 음수 좌표와 경계 포함 규칙을 고정해야 합니다.

방향 벡터를 바로 속도로 쓰지 않고 다음 상태를 거칩니다. 먼저 footprint와 다음 선분의 충돌을 검사하고, 예약이 필요하면 cell·edge·tick을 조건부로 확정합니다. 예약에 실패하면 같은 field의 다른 tie 방향을 시도하거나 대기 cell로 물러나고, 일정 횟수 뒤에는 개별 재계획을 요청합니다.

field가 성문으로 모든 NPC를 안내해도 성문 앞 병목은 사라지지 않습니다. local avoidance는 짧은 거리에서 이웃과 부딪히지 않도록 방향이나 속도를 조정할 수 있지만 좁은 통로에서의 전체 교착을 자동으로 해결하지는 않습니다. vertex·edge·footprint reservation은 시간과 공간 충돌을 별도로 다룹니다.

```text
step_agent(agent, field, world, tick):
    cell = world.to_cell(agent.position)
    if field.bundleVersion != world.current_bundle_version:
        return stop_or_replan("stale_field")
    direction = field.direction[cell]
    if direction is UNKNOWN or direction is UNREACHABLE:
        return stop_or_fallback("no_direction")
    candidate = integrate(agent.position, direction, tick.delta)
    if not sweep_clear(agent.footprint, agent.position, candidate, world):
        return request_replan("sweep_blocked")
    if not reserve_atomically(agent, candidate, tick):
        return wait_or_choose_tie_direction(agent, field, tick)
    return move(candidate)
```

위 블록은 특정 엔진의 실제 API 코드가 아니라 의사코드입니다. `field`와 `world`는 같은 버전 bundle을 읽어야 하고 `reserve_atomically`는 조회와 확정을 한 권위 경계에서 처리해야 합니다. 예약 실패 뒤에 이미 이동했다고 상태를 기록하지 않는 것도 중요합니다.

## 변경 갱신

벽을 켜거나 끄면 이전 field의 일부 방향이 stale이 됩니다. 가장 단순한 정책은 영향을 받는 field 전체를 다시 계산하고 새 bundle이 완성된 뒤 원자적으로 교체하는 것입니다. 이 정책은 계산량을 예측하기 쉽지만 큰 맵에서 작은 문 변화가 전체 계산으로 이어질 수 있습니다.

지역 갱신은 변경 cell 주변에서 영향이 퍼지는 범위를 계산해 부분적으로 다시 전파하는 방식입니다. 그러나 한 cell의 비용 증가가 멀리 있는 여러 최단 경로의 선택을 바꿀 수 있으므로 단순히 변경 cell만 다시 쓰는 것으로 충분하지 않을 수 있습니다. 영향 범위를 증명할 수 없으면 전체 rebuild나 보수적인 넓은 지역 rebuild를 사용합니다.

변경이 잦을 때는 field를 계산 중인 bundle과 현재 실행 중인 bundle로 나눕니다. 계산 중인 자료에 일부 cell만 새 값이 들어간 상태를 공개하면 한 NPC는 새 거리, 다른 NPC는 옛 방향을 읽을 수 있습니다. 준비가 끝난 bundle에 `fieldVersion`, `mapVersion`, `profileVersion`, `costVersion`을 붙이고 한 번에 교체합니다.

동적 refresh에 관한 표준 계약이나 현재 엔진의 증분 field 구현 성능은 감사 자료에서 확인되지 않았습니다. Red Blob의 교육 페이지는 벽을 켜고 끄는 예와 many-to-one 공유 개념을 보여 주지만 edit 이후의 refresh 원자성·증분 범위·crowd 예약 통합을 보장하지 않습니다.

## 목표와 수명

목표를 바꾸면 같은 맵에서도 기존 field는 새 목적을 표현하지 않습니다. 성문 `G1`에서 성벽 뒤 `G2`로 바뀌면 goal version을 올리고 새 field를 계산합니다. 계산 중에는 에이전트가 이전 목표로 계속 달릴지 안전 지점에서 멈출지를 정책으로 정합니다.

목표가 잠시 바뀌었다가 다시 돌아오는 경우 field를 cache할 수 있지만 map·overlay·profile·cost version이 모두 맞아야 합니다. 오래된 cache를 빠르게 쓰는 것보다 재계산을 기다리는 것이 안전한 상황도 있습니다. unknown tile을 빈 공간으로 간주해 field를 만들지 않습니다.

에이전트가 field의 방향을 읽는 동안 bundle 메모리를 해제하면 안 됩니다. 읽기 수명, atomic publication, retired bundle 회수 시점을 정하고 reader가 끝난 뒤에만 이전 field를 반환합니다. 세대 숫자만 검사하고 이미 해제된 배열에 접근하는 것은 안전하지 않습니다.

## 병목과 공정성

공통 목표 field는 모든 에이전트를 같은 병목으로 끌어 모을 수 있습니다. 방향 tie-break를 바꾸거나 목표 주변에 비용을 추가하면 분산을 유도할 수 있지만 비용을 임의로 바꾸면 최단 비용의 의미도 바뀝니다. 병목 분산은 비용 모델의 명시적 정책으로 다룹니다.

예약 순서는 field가 정하지 않습니다. 같은 cell과 tick을 원하는 에이전트의 우선순위, 대기 나이, 안정적인 entity ID를 권위 tick에서 결정합니다. network 도착 순서나 worker 완료 순서에 맡기면 replay가 달라지고 특정 NPC가 계속 밀릴 수 있습니다.

좁은 외길에서 두 에이전트가 마주 보고 뒤로 물러날 공간이 없다면 field를 다시 계산해도 이동 해가 생기지 않습니다. wait-for cycle을 감지하고 양보 cell이나 후퇴 경로가 있는지 찾은 뒤, 해가 없으면 중지 상태를 반환합니다. aging은 순서를 바꿀 수 있지만 물리적으로 없는 공간을 만들지는 못합니다.

## 운영 예제

성문 하나를 목표로 50개의 작은 NPC와 20개의 큰 NPC가 이동합니다. 작은 NPC용 field에는 폭 1.5인 통로가 reachable이지만 큰 NPC의 반경으로 팽창한 공간에서는 같은 통로가 막힙니다. 두 profile을 같은 방향장으로 처리하면 큰 NPC가 문 앞에서 반복 실패하므로 field를 profile별로 나눕니다.

틱 0에는 두 field 모두 `fieldVersion=12`입니다. 틱 4에 문이 닫혀 `overlayVersion=8`이 되면 두 field의 영향을 받은 영역을 dirty로 표시합니다. 틱 5에 작은 NPC가 옛 방향을 읽더라도 이동 직전 overlay version과 sweep이 실패해 멈추거나 재계획해야 합니다.

틱 7에 새 작은 NPC field가 `fieldVersion=13`으로 완성되면 bundle을 교체합니다. 큰 NPC field가 아직 준비되지 않았다면 큰 NPC는 작은 field를 임시로 쓰지 않고 대기 또는 개별 A* fallback을 선택합니다. 이 예제의 틱과 개수는 상태 흐름을 설명하기 위한 값이며 부하 측정 결과가 아닙니다.

## 검증 범위

작은 Grid에서 모든 cell을 시작점으로 삼아 개별 BFS 또는 Dijkstra를 실행하고 field의 cost와 도달성을 비교합니다. 방향장은 각 cell에서 field cost를 실제 forward edge cost로 한 번 더 완화했을 때 일치해야 합니다. 동점 cell은 고정된 tie-break로 비교합니다.

가중 terrain, blocked goal, unreachable region, multiple goal, wall toggle, profile mismatch, unknown tile을 각각 시험합니다. 벽을 바꾼 뒤 옛 field를 읽는 reader와 새 field를 읽는 reader를 동시에 두고 혼합 세대의 거리·방향이 공개되지 않는지 확인합니다.

실행 검증은 reservation과 함께 합니다. 같은 vertex 동시 도착, edge swap, 대각 segment 교차, 큰 footprint, reservation 실패 뒤 재시도, horizon 끝 대기를 재현합니다. field가 충돌을 숨기지 않고 실행 계층에 정상적으로 실패를 전달하는지가 핵심입니다.

부하 검증에서는 field 계산 횟수, field bytes, agent당 방향 조회, sweep 실패, reservation 대기, 개별 fallback, queue wait, tick overrun을 분리합니다. 이 장에서는 실제 부하를 실행하지 않았으므로 p95·p99나 NPC 수용량을 주장하지 않습니다.

## 참고 자료와 검증 범위

- [Flow Field Pathfinding for Tower Defense](https://www.redblobgames.com/pathfinding/tower-defense/) — 2026-09-17 확인. Amit J. Patel의 2014 교육 페이지이며 현재 engine/runtime version은 없습니다. many-to-one 경로 정보 공유, 비균일 비용에서 Dijkstra 사용, wall toggle 예의 개념 근거로만 사용했습니다. refresh 원자성·증분 갱신·reservation 통합의 공식 근거로 사용하지 않았습니다.
- [Implementation of A*](https://www.redblobgames.com/pathfinding/a-star/implementation.html) — 2026-09-17 확인. 특정 소프트웨어 release가 아닌 저자 관리 교육 자료이며 누적 비용과 휴리스틱 합으로 우선순위를 구성하는 설명에 사용했습니다.
- [Recast Navigation 공식 프로젝트 페이지](https://recastnav.com/) — 2026-09-17 확인. 특정 release/version이 없는 공식 개요이며 navmesh generation과 runtime query 역할을 구분하는 근거로만 사용했습니다. Flow Field 구현이나 성능을 말하지 않습니다.
- [Recast Navigation 공식 README](https://github.com/recastnavigation/recastnavigation/blob/main/README.md) — 2026-09-17 확인. 표시된 `main` 브랜치 문서이며 voxel rasterization과 tiled navmesh 개념에만 적용했습니다. 고정 release나 dynamic refresh 계약이 아닙니다.
- 실제 Flow Field 구현, wall refresh, crowd load test, reservation 결합 실행은 하지 않았습니다. 예제의 맵, 틱, NPC 수는 메커니즘 설명용입니다.

---
id: navigation-production
title: 실시간 길찾기 구현과 운영
topic: 게임 서버
summary: 동적 맵과 이동 목표를 스냅샷·세대·재검증으로 관리하고, NavMesh·Grid 탐색을 틱 예산과 비동기 실행 안에서 운영하는 방법을 설명합니다.
questionIds: []
prerequisites: [pathfinding-foundations, synchronization-foundations]
related: [astar-frontier, space-time-reservations, graph-search, dijkstra, astar]
reviewedAt: '2026-09-17'
---

# 실시간 길찾기 구현과 운영

## 실시간 문제의 경계

정적 예제의 길찾기는 하나의 맵과 하나의 요청이 끝까지 변하지 않는다고 가정합니다. 실시간 게임 서버에서는 문이 닫히고, 목표가 움직이며, NPC가 취소되고, 탐색 작업이 simulation tick과 CPU를 나눠 씁니다. 따라서 검색 알고리즘이 수학적으로 맞아도 실행 결과가 안전하다고 말할 수는 없습니다.

실시간 길찾기는 세 가지 시간을 구분합니다. 요청이 생성된 시각의 세계 상태, 탐색이 읽는 불변 스냅샷, 결과를 적용하려는 현재 세계 상태입니다. 이 세 상태가 다를 수 있다는 사실을 데이터 모델에 명시해야 늦은 결과를 정상적으로 폐기할 수 있습니다.

경로 결과에는 최소한 `requestId`, `entityId`, `actionGeneration`, `mapVersion`, `overlayVersion`, `profileVersion`, `goalGeneration`을 연결합니다. 이 값 중 하나라도 현재 적용 조건과 다르면 경로 계산 자체가 성공했더라도 현재 행동의 결과로 적용하지 않습니다.

계획과 실행을 하나의 성공 플래그로 합치면 문이 닫힌 뒤의 오래된 경로와 현재 유효한 경로를 구분하기 어려워집니다. 계획은 특정 입력 스냅샷에서의 결과이고, 실행은 현재 형상·예약·행동 세대를 다시 확인하는 별도 단계입니다. 기존 [`path-execution`](/tech-interview/notes/path-execution/)은 이 실행 경계를 설명하므로 여기서는 서비스 운영과 변경 전파에 집중합니다.

## 상태와 버전

맵 버전은 지형과 정적 장애물의 변화 세대입니다. overlay 버전은 문, 임시 차단, 점유처럼 별도로 갱신되는 동적 상태의 세대입니다. 목표 세대는 같은 NPC가 추적에서 도주로 바뀌거나 목표 위치를 새로 받았을 때 올리는 값입니다.

버전은 포인터 안전장치가 아닙니다. 세대가 다르면 결과를 논리적으로 무효화할 뿐이고, 오래된 작업이 실제로 끝나기 전에는 그 작업이 읽고 있는 스냅샷과 worker permit을 해제하면 안 됩니다. 세대 검사와 물리적 수명 회수는 별도의 계약입니다.

의존 영역은 어떤 변화가 특정 경로에 영향을 줄 수 있는지를 나타냅니다. world 전체를 의존 영역으로 잡으면 안전하지만 문 하나의 변화에도 모든 NPC가 재탐색합니다. cell·corridor·footprint 단위로 좁히면 비용을 줄일 수 있지만, 누락된 영향은 잘못된 경로를 실행시키는 false negative가 됩니다.

정밀한 invalidation을 아직 증명하지 못했다면 넓은 범위 재탐색을 선택합니다. 실행 직전 sweep은 누락된 의존 영역을 보완할 수 있지만, 검색 결과가 이미 위험 구간을 지나도록 계획된 문제를 모두 대신 해결하지는 않습니다.

## 생성 파이프라인

Recast 공식 자료는 Recast의 navmesh generation과 Detour의 runtime loading·pathfinding·navmesh queries를 구분합니다. 운영 파이프라인도 원본 geometry에서 이동 공간을 만드는 단계와 런타임에 그 공간을 읽고 질의하는 단계를 분리하는 편이 명확합니다.

tiled navmesh는 공식 README에서 더 크고 동적인 환경을 위한 선택으로 설명되지만, 문 하나가 자동으로 안전하게 갱신된다는 보장으로 확대하면 안 됩니다. tile rebuild와 publication 방식, reader가 이전 tile을 언제까지 볼 수 있는지는 이 프로젝트의 자료구조와 고정된 API 버전으로 별도 정의해야 합니다.

동적 문을 navmesh 원본에 매번 굽는 대신 정적 NavMesh와 문 overlay를 함께 질의하는 구조를 생각할 수 있습니다. 이때 overlay가 polygon corridor의 모든 통과 조건을 표현하는지 확인해야 합니다. 표현하지 못하는 문·높이·선회 조건은 실행 직전 형상 검사나 다른 공간 표현으로 넘깁니다.

NavMesh query 결과는 곧 waypoint 목록이라고 가정하지 않습니다. 공식 `dtNavMeshQuery` 문서는 가까운 polygon 검색, polygon reference corridor를 반환하는 `findPath`, corridor를 string-pulling waypoint로 바꾸는 `findStraightPath`를 설명합니다. buffer 부족과 incremental query의 상태 수명 주의도 문서에 있으므로 고정 크기 버퍼와 query 객체 수명을 반환 계약에 포함합니다.

```diagram
{"title":"실시간 경로 결과의 수명","caption":"탐색 성공은 적용 허가가 아닙니다. 현재 세대와 버전, 다음 이동 구간의 형상 검증을 통과한 결과만 simulation에 반영합니다.","rows":[[{"id":"intent","label":"최신 의도·목표 세대"},{"id":"world","label":"맵·overlay 스냅샷"}],[{"id":"request","label":"버전이 묶인 요청"}],[{"id":"search","label":"비동기 탐색"}],[{"id":"gate","label":"현재 세대·버전 대조"}],[{"id":"sweep","label":"다음 구간 형상 검사"}],[{"id":"apply","label":"틱 실행 경로"}]],"edges":[{"from":"intent","to":"request","label":"목표 고정"},{"from":"world","to":"request","label":"불변 입력"},{"from":"request","to":"search","label":"수명 보유"},{"from":"search","to":"gate","label":"늦은 결과 가능"},{"from":"gate","to":"sweep","label":"현재 조건"},{"from":"sweep","to":"apply","label":"실행 허가"}]}
```

## 동적 변화 처리

문이 닫히는 이벤트가 들어오면 먼저 영향 범위를 계산합니다. 문이 놓인 cell 하나만 막는지, 몸체 반경 때문에 주변 cell과 portal도 막는지, 이미 예약된 corridor의 일부를 끊는지 차례로 확인합니다. 영향 범위를 계산할 수 없으면 안전한 기본값으로 더 넓은 tile 또는 world 범위를 dirty로 표시합니다.

변경이 드물고 영향 범위가 좁으면 full replan보다 지역 invalidation이 유리할 수 있습니다. 변경이 연속으로 쌓이거나 대부분의 경로가 같은 병목을 지나면 여러 지역 재계산을 합쳐 한 번 처리하는 편이 나을 수 있습니다. 어떤 선택이 빠른지는 workload와 자료구조에 달려 있으며, 이 장에는 실행 수치가 없습니다.

LPA*는 이전 탐색 트리의 유용한 부분을 재사용하는 증분 탐색으로 소개됩니다. D* Lite는 CMU publication entry에서 unknown terrain의 robot navigation과 fast replanning 방법으로 소개됩니다. 이 자료는 재사용 원리와 적용 범위의 근거이지 현재 게임 서버에 바로 넣을 수 있는 라이브러리나 `rhs/g` 갱신 구현의 공식 사양은 아닙니다.

따라서 증분 탐색을 도입할 때는 알고리즘 상태를 요청 상태와 분리합니다. 변경된 edge 또는 정점이 기존 검색 상태의 어느 후속 상태를 더럽히는지 계산하고, 같은 스냅샷을 읽는 작업만 갱신합니다. source, goal, profile 또는 비용 규칙이 바뀌어 기존 상태의 의미가 달라지면 상태를 버리고 새 탐색으로 전환합니다.

## 재계획 정책

목표 변경은 문 변경과 다릅니다. 목표가 바뀌면 map version이 같아도 이전 결과의 목표 세대가 맞지 않으므로 폐기합니다. 이동 중인 목표는 거리 오차, 현재 경로의 유효성, 마지막 재계획 시각을 함께 사용해 cadence를 정합니다.

재계획 주기가 너무 짧으면 CPU와 큐가 늘고 취소된 작업이 끝날 때까지 스냅샷이 오래 살아 있습니다. 너무 길면 NPC가 이미 이동한 목표를 뒤쫓게 됩니다. 실제 수치를 정하기 전에는 목표 오차와 worker queue 대기를 함께 기록하고 workload에서 정책을 비교해야 합니다.

새 경로가 계산되는 동안 옛 경로를 모두 실행하지 않습니다. 현재 위치에서 다음 안전한 짧은 prefix만 실행하고 다음 구간에 들어가기 전 문·footprint·예약을 다시 확인합니다. 안전한 prefix가 없으면 멈추거나 이미 정의된 fallback 위치로 이동합니다.

여러 변경이 한 틱에 들어오면 NPC별 최신 목표 하나만 남기고 중간 요청을 합칩니다. 같은 문 변경으로 발생한 여러 요청은 지역 단위로 합치고 시작 시점을 나눠 CPU 파도를 피합니다. 위험 event는 일반 cooldown보다 먼저 처리하되 전역 worker와 queue 상한은 넘기지 않습니다.

## 실행 파이프라인

```text
request = capture(entity, intent, mapVersion, overlayVersion, profileVersion)
if request is older_than_latest(entity): reject(request)
snapshot = acquire_immutable_snapshot(request.versions)
permit = acquire_worker_permit_or_defer(request)
submit(request, snapshot, permit)

on_result(result):
    if not matches_current_entity_and_versions(result): discard(result)
    else if not validate_corridor_and_sweep(result): replan_or_stop(result)
    else apply_next_safe_prefix(result)

on_worker_exit(snapshot, permit):
    release_snapshot_after_all_readers_exit(snapshot)
    release(permit)
```

위 블록은 특정 언어의 실행 코드가 아닌 의사코드입니다. `acquire_immutable_snapshot`은 reader 수명을 보장해야 하고, `on_worker_exit`는 논리적 취소가 아니라 실제 작업 종료 지점에서 호출되어야 합니다. callback이 남아 있는 동안 객체를 먼저 해제하면 generation 비교 전에 use-after-free가 됩니다.

경로의 각 구간에는 다음 이동에 필요한 검증 정보를 붙입니다. profile의 footprint, corridor 또는 portal, map과 overlay의 version, 예약된 tick, smoothing 결과의 비용을 함께 저장합니다. 단순한 waypoint 배열만 저장하면 어떤 조건으로 만들어졌는지 재현하기 어렵습니다.

작업을 취소할 때는 `cancelRequested`와 `workerExited`를 서로 다른 상태로 보관합니다. 전자는 결과를 적용하지 않겠다는 논리적 의사 표시이고, 후자는 worker가 snapshot과 permit을 더 이상 읽지 않는다는 물리적 사실입니다. 둘을 하나의 `cancelled=true`로 합치면 조기 해제 또는 permit 누수가 생깁니다.

## Smoothing과 충돌

Smoothing은 waypoint 수를 줄이거나 꺾임을 완화하는 변환입니다. 두 점이 서로 보인다는 판정만으로 몸체가 이동 가능한 것은 아닙니다. 반경, 높이, 경사, 계단, 낙하, 일방통행, 동적 overlay를 포함한 선분 전체를 검사합니다.

Grid에서는 shortcut 후보마다 팽창 장애물 또는 실제 shape sweep을 적용합니다. 가장 먼 후보가 실패하면 가까운 후보를 시도하고 모두 실패하면 원래 경로를 유지합니다. NavMesh funnel은 portal corridor의 꺾임을 줄일 수 있지만 profile에 맞는 통로 폭과 층 연결이 살아 있는지 확인해야 합니다.

길이가 짧아졌다는 사실은 비용이 줄었다는 뜻이 아닙니다. 원래 우회가 10칸의 비용 1이라 비용 10이고, 새 직선이 6칸인데 그중 4칸의 terrain cost가 3이면 비용은 `4×3 + 2×1 = 14`입니다. 품질 계약이 비용 기반이라면 새 경로를 거절해야 합니다.

client가 화면상 경로를 부드럽게 그리는 것과 server가 이동을 허용하는 것은 분리합니다. 서버 권위 이동은 서버의 footprint, 시간 간격, 충돌 규칙으로 다음 위치를 검사하고 client smoothing은 그 결과를 시각화하는 범위에 둡니다.

## 다중 에이전트 경계

개별 경로가 모두 합법이어도 NPC끼리 같은 cell에 같은 tick 도착할 수 있습니다. vertex 예약은 같은 위치와 시각을 막고 edge 예약은 서로 반대 방향으로 동시에 이동하는 swap을 막습니다. 큰 몸체는 여러 cell과 이동 sweep을 예약해야 합니다.

실행 직전에 빈칸을 읽고 나중에 예약하면 두 NPC가 모두 성공할 수 있습니다. 권위 tick owner가 결정적 순서로 처리하거나 전체 footprint 조건을 원자적으로 확인하고 확정합니다. 예약 성공은 이동 완료가 아니므로 현재 entity generation과 충돌 상태를 다시 확인합니다.

Flow Field를 사용하더라도 예약과 local avoidance는 대체되지 않습니다. Flow Field는 공통 목표로 향하는 방향 안내를 공유하는 방식이고, 실제 공간·시간 충돌은 별도 실행 계층의 책임입니다. 방향 조회 결과를 이동 허가로 기록하지 않는 것이 이 경계의 핵심입니다.

## 서비스 예산

탐색 서비스의 전역 예산은 worker 수, queue 길이, snapshot bytes, 한 틱에 허용할 탐색 CPU를 포함합니다. NPC별 cooldown만 두면 많은 NPC가 동시에 요청하는 순간 전역 과부하를 막지 못합니다. 반대로 전역 FIFO만 두면 위험한 NPC가 오래 기다릴 수 있으므로 우선순위와 최소 진행을 함께 설계합니다.

각 결과에 `expandedNodes`, `reopenCount`, `staleHeapPops`, `queueWait`, `searchTime`, `snapshotBytes`, `discardReason`을 기록합니다. p50·p95·p99는 제품이 정한 목표와 비교할 때 의미가 있으며, 아직 측정하지 않았다면 숫자를 예시 성능처럼 쓰지 않습니다.

budget을 넘긴 탐색은 임의의 부분 경로를 성공으로 반환하지 않습니다. 정확 경로, 검증된 근사 경로, 미완료, 도달 불가, 입력 오류를 다른 상태로 노출합니다. 호출자는 미완료일 때 다음 안전 prefix를 유지하거나 정지하도록 분기해야 합니다.

## 실패 진단

늦은 결과가 현재 위치를 되돌리면 먼저 `actionGeneration`과 `requestId`를 비교합니다. 세대가 맞지만 경로가 벽을 통과하면 map 또는 overlay version과 footprint를 확인합니다. 경로는 맞지만 NPC끼리 충돌하면 vertex·edge·footprint 예약의 원자 확정을 확인합니다.

탐색 시간이 튀면 queue wait, 실제 search time, snapshot 복사량을 분리합니다. search time만 늘었다면 map 변화로 dirty 범위가 넓어졌거나 휴리스틱이 약해졌을 수 있습니다. queue wait만 늘었다면 공정성·coalescing·전역 permit 정책을 봅니다.

재계획 폭주가 보이면 목표 generation이 매 틱 올라가는지, 같은 map event가 여러 지역 이벤트로 중복 변환되는지, 취소된 작업의 실제 종료가 늦어 permit이 반환되지 않는지 확인합니다. 원인을 모르는 상태에서 cadence만 늘리는 것은 증상을 가릴 뿐입니다.

## 운영 예제

100개의 NPC가 같은 문을 향해 이동한다고 가정합니다. 틱 0에는 같은 map version 40과 목표 세대 7로 요청을 만들고, 지역별 최신 요청 100개를 queue에 넣습니다. 틱 1에 문이 닫혀 overlay version이 41이 되면 문 영향 corridor를 dirty로 만들고 이전 결과는 아직 적용하지 않습니다.

틱 2에는 NPC마다 이전 request를 취소 표시하고 최신 request만 남깁니다. 이미 실행 중인 worker는 실제 종료 전까지 snapshot과 permit을 보유합니다. 새 탐색이 끝나도 overlay 41과 목표 세대 7이 현재와 맞는 NPC만 corridor 검사를 받습니다.

틱 3에 문이 다시 열려 overlay version이 42가 되면 version 41 결과도 늦은 결과가 됩니다. 지역 변경을 합쳐 다시 계산하고 계산 전에는 NPC가 문 앞의 안전 cell에서 대기하도록 합니다. 이 과정은 설계 순서의 예이며 실제 제품 처리 시간이나 도달률을 측정했다는 뜻이 아닙니다.

## 검증 범위

작은 Grid에서 문 하나를 열고 닫으며 full replan과 지역 invalidation의 비용·도달성 결과를 Dijkstra 또는 exhaustive oracle에 비교합니다. 목표만 바뀐 경우, map만 바뀐 경우, profile만 바뀐 경우를 서로 다른 무효화 원인으로 기록합니다.

비동기 테스트에서는 cancel 전 완료, cancel 후 늦은 callback, entity ID 재사용, snapshot 해제 전 callback, worker permit 누수를 재현합니다. 결과 적용 전 version mismatch가 발견되는지와 mismatch 뒤 실제 참조가 안전하게 회수되는지를 따로 확인합니다.

실행 테스트에서는 좁은 문, corner, 큰 footprint, weighted terrain, smoothing 실패, vertex·edge swap, horizon 끝 대기를 포함합니다. load test와 correctness oracle은 분리하고, 특정 수치는 실제 target 환경에서 실행한 뒤에만 기록합니다.

## 참고 자료와 검증 범위

- [Recast Navigation 공식 프로젝트 페이지](https://recastnav.com/) — 2026-09-17 확인. 특정 릴리스가 없는 공식 개요이며 Recast의 navmesh generation과 Detour의 runtime loading·pathfinding·navmesh queries 역할에만 적용했습니다.
- [Recast Navigation 공식 README](https://github.com/recastnavigation/recastnavigation/blob/main/README.md) — 2026-09-17 확인. 표시된 `main` 브랜치 문서에서 voxel rasterization과 tiled navmesh의 개념을 확인했습니다. tile update 안전성이나 성능 계약으로 확대하지 않았습니다.
- [`dtNavMeshQuery` API reference](https://recastnav.com/classdtNavMeshQuery.html) — 2026-09-17 확인. 공식 API 문서에서 nearest polygon, polygon-reference corridor, straight-path 변환, buffer와 incremental query 수명 주의를 확인했습니다. release 번호와 API revision은 확인하지 않았습니다.
- [Lifelong Planning A* publication entry](https://publications.ri.cmu.edu/lifelong-planning-a/) — 2026-09-17 확인. 2004 publication entry의 abstract/metadata 범위에서 이전 search tree 재사용이라는 주장만 사용했습니다. 구현 수식과 성능 수치는 사용하지 않았습니다.
- [D* Lite publication entry](https://publications.ri.cmu.edu/d-lite/) — 2026-09-17 확인. 2002 publication entry의 abstract/metadata 범위에서 unknown terrain과 fast replanning이라는 적용 범위만 사용했습니다. 게임 서버 구현 사양으로 주장하지 않았습니다.
- 실제 Recast tile rebuild, 증분 탐색 구현, 게임 서버 load test는 실행하지 않았습니다. 운영 예제의 틱과 버전은 상태 흐름을 설명하기 위한 숫자입니다.

---
id: navmesh-funnel-corridor-waypoint-extraction
title: NavMesh Funnel Corridor·Waypoint 추출
topic: 게임 서버
summary: >-
  NavMesh polygon corridor의 portal 양쪽을 누적해 string-pulling으로 불필요한 waypoint를 줄이되
  agent profile과 portal 유효성을 보존하는 제안입니다.
questionIds: []
prerequisites:
  - navigation-clearance
  - path-execution
  - pathfinding-foundations
related:
  - navigation-clearance
  - path-execution
reviewedAt: '2026-09-19'
---
# NavMesh Funnel Corridor·Waypoint 추출

NavMesh 탐색 결과는 인접 polygon ref의 corridor입니다. polygon 중심이나 모든 portal 중심을 waypoint로 쓰면 지그재그가 생기므로 funnel은 시작 apex에서 portal의 양쪽 경계를 좁혀 더 이상 함께 보이지 않는 corner만 출력합니다. Recast/Detour 공식 `dtPathCorridor` 문서는 동적으로 갱신되는 polygon corridor를 agent 이동 계획의 자료구조로 설명하지만, 특정 release의 endpoint winding, partial path endpoint, agent clearance를 모두 보장하는 근거로 확대할 수는 없습니다.

## Corridor와 Portal 모델

A→B→C polygon 경로의 인접 공유 변이 portal입니다. 각 portal은 corridor 진행 방향과 polygon winding을 기준으로 `(left,right)`를 갖고, 시작점 S와 종료점은 가상 portal로 추가합니다. portal record에는 endpoint뿐 아니라 양쪽 polygon ref, layer, map/profile version을 넣어 나중에 그림만 같은 잘못된 연결을 걸러냅니다.

예시에서 S=(0,0), portal1의 `(L1,R1)=((3,2),(3,-2))`, portal2가 `((6,1),(6,-1))`, 목표 G=(10,0)이라 합시다. “위쪽이 항상 left”가 아니라 진행 방향에 대한 orientation이 계약입니다. 좌표계 handedness가 import 단계에서 바뀌면 같은 선분도 signed area의 부호가 바뀌므로, 한 번 정한 cross-product convention을 테스트 fixture로 고정합니다.

## Portal Winding 검증

한 portal의 endpoint를 `(R,L)`로 뒤집으면 선분은 시각적으로 동일하지만 funnel의 left/right 갱신과 crossing 판단은 달라집니다. 정상 입력은 apex S에서 left가 L1→L2로, right가 R1→R2로 좁혀지지만 portal2만 반전하면 “right가 left를 넘었다”는 조건이 거짓 또는 조기에 참이 될 수 있습니다. 그 결과 corridor 바깥 corner나 벽을 가로지르는 segment를 만들 수 있습니다.

검증은 정상/반전 배열을 같은 입력으로 실행해 각 portal index, apex, left/right index, oriented area 부호, 출력 waypoint를 로그로 비교합니다. portal 선분을 화면에 그린 결과만 확인하지 말고 polygon ref 순서, 층 연결, 좌표계 handedness, 실제 corridor 포함 여부를 함께 검사합니다. funnel의 point visibility가 맞아도 finite agent clearance는 별도 문제입니다.

## Funnel 상태와 Apex 갱신

구현 상태는 `apex`, `left`, `right`, 각 endpoint의 portal index, 재처리 index로 둡니다. 새 left가 현재 left를 안쪽으로 좁히면 left를 갱신하고, 새 right도 대칭으로 갱신합니다. 한 경계가 다른 경계를 넘는 순간 현재 apex에서 corridor 전체를 볼 수 없으므로, crossing을 일으킨 현재 endpoint가 아니라 **반대편에서 마지막으로 안정적이었던 corner**를 출력하는 규약을 선택합니다.

이 규칙은 orientation convention에 의존합니다. 예를 들어 right 갱신이 left를 넘었다면 left의 이전 안정 endpoint를 waypoint로 내보내고 그 점을 새 apex로 삼아 crossing을 유발한 portal부터 재처리하는 방식입니다. 다른 구현은 대칭 endpoint를 선택할 수 있으므로, “항상 left를 출력” 같은 보편 규칙으로 쓰지 않고 pseudocode와 trace로 고정해야 합니다. 동일 endpoint 반복, collinear, epsilon의 세부 정책도 termination invariant에 포함합니다.

## 수치 Trace와 목표 연결

S=(0,0), P1=(3,2)/(3,-2), P2=(6,1)/(6,-1), P3=(8,-3)/(8,1), G=(10,0)에서 endpoint를 진행 방향에 맞춰 넣고 signed area를 계산합니다. P1과 P2까지는 양쪽 경계가 좁혀지고, P3의 아래쪽 endpoint가 선택된 left/right convention에 따라 기존 경계를 넘으면 crossing을 발생시킵니다. 정상 알고리즘은 P3 endpoint를 무조건 waypoint로 내보내지 않고, 이전 안정 corner를 출력한 다음 P3를 새 apex 기준으로 다시 평가합니다. 이 좌표는 설명용 trace이며 특정 Detour release의 실행 결과가 아닙니다.

마지막 목표는 종료 portal로 넣어야 하며, 마지막 polygon 중심을 대신 쓰면 목표까지의 visibility 검사가 빠집니다. partial corridor라면 목표 좌표를 임의로 덧붙이지 않습니다. 아래의 partial 정책처럼 실제로 도달 가능한 종료점을 애플리케이션이 계산하고, 그 점까지 funnel을 수행합니다.

## Agent Clearance와 Profile

funnel은 point/corridor geometry의 string-pulling일 뿐 몸체 반경·높이·회전·경사 여유를 자동 증명하지 않습니다. 폭이 2r에 가까운 portal을 점 하나는 통과해도 반경 r capsule은 tolerance가 0이어서 벽과 접촉할 수 있고, 회전 중 footprint가 portal 밖으로 나갈 수 있습니다. profile별 baked NavMesh를 사용하거나 corridor를 shrink하고, waypoint segment를 실제 shape sweep으로 재검증합니다.

검증 순서는 polygon ref와 map/profile version, portal 폭과 높이, 경사와 step, off-mesh 연결, 동적 장애물·예약을 확인한 뒤 짧은 segment를 sweep하는 것입니다. 실패하면 shortcut을 성공으로 캐시하지 않고 더 보수적인 waypoint, 대기, 재탐색 중 정책을 선택합니다. point agent corridor를 boss profile에 재사용하는 것은 경로 좌표가 같다는 이유로 footprint 계약을 위반하는 대표 사례입니다.

## Partial Corridor와 종료점

탐색 결과의 `partial`은 마지막 polygon이 목표 polygon이 아님을 뜻할 수 있습니다. 여기서 “last reachable ref의 closest point를 funnel endpoint로 사용”하는 것은 이 문서가 제안하는 **애플리케이션 통합 정책**이며, 인용한 Recast/Detour API 페이지가 보편 API 이름이나 반환 의미를 보증한다는 뜻이 아닙니다. 실제 target release의 query result와 project의 closest-point 계산을 소스·테스트로 확인해야 합니다.

구체적으로 goal이 닫힌 문 너머이고 query 결과가 `[poly10, poly11]`, `partial=true`, last ref=poly11이라면 목적지 G를 추가하지 않고 poly11 위에서 계산한 reachable endpoint E=(7.8,1.2)를 종료점으로 선택합니다. funnel은 S→portal→E만 처리하고, E→G 직선을 만들지 않습니다. `partial=false`이고 last ref가 goal polygon일 때만 goal을 정상 종료점으로 채택합니다. 이 수치는 설명용이며 API의 실제 반환 형식은 release 확인 대상입니다.

## 동적 장애물 재검증

funnel 계산과 이동 사이에 문·NPC·예약이 바뀔 수 있습니다. corridor ref와 map/overlay generation을 저장하고 다음 segment 직전에 portal 유효성, profile sweep, 동적 점유를 다시 읽습니다. polygon ref가 무효화되면 partial endpoint를 유지한 채 강행하지 않고 결과를 폐기해 재탐색합니다. 목표 generation이 바뀌거나 비동기 결과가 늦게 도착한 경우도 현재 요청과 일치하는지 확인합니다.

이는 path lifecycle의 일반 원칙을 funnel에 다시 적용하는 것이 아니라, funnel 고유의 endpoint 방향과 partial 종료점을 추가로 검사하는 단계입니다. local avoidance가 잠시 점유를 풀 수 있어도 닫힌 polygon 연결이나 잘못된 layer를 고치지는 못합니다. geometric shortcut, dynamic avoidance, authoritative corridor validity를 분리해야 실패 원인을 찾을 수 있습니다.

## 자료구조와 비용

portal 배열과 현재 funnel 상태만 보관하면 정상적인 누적 스캔은 corridor 길이에 비례하는 비용을 기대할 수 있습니다. 그러나 crossing 뒤 portal 재처리 방식에 따라 같은 index를 되돌리는 횟수가 달라지므로 실제 구현을 확인하지 않고 무조건 O(n)이라고 단정하지 않습니다. 큰 corridor를 cache하거나 원격 전달할 때 endpoint precision과 version을 같이 보관하고, 다른 좌표계 portal을 섞지 않습니다.

path 결과에는 requestId, mapVersion, profileVersion, polygon refs, portal endpoints, partial flag, chosen endpoint reason을 기록합니다. debug build에서 `apexIndex`, `leftIndex`, `rightIndex`, orientation 부호, waypoint reason을 남기면 벽 관통을 renderer만 보고 추측하지 않아도 됩니다. 메타데이터는 실행 직전 검증에서 필요하므로 waypoint 배열만 저장하는 설계보다 큽니다.

## 실패 사례와 검증 기준

fixture는 정상 winding, 한 portal 반전, collinear·동일점 portal, 좁은 문, partial corridor, 층이 다른 polygon, dynamic obstacle 삽입, 큰 agent profile을 포함합니다. 정상 사례는 모든 segment가 corridor와 shape clearance를 만족해야 하고, 불가능한 사례는 waypoint를 만드는 대신 안전한 중지나 재탐색을 선택해야 합니다. waypoint 수 감소는 품질의 전부가 아니며 weighted terrain과 선회 비용에서는 더 직선인 경로가 더 비쌀 수 있습니다.

```diagram
{"title":"Corridor에서 실행 가능한 waypoint를 추출합니다","caption":"portal 순서와 partial 상태를 보존한 뒤 funnel corner를 만들고, profile과 동적 map을 실행 직전에 재검증합니다.","rows":[[{"id":"corridor","label":"polygon corridor","detail":["ref·partial·version"]}],[{"id":"portal","label":"portal left/right","detail":["winding·orientation"]}],[{"id":"funnel","label":"apex funnel","detail":["crossing·재처리"]}],[{"id":"endpoint","label":"종료 endpoint","detail":["goal 또는 reachable"]}],[{"id":"sweep","label":"profile 재검증","detail":["shape·장애물·예약"]}]],"edges":[{"from":"corridor","to":"portal","label":"공유 변과 방향"},{"from":"portal","to":"funnel","label":"경계 누적"},{"from":"funnel","to":"endpoint","label":"안정 corner"},{"from":"endpoint","to":"sweep","label":"실행 전 확인"}]}
```

## 참고자료와 적용 범위

Recast/Detour 공식 `DetourPathCorridor` API(https://recastnav.com/DetourPathCorridor_8h.html)는 dynamic polygon corridor 자료구조라는 좁은 주장을 뒷받침하는 데 사용했습니다. 해당 페이지와 확인된 버전 정보는 partial flag, `closestPointOnPoly`, endpoint winding, 모든 funnel 세부를 확정하지 않으므로 그 부분은 애플리케이션 정책과 target release source/test의 책임입니다. 이 문서는 실제 NavMesh bake나 Detour runtime을 실행한 결과가 아니며 수치 trace는 설명용입니다.

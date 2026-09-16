---
id: path-execution
title: 경로의 동적 재검증·Smoothing·목표 세대
topic: 게임 서버
summary: map/목표/profile version·영향 footprint·재탐색 주기를 구분하고 point visibility와 실행 가능한 shortcut·funnel·가중 비용·늦은 결과·budget을 설명합니다.
questionIds: [dynamic-path-revalidation, path-dependency-version-granularity, moving-target-replan-cadence, path-smoothing-validation, path-smoothing-weighted-cost]
---

# 경로의 동적 재검증·Smoothing·목표 세대

## 경로는 계산 당시의 계획이지 도착까지의 보장이 아닙니다

A-B-C-D 경로에서 B의 문이 닫히면 현재 위치에서 다음 구간으로 들어가기 전에 멈추거나, 문 상태를 다시 읽어 경로를 재검증합니다. 영구 지형 변화와 다른 NPC가 잠시 길을 차지한 경우는 처리 방식이 다릅니다. 일시 점유에는 대기·예약 갱신·local avoidance(주변 물체와 부딪히지 않도록 짧게 움직임을 조정하는 처리)를 적용할 수 있고, 구조가 바뀌면 재탐색을 적용할 수 있습니다. 이미 위험하다고 확인한 구간은 옛 경로에 들어 있다는 이유로 계속 실행하지 않습니다.

맵 version은 환경, 목표 generation은 현재 의도, agent profile version은 크기·능력·이동 규칙을 나타냅니다. 목표가 바뀌면 맵이 그대로여도 이전 성공 결과는 적용할 수 없습니다. 결과에는 request ID와 이 세 범위를 함께 연결합니다.

## 의존 범위는 중심선보다 넓을 수 있습니다

| 범위 | 이점 | 비용·누락 |
| --- | --- | --- |
| world version | 단순·보수적 | 문 하나에 모든 경로 무효화 |
| chunk version 집합 | 작은 metadata | 무관한 변화에도 재탐색 |
| cell/장애물 의존 | 정밀 invalidation | 저장·갱신 비용·빠진 의존 |
| 경로 corridor/footprint | 실제 통과 폭 반영 | 교차·영향 영역 계산 |

반경이 있는 몸체가 경로의 중심선을 따라가더라도, 중심 cell 옆의 벽이 몸체 외곽을 막으면 그 구간은 실행할 수 없습니다. 따라서 중심선만 저장하지 말고 smoothing shortcut·portal·회전 공간까지 포함한 의존 영역(무효화 범위)으로 기록한 뒤, 변경 index가 그 영역에 닿은 후보만 다시 검사합니다.

의존 영역을 너무 좁게 잡으면 실제 영향을 놓치는 false negative가 되고, 너무 넓게 잡으면 무관한 변경에도 재탐색이 몰립니다. 실행 직전 충돌 검사는 이 의존 범위의 누락이나 과다를 대신 조정하지 못합니다.

## 움직이는 목표는 최신 요청만 남기되 안전 검사를 유지합니다

이동 중인 목표를 쫓을 때는 목표 이동 거리, 현재 경로의 유효성, 경과한 틱을 함께 보고 재탐색 시점을 정합니다. NPC별 cooldown은 한 NPC의 연속 요청을 벌리는 제한으로 두고, global worker/queue budget은 모든 NPC가 동시에 사용할 탐색량을 제한합니다. 같은 문 변경으로 생긴 요청은 지역별로 합치거나 stagger(시작 시점을 나눔)하고, 중간 목표 요청은 coalesce(최신 요청 하나로 합침)합니다. 작업이 끝났을 때는 현재 generation에 맞는 결과만 적용합니다.

재탐색 주기를 너무 짧게 잡으면 CPU 사용, 취소됐지만 남아 있는 작업, 보유한 snapshot이 늘고, 너무 길게 잡으면 목표를 따라가는 오차가 커집니다. 새 경로가 오기 전에는 다음 짧은 안전 구간만 실행하거나 멈추도록 정하되, 위험 event는 NPC cooldown보다 먼저 처리할 수 있게 합니다. 취소 통지만 도착했다는 이유로 worker permit과 map 참조를 먼저 반환하지 말고, 실제 작업 종료와 반환 시점을 연결합니다.

```diagram
{"title":"늦은 결과도 현재 의도와 실행 가능성을 통과해야 합니다","caption":"화살표는 경로 수명입니다. 검색 성공과 smoothing 성공 뒤에도 현재 generation·지도 조건·다음 구간 충돌 검사가 남습니다.","rows":[[{"id":"request","label":"목표 generation·map/profile snapshot"}],[{"id":"search","label":"bounded 경로 탐색"}],[{"id":"smooth","label":"shortcut·corridor·비용 검증"}],[{"id":"apply","label":"현재 request/version 일치"}],[{"id":"move","label":"짧은 구간 sweep·예약·이동"}]],"edges":[{"from":"request","to":"search","label":"불변 입력"},{"from":"search","to":"smooth","label":"후보 경로"},{"from":"smooth","to":"apply","label":"검증된 후보"},{"from":"apply","to":"move","label":"지금 실행 허가"}]}
```

## Smoothing은 새로운 실행 경로를 만드는 변환입니다

두 waypoint가 서로 보인다고 반경·높이·경사·step·낙하·일방통행을 가진 agent가 지나갈 수 있는 것은 아닙니다. grid shortcut은 선분 전체와 팽창 장애물 또는 shape sweep을 검사합니다. NavMesh funnel은 portal corridor의 꺾임을 줄이지만 profile에 맞게 수축/생성된 통로 폭과 높이·층 연결이 유효해야 합니다.

가장 먼 후보 shortcut이 실패하면 더 가까운 후보를 검사하거나 원래 경로를 유지합니다. 긴 segment는 동적 변화에 취약해 짧은 실행 구간·예약 horizon으로 확정합니다. failure cache도 map/profile version이 바뀌면 재검토합니다.

## 더 짧은 거리가 더 낮은 비용은 아닙니다

원래 우회 거리 10에 단가1이면 비용10입니다. 직선 거리6 중 4가 단가3, 2가 단가1이면 비용14입니다. waypoint 수와 거리만 줄이면 더 비싼 경로가 됩니다. 실제 지형 길이·가중치·경사·선회 비용으로 원래 구간과 비교하고 원래 품질 계약을 만족할 때만 적용합니다.

client 시각 smoothing과 서버 권위 이동을 분리하고 서버와 같은 footprint·dt·충돌 규칙으로 보정합니다. 테스트는 문 변경·연속 목표·반경·좁은 corner·weighted terrain·층 portal·늦은 완료·재탐색 폭주를 포함합니다. 실제 이동 성공·비용·오차·폐기율·CPU·보유 snapshot을 봅니다. 이 노트는 실행 설계이며 실제 게임 엔진 경로 추종 실험 결과는 아닙니다.

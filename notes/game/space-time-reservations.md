---
id: space-time-reservations
title: 시간·공간 예약의 원자성·Horizon·공정성
topic: 게임 서버
summary: 셀/간선/footprint 충돌과 조건부 예약을 설명하고 제한된 미래 계획·안전 대기·교착의 기하 조건·결정적 aging·lease/세대/실행 재검증을 구분합니다.
questionIds: [cooperative-pathfinding, multiagent-cell-reservation, reservation-horizon-replanning, corridor-deadlock-priority-aging, game-reservation-deterministic-aging]
---

# 시간·공간 예약의 원자성·Horizon·공정성

## 개별 최단 경로 두 개가 함께 실행 가능한 것은 아닙니다

A와 B가 같은 빈 교차로 C에 다음 틱 도착하려 하면 공간상 경로는 둘 다 있어도 시간 충돌입니다. state를 `(cell,arrivalTick)`으로 두면 wait·순차 통과를 표현할 수 있습니다. A가 C를 틱1, 출구를 틱2에 쓰고 B가 옆 대기 공간에 틱1까지 머문 뒤 C를 틱2에 쓰는 식입니다. 실제 출구·대기 공간이 있다는 전제가 필요합니다.

| 충돌 | 검사할 예약 |
| --- | --- |
| 같은 cell·같은 tick | vertex 점유 |
| A→B와 B→A 동시 이동 | 반대 방향 edge swap |
| 대각 중간 교차 | segment/시간 교차 |
| 큰 몸체 | 전체 footprint·이동 sweep |
| 속도 차이 | 여러 시간 slot의 체류 |

위치 하나의 예약만으로 모든 충돌을 막을 수 없습니다. 무한 wait 상태를 만들지 않도록 비용·최대 시간 범위를 정하고 목표 점유가 이후에도 지속되는지 포함합니다.

## 빈칸 조회와 예약 확정은 같은 원자 경계입니다

두 요청이 비어 있음을 읽고 각각 저장하면 둘 다 성공할 수 있습니다. 권위 tick owner가 의도를 결정적 순서로 처리하거나 `(cell,tick)` 조건부 생성·version 검사로 하나만 확정합니다. 여러 cell/edge를 함께 잡는 footprint는 전체 조건을 확인하고 한 번에 확정해야 합니다. 준비 상태를 사용한다면 부분 예약을 이동 허가로 노출하지 않습니다.

```diagram
{"title":"경로 후보를 원자 예약 뒤 실제 이동으로 연결합니다","caption":"화살표는 결정 단계입니다. 예약 성공이 이동 완료는 아니며 실제 상태·속도·취소와 현재 owner를 다시 확인합니다.","rows":[[{"id":"plans","label":"각 NPC의 시간·공간 후보"}],[{"id":"order","label":"tick·aging·안정 tie-break 순서"}],[{"id":"reserve","label":"cell·edge·footprint 원자 예약"}],[{"id":"execute","label":"현재 세대·충돌·행동 확인 후 이동"}]],"edges":[{"from":"plans","to":"order","label":"같은 tick 의도"},{"from":"order","to":"reserve","label":"최신 예약 상태"},{"from":"reserve","to":"execute","label":"조건부 실행권"}]}
```

예약에는 owner·entity generation·plan/request ID·대상 tick·만료를 둡니다. 취소·재접속·실행 실패 때 자기 세대 예약만 해제하고 새 owner의 예약을 지우지 않습니다. 만료와 신규 예약이 같은 틱이면 적용 순서도 고정합니다.

## 짧은 Horizon에는 안전한 끝 상태가 필요합니다

미래 H틱만 예약하면 메모리·탐색을 줄이지만 그 뒤 병목을 못 볼 수 있습니다. horizon 끝에서 안전하게 대기할 위치·제동 거리·다음 구간 확보 조건을 둡니다. 실제 이동이 늦어지면 후속 slot도 갱신하고 다른 예약과 다시 대조합니다.

모든 NPC가 horizon 끝에서 동시에 재계획하면 주기적 CPU 파도가 됩니다. 시작 phase·계획 budget을 분산하고 실행 중 예약은 필요한 prefix만 보존하면서 미래 부분을 원자 교체합니다. 다음 계획 실패 시 현재 위치에 안전하게 머무를 수 있어야 합니다.

## Aging이 없는 공간을 만들어 주지는 않습니다

한 cell 폭 외길에서 두 몸체가 이미 마주 보고 교환 금지이며 뒤로 갈 공간도 없으면 우선순위만 바꿔도 해가 없습니다. wait-for cycle·마지막 진행·대기 나이·실패 수를 보고 실제 양보 위치와 후퇴 경로를 찾습니다. NPC와 직접 조작 player에게 강제 후퇴를 적용할 권한/UX는 다를 수 있습니다.

prioritized planning은 빠르지만 계획 순서에 따라 가능한 해를 놓치고 최적 joint plan을 보장하지 않습니다. 좁은 병목에 제한된 joint search·예약 재배치·양보 목표를 적용할 수 있으나 계산 상한을 둡니다.

## 우선순위 변경도 Replay할 수 있어야 합니다

대기 나이는 local wall time이 아니라 합의된 tick·기록된 진행 기준으로 계산하고 동점은 안정 entity ID·라운드 순서로 정합니다. network/thread 도착 우연에만 맡기지 않습니다. 만료된 의도는 승격하지 않고 고우선순위의 계속 유입에도 낮은 작업의 최소 진행을 유지합니다.

같은 입력·tick·정책에서 예약 결과를 재현하고 vertex/edge/다중cell·취소·lease 경계·handoff·해 없는 외길을 시험합니다. 도달률뿐 아니라 최대 대기·교착·재계획·부분 예약·유령 점유를 봅니다. 이 노트는 예약 설계이며 실제 다중 agent planner를 실행한 결과는 아닙니다.

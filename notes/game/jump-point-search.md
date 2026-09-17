---
id: jump-point-search
title: JPS 대칭 제거와 JPS+ 전처리의 유효성
topic: 게임 서버
summary: 자연/강제 이웃·대각 직교 검사·목표 중간 정지·가중 비용 fallback을 설명하고 방향 표·역의존·청크 version·sentinel·압축 비용을 구분합니다.
questionIds: [jps-symmetry-pruning, jps-diagonal-orthogonal-jump, jps-weighted-terrain-fallback, jps-plus-preprocessing, jps-plus-update-dependency-index, jps-plus-table-compression]
---

# JPS 대칭 제거와 JPS+ 전처리의 유효성

## Jump의 후보 생략과 캐릭터 순간이동의 구분

균일 격자에서 오른쪽→위와 위→오른쪽이 같은 비용·도달성을 가지면 모든 이동 순서를 별도로 확장할 필요가 없을 수 있습니다. **JPS**는 부모 진입 방향과 장애물 배치로 이런 대칭을 제거하고 중요한 선택 지점만 A* 후보로 넣습니다. 중간 이동의 충돌·예약이 사라지는 것은 아닙니다.

자연 이웃은 정한 진입 방향의 대칭 규칙에서 남기는 방향이고 강제 이웃은 장애물 때문에 대체 대칭 경로가 막혀 보존해야 하는 선택입니다. 정확한 pruning table은 대각 허용·corner-cutting 규칙별로 다릅니다. 서로 다른 논문의 규칙을 섞으면 도달성을 잃을 수 있습니다.

## Jump 중지 조건과 대각선 직교 검사

jump는 목표 발견·강제 이웃 발생·진행 불가에서 멈춥니다. 대각 jump 중에는 두 직교 방향의 jump가 의미 있는 지점/목표를 찾는지도 검사합니다. 이를 생략하면 대각 이동 뒤 직교로 꺾어야 하는 경로를 후보로 남기지 못할 수 있습니다.

예를 들어 빈 8방향 격자의 S=(0,0),G=(3,1)에서 (1,1)로 대각 진행한 뒤 동쪽으로 목표를 만날 수 있습니다. 대각선만 끝까지 검사하고 직교 목표 검사를 하지 않는 불완전 구현은 (1,1)의 전환 지점을 놓칩니다. 이는 최종 corner 규칙별 pruning table 전체의 대체가 아니라 직교 검사 필요성을 드러내는 작은 상황입니다.

```text
jump(cell, direction, goal):
  next = one legal step from cell
  if next is blocked/outside: return none
  if next == goal: return next
  if hasForcedNeighbor(next, direction, movementRules): return next
  if direction is diagonal:
    if jump(next, horizontal(direction), goal) exists: return next
    if jump(next, vertical(direction), goal) exists: return next
  return jump(next, direction, goal)
```

위 의사코드는 종료 구조만 나타냅니다. 실제 구현은 증명된 이동 모델의 legal-step·forced-neighbor 규칙, 반복/취소 상한과 재귀 깊이를 명시해야 합니다. 목표가 긴 jump 중간에 있으면 그 지점에서 멈추고 정확한 구간 비용을 g에 더합니다.

## 가중 지형·선회 비용과 대칭 전제

같은 목적지라도 싼 타일을 먼저 지나거나 선회 횟수가 다르면 이동 순서의 비용이 달라질 수 있습니다. 기존 JPS를 그대로 적용하지 말고 정당화된 변형이 없으면 일반 A*로 fallback합니다. turn cost가 있으면 state가 cell만이 아니라 `(cell, incomingDirection)`이어야 같은 위치의 다른 후속 비용을 구분할 수 있습니다.

## JPS+의 반복 Scan과 Direction Table 전환

정적 맵의 cell×direction마다 다음 jump 지점·거리·막힘 등 필요한 정보를 미리 계산하면 online에서 복도를 한 칸씩 훑는 일을 줄일 수 있습니다. 구현에 따라 signed distance 등 표현이 달라도 목표가 구간 중간/직교 투영에 있을 때의 목표 판정과 실제 g 갱신은 남습니다.

```diagram
{"title":"정적 전처리의 속도는 Version 계약을 대가로 얻습니다","caption":"화살표는 생성·조회 흐름입니다. source·이동 규칙·profile이 맞는 완성 표만 사용하고 맞지 않으면 기본 탐색으로 전환합니다.","rows":[[{"id":"source","label":"정적 맵·이동 규칙·agent profile"}],[{"id":"table","label":"방향별 jump 표·sourceVersion"}],[{"id":"query","label":"현재 요청 version·목표 위치 검사"}],[{"id":"use","label":"유효 표 조회"},{"id":"fallback","label":"stale/미계산 · A* 또는 대기"}]],"edges":[{"from":"source","to":"table","label":"전처리"},{"from":"table","to":"query","label":"완성 snapshot"},{"from":"query","to":"use","label":"호환"},{"from":"query","to":"fallback","label":"불일치"}]}
```

## 단일 문 변경과 원거리 Ray 표의 영향 범위

cell 하나(예: 문 하나)를 바꾸면 그 cell을 지나는 jump ray뿐 아니라, ray 주변의 forced-neighbor 판정과 대각 jump가 참조하는 직교 jump 결과까지 영향을 받을 수 있습니다. 그래서 인접 cell만 다시 계산하면 먼 출발점의 방향 표가 stale로 남을 수 있습니다. ray/청크 역참조와 보수적인 영향 영역을 따라 의존성을 전파해 재계산하고, 영향 범위를 증명하지 못한 부분 갱신은 넓은 rebuild나 A* fallback으로 보수적으로 처리합니다.

청크 경계를 넘는 jump는 이웃 source version도 포함합니다. 새 배열을 완성한 뒤 한 bundle로 게시하고 옛 reader의 실제 참조 수명을 유지합니다. 정적 표+동적 overlay 검사는 안전한 후보 실행에 유용하지만 막힌 경로를 국소 우회한다고 전역 최단성이 자동 유지되지는 않습니다.

## Jump 표의 압축 상태와 조회 비용

| 상태 | 의미 |
| --- | --- |
| 유효 jump 거리 | 해당 방향의 계산된 경계·목표 검사 필요 |
| 진행 불가 | 그 규칙에서 막힌 방향 |
| 아직 미계산 | fallback/대기 필요 |
| stale | 다른 source/profile·재사용 금지 |

방향 표에서 ‘아직 미계산’과 ‘진행 불가’를 같은 sentinel로 저장하면, 전처리가 끝나지 않은 길을 막힌 길로 잘못 반환할 수 있습니다. 따라서 유효 jump 거리, 거리 overflow, direction code, 목표가 jump 구간 중간에 있을 때 멈춰야 한다는 정보를 보존하고, palette/RLE/bit packing을 쓸 때는 decode·branch·cache 비용을 따로 측정합니다.

작은 맵의 모든 시작/목표 쌍을 기준 A*와 비교하면서 빈 공간·강제 이웃·corner·가중 반례·문 변경을 포함합니다. 이 노트는 알고리즘 구조를 설명할 뿐, 완전한 JPS/JPS+ 구현을 실행 검증한 결과는 아닙니다.

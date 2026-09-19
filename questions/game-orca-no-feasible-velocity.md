---
id: game-orca-no-feasible-velocity
title: ORCA 제약의 교집합에 preferred velocity가 없거나 feasible velocity가 없는 경우 어떻게 처리하나요?
difficulty: 중하
category: 게임 서버
tags:
  - ORCA
  - feasible region
  - deadlock
related:
  - cooperative-pathfinding
---
# ORCA 제약의 교집합에 preferred velocity가 없거나 feasible velocity가 없는 경우 어떻게 처리하나요?

## 구두 답변

먼저 `v_pref`가 feasible set 밖인 경우와 feasible set 자체가 빈 경우를 분리합니다. 전자는 실패가 아닙니다. 예를 들어 `|v|≤2`, `x≤1`, `y≥0.4`에서 `v_pref=(2,0)`은 첫 제약을 위반하므로 `(1,0.4)`처럼 두 제약을 만족하면서 선호점에 가까운 속도를 고르면 됩니다. 반면 속도 원판과 hard half-plane들이 서로 만나지 않으면 반환할 안전 속도가 없는 solver failure입니다. 이때 “가장 가까운 점”을 계산하려고 제약을 지우면 충돌을 정상 결과로 위장하게 됩니다.

정책 순서는 원인별로 명시합니다. 먼저 `v=(0,0)`이 모든 hard collision·월드 경계·예약 제약을 만족하는지 검사합니다. 만족하면 emergency stop을 반환하고 `stopped_due_to_constraint`를 기록합니다. 정지도 벽 안이거나 이미 겹침을 해결하지 못하면 별도 collision handler가 우선합니다. 그다음 목적 방향, 속도 선호, 먼 agent 같은 soft constraint만 완화해 재시도할 수 있으며, 결과는 hard constraint를 다시 통과해야 합니다. 좁은 문에서 네 agent의 ORCA 제약이 동시에 비면, speed cap을 낮추는 것은 속도 원판을 더 작게 만들 뿐 일반적인 복구책이 아니므로 사용하지 않습니다. corridor reservation이나 path generation을 올려 한 agent만 통과시키는 상위 재계획을 요청하고, 그래도 실패하면 명시적인 no-safe-velocity 상태를 반환합니다.

예를 들어 두 tick 연속 정지하고 progress가 0이면 local solver가 정상이어도 전역 deadlock일 수 있습니다. 로그에는 feasible 여부, 완화한 제약 ID, stop 검사 결과, planner 재계획 세대를 따로 남깁니다. 적용 직전 위치·generation·예약을 다시 검사하여 solver 계산과 실제 세계 사이의 stale 상태도 차단합니다.

## 득점 포인트

- preferred velocity가 feasible set 밖인 정상 보정과 feasible set 공집합을 구분한다.
- 충돌 제약은 조용히 무시하지 않고 안전 정지·재시도·재계획을 명시한다.
- 반복 정지와 전역 교착은 reservation/path planner가 다루며 solver 결과와 적용 결과를 재검증한다.

## 감점 포인트

- preferred velocity를 만족하지 못하면 충돌 제약을 삭제한다고 말한다.
- ORCA가 좁은 병목의 우선 통과 순서까지 알아서 정한다고 주장한다.
- solver 실패를 값 하나로 숨기고 안전 정지와 계산 오류를 구분하지 않는다.

## 더 파고들 거리

- hard constraint와 soft constraint를 어떤 기준으로 나누고 완화 순서를 어떻게 기록할까요?
- feasible set이 매 tick 비어 있는 agent의 상위 재계획 조건은 무엇일까요?
- 정지 상태에서 늦게 도착한 결과가 기존 예약을 덮지 못하도록 어떤 generation을 둘까요?

---
id: game-orca-time-horizon
title: ORCA time horizon을 너무 짧거나 길게 잡으면 회피 행동이 어떻게 달라지나요?
difficulty: 중하
category: 게임 서버
tags:
  - ORCA
  - time horizon
  - 회피
related:
  - moving-target-replan-cadence
---
# ORCA time horizon을 너무 짧거나 길게 잡으면 회피 행동이 어떻게 달라지나요?

## 구두 답변

time horizon은 현재 상태에서 일정 시간 안에 발생할 충돌을 이번 제약으로 다룰지 정하는 예측 창입니다. 같은 상태를 고정해 보겠습니다. 중심 거리 4m, 반경 합 1m, 서로 접근하는 상대 속도 2m/s이면 등속 접촉 시각은 1.5초입니다. `τ=0.5초`에서는 이 쌍이 창 안에 들어오지 않아 preferred velocity를 거의 유지할 수 있지만, 실제로는 다음 tick에서 급격히 회피해야 합니다. `τ=2초`에서는 같은 쌍이 즉시 constraint 후보가 되어 lateral 조정을 일찍 시작합니다. 이것은 등속·원형 계산이며 가속·회전이 큰 agent의 실행 결과는 아닙니다.

긴 horizon이 항상 안전한 것은 아닙니다. 예를 들어 좁은 복도에서 2m/s로 이동하는 agent가 0.5초 뒤에 방향을 바꿀 수 있는데 `τ=3초`를 쓰면 아직 경로에 들어오지 않은 여러 agent까지 제약에 넣어 preferred velocity가 번갈아 꺾이고 교집합이 좁아질 수 있습니다. 반대로 horizon만 늘리고 neighbor query를 현재 2m로 고정하면 3초 동안 4m/s로 접근하는 후보를 빠뜨립니다. 후보 반경에는 두 반경 합과 상대 최대 이동량을 포함하고, 후보 수 증가에 따른 solver p99와 false positive를 함께 측정해야 합니다.

선택은 tick 주기, 제동 거리, 최대 속도, agent 밀도, 병목 구조로 결정합니다. `τ`를 바꿀 때마다 같은 장면에서 선택 속도, 제약 수, feasible-set 실패율, lateral 편차를 비교하고, 일정 tick 동안 진행하지 못한 통로는 horizon을 무작정 늘리지 말고 reservation·우선권·상위 재계획으로 넘깁니다. 서버에서는 policy version을 상태에 기록해야 replay와 경계값 비교가 가능합니다.

## 득점 포인트

- 짧은 horizon의 늦은 급회피와 긴 horizon의 과도한 회피·feasible 영역 축소를 대비한다.
- horizon 변경이 neighbor query 범위와 solver 비용에도 영향을 준다는 점을 연결한다.
- 제동 거리·tick·밀도·전역 병목을 보고 조정하며 ORCA가 deadlock을 자동 해결하지 않는다고 한다.

## 감점 포인트

- horizon이 길수록 항상 안전하고 좋다고 말한다.
- horizon만 늘리면 전역 경로의 교착이 해결된다고 주장한다.
- 후보 검색 반경은 그대로 둔 채 예측 시간만 늘려도 된다고 설명한다.

## 더 파고들 거리

- 속도 상한과 가속 제한이 있는 agent에서 등속 time horizon의 보수성을 어떻게 시험할까요?
- horizon 끝에서 멈출 안전 cell이 없는 복도는 예약 계획과 어떻게 결합할까요?
- 제약 수 증가로 solver p99가 올라갈 때 어떤 후보를 완화할 수 있을까요?

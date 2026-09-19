---
id: orca-reciprocal-velocity-obstacle-local-avoidance
title: ORCA Reciprocal Velocity Obstacle 회피
topic: 게임 서버
summary: >-
  여러 agent가 서로 양보할 책임을 나누고 속도 공간의 선형 제약을 풀어 local avoidance를 계산하는 ORCA의 가정·실행·실패
  경계를 설명합니다.
questionIds: []
prerequisites:
  - path-execution
  - spatial-candidates
  - space-time-reservations
related:
  - path-execution
  - spatial-candidates
  - space-time-reservations
reviewedAt: '2026-09-19'
---
# ORCA Reciprocal Velocity Obstacle 회피

ORCA(Optimal Reciprocal Collision Avoidance)는 이미 계산된 전역 경로를 버리고 새 경로를 찾는 알고리즘이 아닙니다. 각 agent가 다음 짧은 시간 동안 선택할 속도를 정할 때, 주변 agent와의 충돌을 피하도록 속도 공간에 선형 제약을 만들고 그 교집합에서 preferred velocity에 가까운 점을 고르는 local avoidance 방법입니다. 핵심은 “두 agent가 서로 절반씩 책임진다”는 문장이 단순히 속도를 반으로 줄인다는 뜻이 아니라, 상대 속도로 보아 충돌하는 영역을 벗어나기 위한 최소 보정 벡터를 구한 뒤 그 절반을 각자의 제약 경계로 부담한다는 뜻이라는 점입니다.

이 설명은 ORCA 원 논문과 저자 연구 페이지에 제시된 reciprocal collision avoidance의 개념을 바탕으로 한 알고리즘 설명입니다. 특정 게임 엔진의 `timeStep`, solver tolerance, neighbor 정렬 또는 장애물 API의 구현을 최신 동작이라고 단정하지 않습니다. 실제 서버에서는 이 장에서 정한 수식·단위·세대를 구현 문서와 작은 결정성 시험으로 고정해야 합니다.

## 전역 경로와 국소 회피

경로 계획기는 “목표까지 어느 corridor를 지나갈 것인가”를 결정합니다. 예를 들어 A*나 NavMesh 경로가 `방-문-복도-목표`를 반환하면, 이 경로는 목적지 방향과 통과할 영역을 제공합니다. 그러나 복도 안에서 다른 agent가 옆에서 접근하는 순간, 경로의 다음 waypoint를 향한 속도 그대로는 충돌할 수 있습니다. ORCA는 이때 waypoint 자체를 바꾸기보다 현재 위치에서 선택 가능한 속도를 잠깐 옆으로 이동시킵니다.

따라서 입력에는 최소한 현재 위치 `p`, 현재 속도 `v`, 반경 `r`, 최대 속도 `v_max`, preferred velocity `v_pref`, 예측 시간 `τ`, 이웃 후보가 필요합니다. `v_pref`는 전역 경로의 다음 구간을 향하되 최대 속도와 회전·가속 제한을 이미 반영한 값이어야 합니다. ORCA가 반환하는 속도가 실제로 곧바로 실행되는 것은 아니며, 물리 충돌·정적 장애물·예약 시스템이 허용하는지도 적용 단계에서 다시 확인합니다.

## 상대 운동과 Velocity Obstacle

두 agent A와 B의 상대 위치를 `p_B - p_A`, 상대 속도를 `v_A - v_B`로 두면, 일정한 속도가 유지된다는 가정에서 두 원형 몸체가 시간 `0 < t ≤ τ` 안에 겹치는지가 상대 속도로 판단됩니다. 이때 상대 속도 평면에서 충돌을 일으키는 속도들의 집합이 velocity obstacle(VO)입니다. 현재 상대 속도가 VO 안에 있으면 예측 horizon 안에 두 몸체의 거리가 `r_A + r_B`보다 작아질 수 있습니다.

ORCA는 A가 혼자 모든 회피를 맡는 대신, 상대 속도에서 VO를 빠져나오기 위해 필요한 최소 변화 `u`를 계산하고 그 절반을 A와 B가 나눌 수 있다고 가정합니다. A의 새 속도 `v_A'`에 대한 직관적인 제약은 `v_A'`가 기존 `v_A + 0.5u` 방향의 경계 바깥쪽 반평면에 놓여야 한다는 것입니다. B에도 대칭 제약을 만들어 각자가 같은 규칙을 실행하면 충돌 없는 조정이 서로 맞물립니다. “절반”은 두 agent의 실제 이동 거리를 언제나 정확히 같게 한다는 보장이 아니라 reciprocal 모델에서 최소 책임을 분담하는 기준입니다.

## Time horizon과 선형 제약

`τ`가 짧으면 매우 가까운 충돌만 제약합니다. `τ=0.5초`에서 2m 떨어진 두 agent가 각자 2m/s로 접근하면 약 1초 뒤 충돌하는 상황은 지금 제약에 들어오지 않을 수 있습니다. 반대로 `τ=3초`로 늘리면 같은 상태를 미리 감지하지만, 먼 agent와 좁은 통로의 여러 후보가 동시에 제약을 만들어 선택 가능한 영역이 과도하게 줄어들 수 있습니다. 실제 horizon은 서버 tick, 속도 변화 가능성, 반경, 제동 거리, 경로 병목을 함께 보고 정합니다.

간단한 설명용 수치로 A와 B의 중심 거리가 4m, 두 반경이 0.5m, 상대 접근 속도가 2m/s라면 직선 등속 가정의 접촉 예상 시간은 `(4 - 1) / 2 = 1.5초`입니다. `τ=1초`에서는 이 충돌이 아직 제약 대상이 아니고, `τ=2초`에서는 대상입니다. 이 계산은 등속·원형·2차원이라는 전제를 둔 설명용 계산이며 실행한 물리 실험의 결과가 아닙니다. 가속과 회전이 큰 agent라면 등속 VO만으로 안전을 보장할 수 없어 swept bound나 별도 동적 모델이 필요합니다.

각 이웃마다 한 개의 half-plane 제약이 생기므로 이웃 수 `k`가 늘면 선형 프로그램 입력도 늘어납니다. 실제 ORCA 구현은 제약 순서와 저차원 선형 계획의 풀이 방식이 성능과 결정성에 영향을 줍니다. 부동소수점 오차로 경계 위 속도가 충돌하는 것을 막기 위해 반경·epsilon·최대 속도·경계 포함 규칙을 명시해야 하며, 이 값은 “논문 알고리즘이 자동으로 정해 준다”고 볼 수 없습니다.

## Feasible velocity 선택

먼저 속도 원판 `|v| ≤ v_max`와 agent의 가속·회전 제한을 표현하고, 각 이웃과 정적 장애물에서 얻은 반평면 제약을 교집합으로 묶습니다. 그 뒤 목적은 보통 `v_pref`와 선택 속도 사이의 거리를 최소화하는 것입니다. preferred velocity가 교집합 밖이면 그 점을 그대로 쓰지 않고 feasible set 경계의 가장 가까운 점을 고릅니다. 이 과정이 “원하는 방향을 가능한 한 많이 유지한다”는 의미입니다.

예를 들어 `v_pref=(2,0)`이고 두 이웃 제약이 `x≤1.0`, `y≥0.4`, 최대 속도가 2.0이라면 preferred velocity는 첫 제약을 위반합니다. 설명용으로 `v=(1,0.4)`를 후보로 잡으면 원점에서의 속도 크기는 약 1.08이고 preferred velocity와의 제곱거리는 `(1-2)^2 + 0.4^2 = 1.16`입니다. `v=(0.8,0.8)`는 두 제약을 만족하지만 차이는 `1.44+0.64=2.08`이므로 앞 후보가 목적함수상 더 가깝습니다. 이는 solver 실행 결과가 아니라 제약 선택의 중간 상태를 보여 주는 계산입니다.

교집합이 비면 이것은 단순히 “preferred velocity를 포기한다”는 문제가 아닙니다. 제약을 만든 상대가 실제로 협조하지 않거나, 정적 장애물 제약과 reciprocal 제약이 서로 모순되거나, 속도 상한이 너무 작다는 신호일 수 있습니다. 구현은 먼저 정지 속도 자체가 hard collision constraint를 만족하는지 검사해야 합니다. 만족하면 안전 정지를 선택할 수 있고, 만족하지 않으면 별도 emergency collision handler가 필요합니다. 이후에만 목적 방향 같은 soft constraint 완화, 허용 속도 집합 확장, 상위 경로 재계획을 정책으로 구분합니다. 속도 상한을 낮추는 것은 속도 원판을 작게 만들 뿐이므로, 이미 빈 교집합을 일반적으로 복구하는 방법이 아닙니다. 어떤 완화 뒤에도 hard constraint를 다시 검사하고, 실패 상태를 값 하나로 숨기지 않습니다.

```diagram
{"title":"경로 방향을 속도 공간의 안전 선택으로 바꿉니다","caption":"전역 경로가 preferred velocity를 만들고, 이웃·정적 장애물 제약의 교집합에서 실제 속도를 선택합니다. ORCA 계산만으로 전역 병목이 해결되지는 않습니다.","rows":[[{"id":"path","label":"전역 경로·다음 corridor","detail":["목표 방향"]}],[{"id":"preferred","label":"preferred velocity","detail":["경로·속도 한계"]}],[{"id":"constraints","label":"reciprocal·장애물 제약","detail":["half-plane 집합"]}],[{"id":"solve","label":"feasible velocity 선택","detail":["선형 계획"]}],[{"id":"execute","label":"재검증 후 실행","detail":["충돌·예약·세대"]}]],"edges":[{"from":"path","to":"preferred","label":"방향 투영"},{"from":"preferred","to":"constraints","label":"후보 기준"},{"from":"constraints","to":"solve","label":"교집합"},{"from":"solve","to":"execute","label":"선택 속도"}]}
```

## Neighbor query의 보수성

모든 agent를 매 tick 비교하면 정확성은 단순하지만 비용이 `O(n²)`에 가까워질 수 있습니다. 공간 hash나 AABB tree로 후보를 줄일 때는 “현재 거리 안”이 아니라 horizon 동안 충돌 가능성이 있는 보수 범위를 질의해야 합니다. A의 반경이 `r_A`, B의 반경이 `r_B`, A의 최대 속도가 `s_A`, B의 최대 속도가 `s_B`라면 설명용 후보 반경은 현재 두 반경 합에 `(s_A+s_B)τ`를 더한 범위까지 고려할 수 있습니다. 실제 회전·가속 모델에서는 더 넓은 swept bound가 필요합니다.

예를 들어 현재 거리 5m, 두 반경 합 1m, 두 최대 속도 합 4m/s, `τ=1초`라면 5m의 현재 거리만 보는 query는 접촉 가능 후보를 버릴 수 있습니다. `1 + 4×1 = 5m`인 상대 이동 여유를 포함해야 경계에 걸립니다. 셀 공간 인덱스에서는 이 반경을 덮는 셀을 모두 읽고, hash bucket 충돌·다중 등록은 ID와 generation으로 dedup합니다. false positive는 solver 제약 수를 늘리는 비용이지만 false negative는 ORCA가 알 수 없는 충돌입니다.

공간 후보의 위치 snapshot과 ORCA가 읽는 반경·속도 snapshot이 서로 다른 tick이면, 이미 사라진 agent나 새 위치가 섞일 수 있습니다. tick snapshot을 고정하거나 각 후보에 generation/version을 붙이고 적용 직전에 재검증합니다. 이웃 update 지연을 숨기기 위해 query 반경을 임의로 줄여서는 안 됩니다.

## 실패 경계와 전역 문제

ORCA는 주변 agent가 같은 reciprocal 규칙을 수행한다는 가정이 중요합니다. 벽·기둥·문은 스스로 양보하지 않으므로 정적 장애물의 velocity obstacle 또는 별도 collision constraint가 필요합니다. 한 agent가 외부 제어로 갑자기 멈추거나 공격적으로 경로를 유지하면 절반 책임 계산만으로는 안전을 보장하지 않습니다. 원 논문의 이론 조건과 실제 엔진의 비협조 객체를 구분해야 합니다.

좁은 통로에서 두 agent가 같은 선호 방향을 유지하거나 서로 좌우 회피를 반복하면 deadlock·oscillation이 생길 수 있습니다. 이때 더 긴 time horizon을 무조건 추가하는 것보다 corridor의 상위 예약, 단방향 우선권, 안정 tie-break, 임시 waypoint를 사용해야 합니다. 전역 경로가 막혀 있으면 local solver는 feasible한 옆걸음만 찾다가 목표에서 멀어질 수 있으므로, 일정 tick 동안 진행하지 못한 agent는 path generation을 올려 재탐색합니다.

검증은 같은 입력과 같은 neighbor 순서에서 같은 속도가 나오는지, 반지름·속도·horizon 경계, 정적 벽, 비협조 agent, 후보 누락, 빈 feasible set, 반복적인 두 agent 접근을 포함해야 합니다. 관측값은 충돌 수만 아니라 제약 수, solver 실패율, preferred velocity 대비 편차, 정지 시간, oscillation 횟수, 재탐색 비율, 후보 false positive와 false negative입니다. 이 노트의 수치와 pseudo 상태는 설명용이며 실제 엔진에서 ORCA를 실행한 성공 측정은 아닙니다.

## 비용과 선택 기준

ORCA의 장점은 각 agent의 속도 선택을 작은 선형 제약 문제로 나누어 많은 agent를 독립적으로 처리할 여지가 있다는 점입니다. 그러나 이웃 수가 많으면 제약 수와 solver 시간이 늘고, 지역적으로 각자 안전해 보여도 전체 군집의 통행량이나 목표 도달을 보장하지 않습니다. neighbor query, solver, 충돌 재검증, 상위 경로 재계획을 각각 시간 예산으로 측정해야 합니다.

예약이 필요한 교차로·좌석·문처럼 특정 tick의 점유권이 중요한 곳은 ORCA만 쓰지 않고 space-time reservation과 결합합니다. ORCA는 연속 속도 사이의 짧은 회피, 예약은 권위 점유 순서를 맡게 합니다. 빠른 이동체나 큰 footprint에는 spatial-candidates에서 설명한 swept broad phase와 narrow phase를 별도로 적용합니다. 서버 권위 이동이라면 client가 계산한 회피 속도를 신뢰하지 않고 입력·권위 상태를 재검증합니다.

## 참고자료와 확인 범위

- ORCA 저자 연구 페이지, https://gamma-web.iacs.umd.edu/ORCA/ — reciprocal collision avoidance의 책임 분담과 적용 범위를 확인한 출발점입니다. 이 배치에서는 linked ORCA-1 PDF가 404로 읽히지 않아 u의 부호·법선·half-plane 수식을 source-backed 사실로 확정하지 않았습니다. 아래 수식 직관은 구현 시 convention 시험으로 고정해야 합니다.
- `notes/game/path-execution.md` — 경로 generation, 늦은 결과, 실행 직전 재검증과 구분했습니다.
- `notes/game/spatial-candidates.md` — 보수적 swept 후보, 공간 index, dedup·generation 수명을 대조했습니다.
- `notes/game/space-time-reservations.md` — 시간 슬롯 점유와 교착을 ORCA의 연속 속도 제약과 분리했습니다.

실제 엔진의 정적 장애물 처리, 선형 계획 solver, epsilon, neighbor API, 속도·가속 단위는 공식 구현 문서와 권위 서버 시험으로 확정해야 합니다. 여기서 확인하지 못한 버전별 기본값을 “최신 ORCA 동작”으로 제시하지 않습니다.

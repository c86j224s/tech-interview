---
id: game-orca-reciprocal-responsibility
title: ORCA에서 두 agent가 충돌을 피할 책임을 절반씩 나눈다는 말은 어떤 계산을 뜻하나요?
difficulty: 중하
category: 게임 서버
tags:
  - ORCA
  - local avoidance
  - velocity obstacle
related:
  - cooperative-pathfinding
---
# ORCA에서 두 agent가 충돌을 피할 책임을 절반씩 나눈다는 말은 어떤 계산을 뜻하나요?

## 구두 답변

“절반 책임”은 속도를 절반으로 줄인다는 뜻이 아니라, 상대 속도에서 충돌 영역을 밀어내는 보정 벡터를 두 agent가 나눠 부담한다는 뜻입니다. 먼저 부호를 고정합니다. 설명용으로 상대 위치를 `pB-pA`, 상대 속도를 `vA-vB`로 두고 A와 B가 4m 떨어져 있으며 `vA=(1,0)`, `vB=(-1,0)`, 반경 합이 1m라고 하겠습니다. 상대 접근 속도는 2m/s이므로 등속 접촉 예정 시간은 `(4-1)/2=1.5초`입니다. `τ=2초`라면 현재 상대 속도는 VO 안에 들어갑니다. A가 혼자 피하면 큰 lateral 보정이 필요하지만, ORCA의 reciprocal 가정에서는 경계까지 필요한 최소 보정 `u`를 정하고 A의 제약을 자신의 속도가 `vA+0.5u` 쪽 경계 바깥에 놓이도록 만듭니다. 같은 계산을 B도 수행합니다. 예를 들어 설명용 법선 방향이 y축이고 `u=(0,0.6)`으로 계산된 convention이라면 각 agent가 0.3m/s 수준의 반대 lateral 조정을 부담하는 그림입니다. 이 수치는 solver 실행 결과가 아니라 half-responsibility를 추적하기 위한 예이며, 원 논문 식의 법선·부호는 구현 convention과 고정 테스트로 확인해야 합니다.

각 agent는 여러 이웃의 half-plane과 자신의 속도 원판, 가속·회전 제한을 교집합으로 만들고 `v_pref`와 가장 가까운 feasible velocity를 고릅니다. 그러므로 “절반”은 실제 이동 거리나 좌우 방향이 항상 대칭이라는 보장이 아닙니다. 한쪽이 속도 상한이 낮거나 preferred 방향이 다르면 두 선택이 달라집니다. 벽은 reciprocal agent가 아니므로 장애물 constraint를 따로 넣고, 갑자기 멈추는 NPC나 누락된 neighbor에는 재검증·정지를 둡니다. 좁은 문에서 누가 먼저 지나갈지, 전역 경로가 막혔는지는 ORCA의 local solver가 정하지 않으므로 reservation이나 상위 planner가 맡아야 합니다.

## 득점 포인트

- 절반 책임을 속도 변화 벡터의 reciprocal 분담으로 설명하고 단순 감속과 구분한다.
- 상대 속도·time horizon으로 velocity obstacle을 만들고 half-plane 교집합에서 `v_pref`에 가까운 속도를 고른다.
- 정적 장애물·비협조 agent·전역 교착은 별도 제약이나 예약 정책이 필요하다고 말한다.

## 감점 포인트

- 두 agent가 각자 속도를 절반으로 줄인다고 설명한다.
- ORCA가 전역 경로와 병목 우선순위까지 해결한다고 단정한다.
- 상대가 같은 정책을 수행하지 않아도 충돌이 보장되지 않는다는 전제를 생략한다.

## 더 파고들 거리

- time horizon을 0.5초에서 3초로 바꿀 때 feasible region과 deadlock을 어떻게 비교할까요?
- neighbor index가 horizon 동안 충돌 가능한 agent를 빠뜨리지 않도록 query 반경을 어떻게 잡을까요?
- feasible velocity가 없을 때 안전 정지와 제약 완화를 어떤 순서로 선택할까요?

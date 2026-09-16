---
id: simulation-budget
title: 틱 예산·시간 적분·Timer 위상 분산
topic: 설계
summary: 틱 CPU/대기와 집중 전투 비용을 분해하고 fixed/variable dt·catch-up 상한·비핵심 지연·snapshot 세대·타이머 만료/실행 예산을 설명합니다.
questionIds: [game-server-tick-budget, fixed-variable-step-integration, game-timer-phase-staggering]
---

# 틱 예산·시간 적분·Timer 위상 분산

## 20Hz의 50ms를 항상 꽉 채우는 것은 여유가 없는 설계입니다

20Hz는 한 틱이 50ms마다 시작한다는 뜻입니다. 전투 15ms + AI 12ms + 직렬화 8ms = 35ms를 쓰면 남은 15ms는 빈 시간이 아니라 scheduler·GC·shared lock·network/DB 대기와 burst를 흡수할 여유입니다. 평균만 보지 말고 틱 p99·최악 틱·단계별 CPU와 wall time·queue age를 측정해야 하며, 접속자 수가 같아도 한 지역의 투사체/NPC 밀집은 후보 충돌 비용을 크게 키울 수 있습니다.

틱 주기를 늘리면 계산 시간이 생길 수 있지만 입력 반응·충돌·쿨다운·공정성도 바뀝니다. 원인을 모른 채 주기만 늘리지 않습니다.

## 같은 총 dt라도 수치 계산은 다를 수 있습니다

명시적 Euler는 각 step에서 현재 값을 사용해 `x+=v*dt; v+=a*dt`를 순서대로 적용하는 근사입니다. `x=0,v=0,a=1`에서 `dt=0.1`을 한 번 적용하면 먼저 `x=0`을 쓰고 `v=0.1`이 되어 결과는 `x=0,v=0.1`입니다. `dt=0.05`를 두 번 적용하면 첫 step 뒤 `x=0,v=0.05`, 둘째 뒤 `x=0.0025,v=0.1`이 됩니다. 두 계산은 같은 100ms를 다루지만 중간 상태를 거쳐 근사하기 때문에 위치가 다르고, 정확한 해는 `x=0.005`입니다.

큰 step은 중간 충돌·입력·timer 순서를 건너뛸 수도 있습니다. fixed dt는 재현을 돕지만 부동소수점·입력 순서·난수·병렬 결과까지 고정해야 합니다. variable dt는 최대 step·substep·필요한 연속 충돌 정책을 정하고 CPU 비용과 오차를 같이 봅니다.

## Catch-up도 상한과 의미가 있어야 합니다

밀린 simulation 시간을 무제한 틱으로 따라잡으려 하면, 따라잡는 계산이 새 입력 처리를 더 밀어 다시 지연을 키우는 악순환이 됩니다. 그래서 한 번에 처리할 최대 catch-up step 수와 시간 예산을 정하고, 비핵심 작업 생략과 유입 제한도 함께 정합니다.

실제 wall time과 simulation time의 차이를 관측하면서 cooldown·권한 만료·상점/경제 timer 중 어느 시계를 각 규칙의 기준으로 쓸지 명시해야 합니다. 모든 시간을 몰래 버리는 것도 규칙 변경이므로, 버린 시간의 처리 결과를 따로 정해야 합니다.

| 작업 | 분산 가능성의 예 |
| --- | --- |
| 권위 입력·충돌 | 규칙상 필요한 순서·시간 유지 |
| 일부 AI·경로 탐색 | 허용 지연·이전 계획·세대 검사 |
| 통계·비핵심 갱신 | batch·주기 분산 가능 |
| 외부 저장 | 틱에서 대기하지 않되 내구/queue 계약 |
| 피해·권한 만료 | 조기/지연이 규칙을 바꾸는지 검사 |

```diagram
{"title":"틱에서 확정할 일과 지연 가능한 일을 나눕니다","caption":"화살표는 계산과 결과 적용입니다. worker에 가변 world 참조를 무제한 넘기지 않고 snapshot·대상 generation으로 늦은 결과를 검사합니다.","rows":[[{"id":"tick","label":"틱 · 입력·권위 상태"}],[{"id":"critical","label":"즉시 전투·충돌"},{"id":"deferred","label":"bounded AI/경로 worker"}],[{"id":"apply","label":"틱 경계 · world/대상 version 검사"}]],"edges":[{"from":"tick","to":"critical","label":"규칙상 순서"},{"from":"tick","to":"deferred","label":"불변 입력·예산"},{"from":"critical","to":"apply","label":"확정 상태"},{"from":"deferred","to":"apply","label":"늦은 결과 조건부 적용"}]}
```

worker 결과가 나오는 동안 문이 닫혔거나 대상 ID가 재사용됐으면 path가 오래됐을 수 있습니다. world version·entity generation·입력 snapshot을 붙이고 폐기/재계산/이전 안전 계획을 정합니다. 복사 비용·queue 대기·폐기율도 분산의 전체 비용입니다.

## Timer 만료 발견과 Callback 실행은 다른 비용입니다

NPC가 같은 시각에 생성되어 매 1초마다 갱신되면 만료 시각이 한 틱에 몰려 반복 파도를 만들고, 그때 만료 탐색과 실제 callback 실행 비용도 같은 틱에 겹칠 수 있습니다. 허용 오차가 있는 작업은 안정된 phase·jitter·round-robin으로 만료 시각을 분산하고, 만료 탐색 비용·callback queue에 쌓이는 비용·실행 budget을 따로 계산합니다. 반대로 deadline이 같은 중요한 피해 판정에는 임의 jitter를 넣으면 판정 시각이 달라져 공정성이 바뀔 수 있습니다.

밀린 callback 전부를 다음 틱에 실행하면 다시 포화됩니다. 회차 누락/합치기 정책·최대 지연·최소 진행을 정하고 만료 시각·실행 시각·중복·skip·가장 오래된 항목을 관측합니다. timer 자료구조가 빨라도 callback 비용을 없애지는 않습니다.

## 집중 부하에서 규칙과 반응을 같이 비교합니다

동일 입력·seed의 fixed/variable step에서 위치·에너지·충돌·timer와 CPU를 비교합니다. 지역 집중·동시 만료·느린 worker·queue 포화·catch-up 상한을 시험합니다. 이 노트는 simulation 예산 설계이며 실제 게임 server 부하 시험 결과는 아닙니다.

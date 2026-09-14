---
id: simulation-budget
title: 틱 예산·시간 적분·Timer 위상 분산
topic: 설계
summary: 틱 CPU/대기와 집중 전투 비용을 분해하고 fixed/variable dt·catch-up 상한·비핵심 지연·snapshot 세대·타이머 만료/실행 예산을 설명합니다.
questionIds: [game-server-tick-budget, fixed-variable-step-integration, game-timer-phase-staggering]
---

# 틱 예산·시간 적분·Timer 위상 분산

## 20Hz의 50ms를 항상 꽉 채우는 것은 여유가 없는 설계입니다

전투 15ms·AI 12ms·직렬화 8ms면 합계 35ms입니다. 남은 15ms에는 scheduler·GC·shared lock·network/DB 대기와 burst가 들어옵니다. 평균뿐 아니라 틱 p99·최악 틱·단계별 CPU와 wall time·queue age를 측정합니다. 같은 접속자 수라도 한 지역의 투사체/NPC 밀집은 후보 충돌 비용을 크게 키울 수 있습니다.

틱 주기를 늘리면 계산 시간이 생길 수 있지만 입력 반응·충돌·쿨다운·공정성도 바뀝니다. 원인을 모른 채 주기만 늘리지 않습니다.

## 같은 총 dt라도 수치 계산은 다를 수 있습니다

명시적 Euler에서 `x+=v*dt; v+=a*dt`, x=0,v=0,a=1로 시작합니다. dt=0.1 한 번은 x=0,v=0.1입니다. dt=0.05 두 번은 첫 x=0,v=0.05 후 둘째 x=0.0025,v=0.1입니다. 같은 100ms지만 중간 상태를 사용하는 근사 적분이어서 위치가 다릅니다. 정확 해는 x=0.005입니다.

큰 step은 중간 충돌·입력·timer 순서를 건너뛸 수도 있습니다. fixed dt는 재현을 돕지만 부동소수점·입력 순서·난수·병렬 결과까지 고정해야 합니다. variable dt는 최대 step·substep·필요한 연속 충돌 정책을 정하고 CPU 비용과 오차를 같이 봅니다.

## Catch-up도 상한과 의미가 있어야 합니다

밀린 simulation 시간을 무제한 틱으로 따라잡으면 새 입력도 더 밀리는 악순환이 됩니다. 최대 catch-up step·시간 예산·비핵심 생략·유입 제한을 정합니다. 실제 wall time과 simulation time의 차이를 관측하고 어느 시계를 cooldown·권한 만료·상점/경제 timer에 쓰는지 명시합니다. 모든 시간을 몰래 버리는 것도 규칙 변경입니다.

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

NPC가 동시에 생성돼 매 1초마다 갱신하면 같은 틱에 반복 파도가 옵니다. 허용 오차가 있는 작업에 안정된 phase·jitter·round-robin을 적용하고 만료 탐색·callback queue·실행 budget을 나눕니다. deadline이 같은 중요한 피해 판정에 임의 jitter를 주면 공정성이 달라집니다.

밀린 callback 전부를 다음 틱에 실행하면 다시 포화됩니다. 회차 누락/합치기 정책·최대 지연·최소 진행을 정하고 만료 시각·실행 시각·중복·skip·가장 오래된 항목을 관측합니다. timer 자료구조가 빨라도 callback 비용을 없애지는 않습니다.

## 집중 부하에서 규칙과 반응을 같이 비교합니다

동일 입력·seed의 fixed/variable step에서 위치·에너지·충돌·timer와 CPU를 비교합니다. 지역 집중·동시 만료·느린 worker·queue 포화·catch-up 상한을 시험합니다. 이 노트는 simulation 예산 설계이며 실제 게임 server 부하 시험 결과는 아닙니다.

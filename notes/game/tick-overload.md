---
id: tick-overload
title: 고정 Tick의 Catch-up·과부하·교차 사건 순서
topic: 게임 서버
summary: 순간 정지와 지속 과부하·simulation/wall time을 구분하고 catch-up 상한·권위 규칙/저빈도 AI·기록된 과부하 mode·cross-server tick/sequence를 설명합니다.
questionIds: [fixed-timestep-catchup, ai-update-frequency-combat-fairness, cross-server-tick-event-order]
---

# 고정 Tick의 Catch-up·과부하·교차 사건 순서

고정 tick은 시뮬레이션의 시간 간격을 일정하게 만들어 입력과 충돌을 재현하기 위한 모델입니다. 서버가 늦어졌을 때 따라잡을지, backlog를 버릴지, 비핵심 작업만 늦출지는 게임 규칙과 공정성의 문제이며 CPU 최적화 하나로 자동 결정되지 않습니다.

## 틱 계산 시간·주기와 backlog 누적·catch-up 불능

50ms 주기의 서버가 500ms 멈추면 약 10틱이 밀립니다.

상태 trace는 wall elapsed=500ms, accumulator=500ms, fixedDt=50ms, backlog=10틱입니다. 한 틱 비용이 60ms이면 10틱을 처리하는 동안 약 600ms가 지나 backlog가 줄지 않고, `maxSteps=4`라면 초기에 쌓인 10틱 가운데 최소 6틱은 선언된 overload policy의 대상이 됩니다. 전투 피해를 조용히 건너뛰지 않으려면 입력·피해·자원 이벤트의 적용/보류/거절 결과를 tick과 함께 기록해야 합니다. 정상 계산이 틱당 20ms면 제한된 추가 실행으로 따라잡을 여지가 있지만 60ms면 한 틱을 처리하는 동안 다시 1틱 이상 시간이 지나 backlog가 계속 늘어납니다. 이를 spiral of death라고 부릅니다.

고정 dt는 수치·입력 재현에 도움되지만 실제 wall time과 simulation time이 항상 같게 만들지는 않습니다. 500ms를 큰 dt 한 번으로 계산하면 중간 충돌·입력·cooldown 결과가 달라질 수 있습니다. 누적 시간을 버리면 세계 시간이 느려진다는 다른 변화가 생깁니다.

## 루프 최대 Step과 CPU 예산

```text
accumulator += measuredElapsed
steps = 0
while accumulator >= fixedDt and steps < maxSteps and budgetRemains:
  applyInputsAssignedTo(simulationTick)
  simulate(fixedDt)
  accumulator -= fixedDt
  simulationTick += 1
  steps += 1
if accumulator still too large:
  enterDeclaredOverloadPolicy()
```

`maxSteps`나 CPU budget에 걸린 뒤에도 처리하지 못한 backlog가 남으면, 그 tick에서 어떤 일을 생략할지 overload policy로 분기합니다. 예를 들어 비핵심 갱신을 늦추거나 입력 수락을 제한하거나 방을 잠시 정지하거나 용량을 이전할 수 있지만, 핵심 피해와 자원 차감은 조용히 skip하지 않습니다. 시간을 clamp로 버리는 정책이라면 버린 사실, policy version, 생략한 회차를 기록해 replay에서 같은 과부하를 재현합니다.

| 시간 | 적용 정책 |
| --- | --- |
| simulation tick | 이동·충돌·전투의 고정 순서 |
| 로컬 monotonic elapsed | 실제 부하·catch-up budget |
| 절대/달력 시각 | 세션·시즌·외부 만료의 정의된 계약 |
| 원격 tick | owner·epoch·기준 snapshot과 함께 해석 |

## AI 평가 감소와 반응성 보존 조건

전략 목표·장식·먼 NPC 갱신은 늦춰도 되는 작업인지, 공격 입력·충돌·cooldown·자원 차감은 권위 규칙인지 먼저 나눕니다. 과부하 때 AI의 공격·회피 평가를 뒤로 미루면 평가 시점이 달라져 반응 분포 자체가 바뀌므로, 허용 지연을 규칙으로 두고 위험 event는 우선 wake-up합니다. 나머지 NPC 평가는 phase를 나눠 실행하되 각 작업에 최소 진행을 남깁니다.

NPC별 stable phase는 매 tick 모든 NPC를 동시에 평가하지 않고 정해진 phase에 나눠 평가하는 기준으로 사용하되, 치명적 위험을 즉시 처리하는 일보다 낮은 우선순위로 둡니다. 과부하 mode의 시작·종료 tick, 적용 policy, 실제 decision을 replay 자료에 함께 남깁니다. 평균 CPU만 비교하지 말고 공격·회피 반응과 피해 결과, 최악 tick을 정상 상태와 대조합니다.

```diagram
{"title":"권위 규칙은 보존하고 허용된 작업만 지연합니다","caption":"화살표는 과부하 판단입니다. 시간 손실과 AI 반응 변화는 기록된 정책이며 숨은 실행 차이로 만들지 않습니다.","rows":[[{"id":"measure","label":"틱 비용·누적 backlog·입력 age"}],[{"id":"budget","label":"max step·CPU budget·과부하 mode"}],[{"id":"critical","label":"순서 보존 전투·자원"},{"id":"optional","label":"허용된 AI/통계 지연"}],[{"id":"record","label":"정책·틱·입력·결과 기록"}]],"edges":[{"from":"measure","to":"budget","label":"지속/순간 구분"},{"from":"budget","to":"critical","label":"불변 규칙"},{"from":"budget","to":"optional","label":"명시적 저하"},{"from":"critical","to":"record","label":"확정 결과"},{"from":"optional","to":"record","label":"생략·반응 변화"}]}
```

## Wall Time과 전투 Tick의 비동일성

서버를 넘나드는 event에는 authority server, owner epoch(그 서버가 권위를 가진 세대), 기준 tick/snapshot, 논리 sequence, event ID를 함께 넣습니다. 수신자는 이 값으로 어느 snapshot에서 event를 읽고 어떤 권위 순서에 적용할지 결정합니다. 늦게 온 event는 bounded reorder로 잠시 순서를 맞출지, 보류·거절·보정할지 정하고, 임의의 도착 순서에 맡기지 않습니다.

handoff 전후 두 server가 같은 피해를 독립 확정하지 않도록 현재 owner를 검사하고 replay는 우연한 thread 도착 순서보다 기록된 확정 순서를 재현합니다. 보관 범위 밖 tick을 임의로 현재 tick과 동일시하지 않습니다.

## 순간 Pause와 지속 과부하의 분리 시험

500ms 정지·매틱 60ms·집중 전투·동시 timer·교차 server 지연·복구 뒤 snapshot 수렴을 시험합니다. 처리/폐기 tick·input age·회복 시간·핵심 event 누락·반응 분포·CPU p99를 봅니다. 이 노트는 과부하 설계이며 실제 server pause 실험 결과는 아닙니다.

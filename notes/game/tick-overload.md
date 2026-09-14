---
id: tick-overload
title: 고정 Tick의 Catch-up·과부하·교차 사건 순서
topic: 게임 서버
summary: 순간 정지와 지속 과부하·simulation/wall time을 구분하고 catch-up 상한·권위 규칙/저빈도 AI·기록된 과부하 mode·cross-server tick/sequence를 설명합니다.
questionIds: [fixed-timestep-catchup, ai-update-frequency-combat-fairness, cross-server-tick-event-order]
---

# 고정 Tick의 Catch-up·과부하·교차 사건 순서

## 한 틱 계산이 주기보다 길면 밀린 일을 더해도 따라잡지 못합니다

50ms 주기의 서버가 500ms 멈추면 약 10틱이 밀립니다. 정상 계산이 틱당 20ms면 제한된 추가 실행으로 따라잡을 여지가 있지만 60ms면 한 틱을 처리하는 동안 다시 1틱 이상 시간이 지나 backlog가 계속 늘어납니다. 이를 spiral of death라고 부릅니다.

고정 dt는 수치·입력 재현에 도움되지만 실제 wall time과 simulation time이 항상 같게 만들지는 않습니다. 500ms를 큰 dt 한 번으로 계산하면 중간 충돌·입력·cooldown 결과가 달라질 수 있습니다. 누적 시간을 버리면 세계 시간이 느려진다는 다른 변화가 생깁니다.

## 루프의 최대 Step과 CPU 예산을 정합니다

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

이 의사코드의 overload policy가 중요합니다. 비핵심 갱신 지연·입력 수락 제한·방 일시 정지·용량 이전 등을 명시하고 핵심 피해/자원 차감을 조용히 skip하지 않습니다. clamp로 버린 시간이 있으면 그 사실·정책 version·생략한 회차를 기록합니다.

| 시간 | 적용 정책 |
| --- | --- |
| simulation tick | 이동·충돌·전투의 고정 순서 |
| 로컬 monotonic elapsed | 실제 부하·catch-up budget |
| 절대/달력 시각 | 세션·시즌·외부 만료의 정의된 계약 |
| 원격 tick | owner·epoch·기준 snapshot과 함께 해석 |

## AI 평가를 줄여도 반응성이 자동 보존되지는 않습니다

전략 목표·장식·먼 NPC 갱신과 공격 입력·충돌·cooldown·자원 차감 같은 권위 규칙을 분리합니다. AI가 공격/회피를 결정하는 평가 자체를 늦추면 반응 분포가 달라집니다. 허용 지연을 게임 규칙으로 명시하고 위험 event의 우선 wake-up·phase 분산·최소 진행을 둡니다.

NPC별 stable phase로 부하를 나누되 치명적 위험의 즉시 처리보다 낮은 우선순위로 둡니다. 과부하 mode·시작/종료 tick·policy·실제 decision을 replay 자료에 남깁니다. 평균 CPU만 보지 말고 공격/회피 반응·피해 결과·최악 tick을 대조합니다.

```diagram
{"title":"권위 규칙은 보존하고 허용된 작업만 지연합니다","caption":"화살표는 과부하 판단입니다. 시간 손실과 AI 반응 변화는 기록된 정책이며 숨은 실행 차이로 만들지 않습니다.","rows":[[{"id":"measure","label":"틱 비용·누적 backlog·입력 age"}],[{"id":"budget","label":"max step·CPU budget·과부하 mode"}],[{"id":"critical","label":"순서 보존 전투·자원"},{"id":"optional","label":"허용된 AI/통계 지연"}],[{"id":"record","label":"정책·틱·입력·결과 기록"}]],"edges":[{"from":"measure","to":"budget","label":"지속/순간 구분"},{"from":"budget","to":"critical","label":"불변 규칙"},{"from":"budget","to":"optional","label":"명시적 저하"},{"from":"critical","to":"record","label":"확정 결과"},{"from":"optional","to":"record","label":"생략·반응 변화"}]}
```

## 서버끼리 같은 Wall Time을 본다고 같은 전투 Tick은 아닙니다

교차 event에는 authority server·owner epoch·기준 tick/snapshot·논리 sequence·event ID를 넣습니다. 수신자는 어느 snapshot으로 검증하고 어느 권위 순서에 적용할지 정의합니다. 늦은 event의 bounded reorder·보류·거절·보정 정책이 필요합니다.

handoff 전후 두 server가 같은 피해를 독립 확정하지 않도록 현재 owner를 검사하고 replay는 우연한 thread 도착 순서보다 기록된 확정 순서를 재현합니다. 보관 범위 밖 tick을 임의로 현재 tick과 동일시하지 않습니다.

## 순간 Pause와 지속 과부하를 분리해 시험합니다

500ms 정지·매틱 60ms·집중 전투·동시 timer·교차 server 지연·복구 뒤 snapshot 수렴을 시험합니다. 처리/폐기 tick·input age·회복 시간·핵심 event 누락·반응 분포·CPU p99를 봅니다. 이 노트는 과부하 설계이며 실제 server pause 실험 결과는 아닙니다.

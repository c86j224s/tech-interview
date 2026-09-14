---
id: stream-time-state
title: 스트림 Watermark·Checkpoint와 정기 회차 복구
topic: 분산 시스템
summary: 발생·처리 시각·진행 추정을 구분하고 늦은 정정·유휴 source·입력 위치와 집계 snapshot·예정 회차 catch-up·외부 효과를 설명합니다.
questionIds: [event-time-watermark, stream-state-checkpoint, scheduler-missed-runs]
---

# 스트림 Watermark·Checkpoint와 정기 회차 복구

## 늦게 도착한 사건을 언제까지 기다릴지 정해야 합니다

10:00~10:01의 매출을 집계하는데 10:00:50 사건이 10:01:20에 도착할 수 있습니다. event time은 사건에 부여한 발생 시각이고 processing time은 실제 처리 시각입니다. 네트워크·재시도·clock skew 때문에 둘은 다릅니다.

watermark는 특정 시각 이전 사건이 충분히 도착했다고 보는 진행 추정·source 계약입니다. 늦은 사건이 물리적으로 더는 올 수 없다는 증명이 아닙니다. window의 잠정·확정·정정 정책을 별도로 정합니다.

## Watermark와 Allowed Lateness의 기준을 명시합니다

예를 들어 watermark가 window end를 통과하면 잠정 결과를 내고 end+30초를 통과하면 state cleanup·최종판을 만드는 정책을 택할 수 있습니다. 이는 처리 벽시계로 정확히 30초 뒤라는 뜻이 아니며 실제 엔진의 trigger·allowed lateness·watermark 의미를 확인해야 합니다.

| 상황 | 정책 선택 | 비용 |
| --- | --- | --- |
| 늦지만 허용 창 안 | 집계 갱신·추가 결과 | 중복·정정 수신 처리 |
| 창 밖 지연 | drop·side output·정정판 | 손실 또는 보정 책임 |
| 유휴 source | watermark에서 제외하는 idle 정책 | 복귀 후 오래된 사건 처리 |
| 미래 timestamp | 허용 범위 검증·격리 | 잘못된 조기 마감 방지 |

partition별 watermark의 최소를 사용하면 하나의 멈춘 source가 전체 진행을 막을 수 있습니다. idle로 제외하면 결과는 빨라지지만 그 source가 나중 옛 사건을 보내는 경우를 처리해야 합니다. 미래 시각 입력으로 모든 window를 조기에 닫지 않도록 출처·범위를 검증합니다.

```diagram
{"title":"발생 시각의 Window와 처리 도착을 분리합니다","caption":"화살표는 처리 단계입니다. watermark는 진행 판단이며, 확정 뒤 늦은 사건은 명시적인 정정·보류·폐기 정책으로 다룹니다.","rows":[[{"id":"event","label":"event time이 있는 사건"}],[{"id":"arrival","label":"지연·역순 도착"}],[{"id":"window","label":"window state·watermark 판단"}],[{"id":"version","label":"잠정·확정·정정 버전 출력"}]],"edges":[{"from":"event","to":"arrival","label":"전달 시간"},{"from":"arrival","to":"window","label":"ID·시각 검증"},{"from":"window","to":"version","label":"마감 정책"}]}
```

## Checkpoint의 상태와 입력 위치는 같은 경계를 가리켜야 합니다

상태 합계가 offset 100까지 반영됐는데 복구 위치를 90으로 저장하면 91~100을 다시 더할 수 있습니다. 상태는 90인데 입력 위치가 100이면 효과를 건너뜁니다. state snapshot과 partition별 다음 입력 위치를 일관된 복구 기준으로 저장해야 합니다.

분산 스트림 엔진은 barrier·channel state·aligned 또는 unaligned snapshot 같은 방식으로 일관성을 구현할 수 있지만 실제 지원 프로토콜을 확인합니다. 이때 source offset은 모든 partition을 관통하는 하나의 시간 번호가 아닙니다. window state·timer·dedup·serializer·계산 버전도 재시작 의미에 포함될 수 있습니다.

## 내부 Exactly-once와 외부 Sink는 다른 경계입니다

엔진 state와 입력 위치가 맞아도 메일·HTTP 결제·외부 DB 출력은 다시 실행될 수 있습니다. transactional sink·stable effect key·outbox·결과 조회 등 그 sink의 commit 프로토콜이 필요합니다. checkpoint 성공이 외부 모든 효과의 단일 적용을 자동 뜻하지 않습니다.

checkpoint가 자주 실패하면 정상 처리율이 높아도 재작업 구간이 커집니다. 마지막 성공 나이·state 크기·저장 대역폭·checkpoint 시간·source 보관 범위를 관찰합니다. 코드·state serializer를 바꿀 때 old snapshot 복구와 rollback이 가능한지도 시험합니다. 필요한 입력이 retention 밖이면 새 원본 snapshot·대사가 필요합니다.

## 정기 작업은 예정 회차와 실제 실행을 나눕니다

한 시간 멈춘 scheduler가 매 10분 회차를 모두 보충해야 하는 정산과 최신 cache 갱신 한 번이면 되는 작업은 다릅니다. `(job_type, 예정 회차, scope)` 같은 논리 키로 같은 회차 중복을 막고, 미실행·보충·건너뜀·진행·완료를 기록합니다.

밀린 모든 회차를 한꺼번에 시작하면 복구 중 정상 요청을 굶길 수 있어 별도 동시성·대기·우선순위 예산을 둡니다. 이전 실행이 아직 남았을 때 skip·queue·중첩 허용 중 정책을 정합니다. lease 만료는 옛 실행 종료가 아니므로 효과·완료에 generation·멱등 키를 적용합니다.

현지 cron은 DST의 없는 시각·중복 시각과 timezone·캘린더 규칙을 포함해야 합니다. 예정 시각의 ID와 로컬 elapsed timeout을 구분하고 wall-clock jump로 같은 회차가 두 번 생기지 않게 합니다.

## 복구 결과와 마감 이후 정정을 확인합니다

역순·허용 창 안팎·idle 복귀·미래 시각·snapshot 중단·sink 성공 후 실패·중복 scheduler를 합성 입력으로 시험합니다. 합계·입력 위치·출력 version·원장 효과·예정 회차별 결과를 대조합니다. 현재 작업에서는 스트림 엔진이나 실제 정기 작업 복구를 실행하지 않았습니다. 본문은 시간과 상태 복구의 설계 설명입니다.

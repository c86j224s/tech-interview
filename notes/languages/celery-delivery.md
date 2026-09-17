---
id: celery-delivery
title: Celery 실행·ACK·재전달과 업무 멱등성
topic: 언어·런타임
summary: 예약·task state·DB 효과·ACK를 나누고 late ACK·worker lost·visibility·동일 task ID 재시도·원자 원장·재처리 상한을 설명합니다.
questionIds: [python-celery-retries, celery-visibility-late-ack-interaction]
---

# Celery 실행·ACK·재전달과 업무 멱등성

## 함수 완료와 Broker 확인의 구분

worker가 포인트를 DB에 지급한 뒤 ACK 전에 종료되면 broker가 같은 작업을 다시 전달할 수 있습니다. 반대로 실행 전에 ACK한 설정에서 worker가 죽으면 broker는 이미 처리된 메시지로 보아 다시 보내지 않을 수 있습니다. 예약·실행·함수 반환·result backend 상태·ACK·DB 효과를 분리해야 합니다.

Celery는 작업 실행과 재시도 도구이며 모든 외부 변경을 정확히 한 번으로 만드는 거래 관리자가 아닙니다. task state가 SUCCESS라고 외부 모든 저장소가 한 원자 경계로 확정된 것도 아닙니다.

## Late ACK와 실패 정책의 상호작용

| 구성·사건 | 확인할 계약 | 남는 문제 |
| --- | --- | --- |
| 실행 전 ACK | worker 중단 때 재전달 여부 | 실행을 잃을 수 있음 |
| task_acks_late | 실행 이후 ACK 시점 | 중복 실행 가능 |
| task_acks_on_failure_or_timeout | 실패·timeout의 ACK | 재처리와 영구 실패 정책 |
| task_reject_on_worker_lost | 자식 worker 손실 때 requeue | poison task 반복 |
| self.retry·autoretry | 새 시도 예약·오류 분류 | 이미 생긴 외부 효과 |

late ACK를 켜도 자식 프로세스 손실·hard limit에서 부모 worker의 ACK 정책이 관여할 수 있습니다. 정확한 Celery·broker transport·worker pool·옵션 버전을 고정해야 합니다. 모든 broker가 같은 visibility timeout 개념을 갖는 것도 아닙니다.

self.retry는 일반적으로 같은 task ID를 유지한 재시도를 만들 수 있으므로 task ID 하나가 물리 실행 한 번이라는 뜻은 아닙니다. 반대로 같은 포인트 지급을 두 번 별도 제출하면 task ID는 달라도 업무 효과는 하나여야 할 수 있습니다. 업무 키와 실행 시도 ID를 구분합니다.

## Visibility 기한 초과 작업과 중복 실행

visibility 기반 transport에서 메시지가 일정 시간 동안 다른 소비자에게 보이지 않게 되었다가 기한이 지나 다시 전달될 수 있습니다. A가 90초 작업인데 visibility가 60초라면 A가 여전히 실행 중일 때 B가 같은 논리 작업을 받을 수 있습니다. 이는 예시이며 실제 예약·타이머 시작점·복원 주기는 transport 계약을 확인해야 합니다.

```diagram
{"title":"재전달이 옛 Worker의 종료를 보장하지 않습니다","caption":"화살표는 같은 논리 작업의 전달 경로입니다. visibility 만료 뒤 두 worker가 동시에 효과를 시도할 수 있으므로 최종 DB의 멱등 경계가 필요합니다.","rows":[[{"id":"message","label":"논리 지급 작업 P"}],[{"id":"a","label":"worker A 실행 중"},{"id":"b","label":"기한 후 worker B 재전달"}],[{"id":"db","label":"DB의 지급 키 unique·거래"}]],"edges":[{"from":"message","to":"a","label":"첫 예약"},{"from":"message","to":"b","label":"재노출"},{"from":"a","to":"db","label":"같은 효과 키"},{"from":"b","to":"db","label":"중복 효과 거절"}]}
```

기한 연장을 지원하는 transport인지, Celery가 실제로 어떤 방식으로 사용하는지 확인하지 않고 자동 heartbeat 연장을 가정하지 않습니다. 기한을 길게 하면 중복 창을 줄일 수 있어도 worker 손실 후 복구가 늦어질 수 있습니다. 긴 작업은 checkpoint·분할을 검토하고 ETA·countdown 예약과 실행 시간의 영향을 별도로 봅니다.

## 효과 키와 원장 변경의 원자적 결합

```text
begin transaction
  insert payment_effect_key(P) with unique constraint
  if duplicate: read previously recorded result
  else:
    validate current account and business state
    apply points ledger entry
    record stable result
    append downstream event to outbox if needed
commit
ack according to configured delivery policy
```

결제 작업 P가 효과 키를 먼저 기록한 뒤 원장 변경 전에 worker가 죽으면, 재시도는 이미 있는 키만 보고 지급을 건너뛸 수 있습니다. 반대로 원장 변경 뒤 키를 저장하면 worker가 키를 남기기 전에 죽었을 때 재시도가 같은 지급을 다시 반영할 수 있습니다.

따라서 키 삽입과 원장 변경은 한 DB 거래로 묶고, 그 경계를 쓸 수 없다면 명시적 상태 머신과 실제 효과 조회로 재개 지점을 결정합니다. 외부 API를 호출하는 경우에는 해당 API의 멱등 키와 결과 조회를 사용하며, 로컬 `started` 레코드만 보고 무조건 재호출하지 않습니다.

result backend와 업무 DB가 다르면 상태 기록이 서로 다른 시점에 실패할 수 있습니다. 사용자에게는 업무 원장을 기준으로 성공·처리 중·불확실 상태를 보여 주고 task 상태만으로 돈이 지급됐다고 단정하지 않습니다.

## 재시도의 복구 범위와 한계

일시 오류는 재시도 여부를 검토할 수 있지만, 영구 입력 오류는 같은 입력을 반복해도 해결되지 않습니다. 권한 거절은 권한 상태가 바뀌지 않는 한 같은 방식의 무조건 재시도로 해결되지 않으므로 별도 정책으로 분류합니다.

외부 반영 여부를 모르는 불확실 결과는 별도 경로로 두고, 최대 시도 횟수·전체 deadline·backoff·jitter·dead-letter 또는 수동 보류를 적용합니다. worker lost 뒤 계속 requeue되는 poison task가 다른 작업을 막지 않도록 재처리 상한이나 격리 경로를 둡니다.

대시보드에서는 재시도 횟수와 실제 논리 효과 수를 따로 세어, 실행 횟수와 업무 효과 횟수를 혼동하지 않습니다.

정상 완료, 효과 후 worker 중단, ACK 유실, visibility 만료 중 실행 지속, 결과 저장 실패를 테스트 DB·broker에서 재현합니다. 최종 지급 한 건과 재처리 가능한 상태를 확인해야 합니다. 현재 작업에서는 Celery·broker를 실행하지 않았으며 위 내용은 전달·효과의 계약 설명과 통합 검증 절차입니다.

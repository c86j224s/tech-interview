---
id: idempotency
title: 재시도·멱등성·Outbox
topic: 분산 시스템
summary: 응답 유실의 불확정성에서 출발해 요청 키·처리 원장·이벤트 발행의 실패 구간을 설계합니다.
questionIds: [request-timeout-idempotency, message-consumer-idempotency, transactional-outbox, retry-safe-state-machine, saga-compensation, retry-exponential-jitter, retry-budget-amplification, agent-tool-idempotency, agent-durable-execution]
---

# 재시도·멱등성·Outbox

## timeout이 알려 주지 않는 것

클라이언트가 응답을 못 받은 경우는 세 가지가 가능합니다.

1. 서버에 도착하지 않았습니다.
2. 서버가 처리 중입니다.
3. 서버는 이미 성공했지만 응답만 사라졌습니다.

따라서 timeout을 미실행으로 간주해 새 주문을 만들면 중복될 수 있습니다. 재시도는 같은 논리 요청이라는 식별을 유지해야 합니다.

## 논리 키와 실제 시도

HTTP 요청 ID·도구 호출 ID는 전달 시도별로 달라질 수 있습니다. 멱등 키는 사용자의 같은 의도를 식별합니다. 다른 정상 주문 두 건이 인자가 같아도 같은 키로 합쳐서는 안 됩니다.

저장 기록에는 사용자·작업 키·정규화한 인자 해시·상태·결과 ID·만료를 연결할 수 있습니다. 같은 키에 다른 인자가 오면 기존 성공을 무심코 반환하지 않고 충돌로 처리합니다.

```text
begin transaction
    insert request_record(user, key, argument_hash)  // UNIQUE
    if duplicate:
        check same arguments and return recorded state/result
    apply domain change
    store result identifier
commit
```

실제 코드는 DB의 고유 오류·격리·rollback 계약에 맞춰 구현해야 합니다. 미리 SELECT만 하고 INSERT하면 둘 다 없음으로 보는 경쟁이 남습니다.

## 처리 중 소유자가 죽으면

장기 외부 작업은 한 DB transaction에 넣기 어려워 `pending → running → succeeded / needs_repair` 같은 내구 상태가 필요합니다. lease로 재획득할 수 있어도 옛 worker가 살아 있을 수 있습니다. 새 세대보다 낮은 쓰기를 저장 지점에서 거절하는 fencing과 외부 API의 멱등성을 조합합니다.

키 보존 기간이 끝난 뒤 늦은 재시도가 오면 원래 보장이 사라질 수 있습니다. 최대 재시도·수동 재생 기간과 원장 보존을 맞추거나 오래된 요청을 명시적으로 거절합니다.

## Outbox가 막는 유실

주문 commit과 메시지 발행을 따로 하면 그 사이 종료로 메시지를 잃을 수 있습니다. 주문 변경과 outbox 행을 같은 로컬 transaction에 저장합니다.

```text
begin
    update order with expected state/version
    insert outbox(event_id, order_id, payload_version, payload)
commit

publisher:
    claim pending event
    publish with stable event_id
    record delivery result
```

발행 ACK 뒤 상태 기록 전에 죽으면 중복 발행할 수 있습니다. Outbox는 이중 쓰기의 유실을 줄이는 방법이지 모든 메시지를 정확히 한 번 보내는 마법이 아닙니다. 소비자는 처리 ID와 포인트 지급 같은 실제 변경을 같은 원자 경계에 기록합니다.

## 실패 표

| 중단 지점 | 가능한 상태 | 복구 |
| --- | --- | --- |
| DB commit 전 | 전체 rollback 가능 | 같은 논리 키로 재시도 |
| commit 후 응답 전 | 변경 성공, client는 불확정 | 결과 조회 |
| outbox 발행 후 표시 전 | 메시지 재발행 가능 | 소비자 멱등성 |
| 외부 결제 후 로컬 기록 전 | 외부만 성공 가능 | 결제사 조회·대사 |

## 재시도의 운영 비용

backoff·jitter·시도 상한·전체 deadline을 둡니다. 상위 3회와 하위 3회가 겹치면 최대 9회가 될 수 있어 모든 실제 시도를 집계합니다. 인증 거절·잘못된 인자는 반복해도 해결되지 않습니다. 여러 서비스의 부분 성공은 saga·보정 원장·수동 대사처럼 명시적으로 처리합니다.

## 연습

각 표의 중단 지점에 실패를 주입하고 최종 주문 수·원장·outbox·응답을 확인합니다. 같은 키와 다른 payload, 키 만료, 두 worker의 동시 실행, 취소 뒤 늦은 성공을 포함합니다. 성공 문구보다 실제 외부 효과를 검사해야 합니다.

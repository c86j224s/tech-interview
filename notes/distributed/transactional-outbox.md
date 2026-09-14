---
id: transactional-outbox
title: Transactional Outbox로 이중 쓰기 실패 다루기
topic: 분산 시스템
summary: 주문 상태 변경과 이벤트 발행 의도를 같은 DB 트랜잭션에 기록해 이중 쓰기 사이의 유실을 없애고, Relay 재발행은 별도 중복으로 다룹니다.
questionIds: [transactional-outbox, db-outbox-polling-cdc, outbox-claim-lease-recovery]
---

# Transactional Outbox로 이중 쓰기 실패 다루기

주문 `o-17`을 `PAID`에서 `DONE`으로 바꾸면서 `OrderCompleted` 이벤트를 발행해야 한다고 하겠습니다. 주문 DB에 먼저 확정하고 브로커에 보내는 순서라면, DB 확정 직후 서버가 꺼질 때 주문은 완료됐지만 이벤트가 사라집니다. 반대로 브로커에 먼저 보내고 주문 변경이 되돌려지면 실제로 완료되지 않은 주문의 완료 이벤트가 나갑니다. 두 저장소의 호출 순서를 바꾸는 것만으로는 이 틈을 없앨 수 없습니다.

**트랜잭셔널 아웃박스**(transactional outbox)는 이 두 성공을 억지로 하나로 만드는 기법이 아닙니다. 주문 변경과 “이 이벤트를 나중에 반드시 전달해야 한다”는 outbox 행을 같은 DB 트랜잭션(transaction)에 넣고, 별도 Relay가 확정 뒤에 그 행을 브로커로 전달하게 만드는 방식입니다. 이 노트는 그 저장·전달 경계에 집중합니다. Relay가 브로커의 ACK를 확인하기 전에 죽어 같은 이벤트를 다시 보내는 일과, 이를 받는 consumer가 중복을 막아야 한다는 사실은 마지막 경계까지만 다룹니다.

## 보장은 주문 DB의 한 확정에서 시작합니다

주문 완료를 성공으로 인정하는 불변식은 간단합니다.

> `orders.state = DONE`으로 확정된 모든 전이는 해당 전이를 설명하는 outbox event도 같은 확정에 가져야 합니다.

따라서 `orders`의 상태를 바꾸는 UPDATE와 `outbox_events` INSERT는 같은 DB 연결과 같은 트랜잭션을 사용해야 합니다. UPDATE 결과가 0행이면 전이가 일어나지 않은 것이므로 outbox event도 만들지 않습니다. 이미 완료된 주문을 다시 완료하는 명령을 no-op으로 볼지 충돌로 볼지는 서비스 계약의 문제지만, 새 완료 전이를 만들지 않는다는 점은 같습니다.

상태 전이 뒤 event를 만들 때는 명령에 들어 있던 값이나 애플리케이션이 추정한 버전을 사용하지 않습니다. `UPDATE ... RETURNING`처럼 DB가 실제로 확정한 새 `version`, `state`, 금액 등 event에 필요한 열을 돌려주는 방식으로 전이 결과를 받아야 합니다. RETURNING을 지원하지 않는 DB라면 영향받은 행이 1개인지 확인한 뒤 같은 트랜잭션 안에서 갱신된 행을 읽어야 합니다. 그래야 동시에 다른 요청이 바꾼 값을 명령 payload로 덮어쓰거나, DB가 반환하지 않은 추정 버전으로 event를 만드는 일이 없습니다.

Outbox 행에는 Relay가 최신 주문을 다시 읽지 않아도 당시 사실을 전달할 수 있도록 다음 정보를 고정해 둡니다.

```text
outbox_events
-------------
event_id           -- 재시도에도 유지되는 evt-5
aggregate_type     -- Order
aggregate_id       -- o-17
aggregate_version  -- 5
event_type         -- OrderCompleted
payload            -- state=DONE, total=12000의 저장된 본문
status             -- PENDING / CLAIMED / SENT / QUARANTINED
attempts
next_attempt_at    -- NOT NULL, 처음에는 현재 시각
lease_owner        -- PENDING이면 NULL
lease_generation     -- 처음에는 0
lease_until        -- PENDING이면 NULL, CLAIMED이면 만료 시각
created_at
sent_at
last_error
```

`PENDING`의 `lease_until`은 `NULL`이어도 됩니다. 대신 Relay가 찾는 조건에서 `PENDING`은 `next_attempt_at`으로, `CLAIMED`는 `lease_until` 만료로 각각 판정해야 합니다. 두 상태를 한 조건으로 묶어 `lease_until <= now`만 검사하면 초기 `PENDING` 행은 NULL 비교 때문에 영원히 선택되지 않을 수 있습니다.

`aggregate_version`와 payload를 저장하는 이유는 Relay가 나중에 `orders`의 최신 상태를 읽어 메시지를 조립하면 안 되기 때문입니다. 완료 event를 만들고 나서 주문이 취소되었는데 Relay가 최신 `CANCELLED` 상태를 읽으면, 완료 전이를 알리려던 event가 다른 사실을 전달하게 됩니다. 당시 전이의 사실을 보낼지 최신 상태를 다시 확인하게 할지 먼저 정해야 하며, 이 예에서는 DB가 반환한 완료 행으로 만든 event 본문을 보냅니다.

## 구성요소와 바깥 경계

```diagram
{"title":"주문 변경과 이벤트 의도의 흐름","caption":"화살표는 호출·데이터 흐름입니다. OrderService의 주문 트랜잭션 안에는 주문 변경과 outbox 기록만 들어가고, Relay의 브로커 publish는 그 경계 밖에서 수행됩니다.","rows":[[{"id":"caller","label":"주문 요청","detail":["완료 명령"]}],[{"id":"service","label":"OrderService","detail":["전이 결정","트랜잭션 시작/확정"]}],[{"id":"db","label":"주문 DB","detail":["orders","outbox_events"]}],[{"id":"relay","label":"Relay","detail":["pending/lease claim","브로커 publish"]}],[{"id":"broker","label":"메시지 브로커","detail":["이벤트 수락·전달"]}]],"edges":[{"from":"caller","to":"service","label":"complete"},{"from":"service","to":"db","label":"같은 트랜잭션"},{"from":"db","to":"relay","label":"확정 행 조회"},{"from":"relay","to":"broker","label":"publish"},{"from":"broker","to":"relay","label":"ACK"}]}
```

`OrderService`의 주문 트랜잭션이 확정되기 전에는 Relay가 읽을 확정 event가 없습니다. 확정 뒤 Relay가 잠시 꺼져도 outbox 행이 DB에 남으므로, 주문 결과와 전달 의도가 함께 사라지지 않습니다. 반대로 Relay와 브로커 호출은 같은 DB 트랜잭션으로 묶이지 않으므로, 브로커 수락과 `SENT` 표시는 서로 다른 중단 구간을 가집니다.

구성요소의 책임을 호출 관계와 함께 보면 어느 쪽이 어떤 트랜잭션을 소유하는지 더 분명해집니다.

```diagram
{"title":"Outbox 책임과 트랜잭션 소유","caption":"화살표는 소유·사용 관계입니다. OrderService가 주문 트랜잭션 수명을 소유하고 두 Repository는 같은 tx를 사용합니다. Relay는 주문 tx를 소유하지 않으며, 별도 짧은 상태 갱신 tx와 브로커 publish를 담당합니다.","kind":"class","rows":[[{"id":"service","label":"OrderService","detail":["owns: order tx","completeOrder()"]}],[{"id":"orderTx","label":"OrderTransaction","detail":["BEGIN → COMMIT","orders + outbox"]}],[{"id":"orderRepo","label":"OrderRepository","detail":["markDone(tx, id)","RETURNING 전이 결과"]},{"id":"outboxRepo","label":"OutboxRepository","detail":["append(tx, event)","outbox 책임"]}],[{"id":"db","label":"Order DB","detail":["orders","outbox_events"]}],[{"id":"relay","label":"Relay","detail":["claimOne()","publish()","markSent()"]},{"id":"relayTx","label":"RelayTransaction","detail":["짧은 claim/표시","lease 세대 조건"]}],[{"id":"broker","label":"Broker","detail":["외부 전달"]}]],"edges":[{"from":"service","to":"orderTx","label":"소유·begin/commit"},{"from":"orderTx","to":"orderRepo","label":"같은 tx 사용"},{"from":"orderTx","to":"outboxRepo","label":"같은 tx 사용"},{"from":"orderRepo","to":"db","label":"orders 기록"},{"from":"outboxRepo","to":"db","label":"outbox 기록"},{"from":"relay","to":"relayTx","label":"소유·짧게 갱신"},{"from":"relayTx","to":"db","label":"claim/status 기록"},{"from":"relay","to":"broker","label":"담당·publish"}]}
```

여기서 Repository가 트랜잭션을 새로 열거나 먼저 확정하면 그림의 보장이 깨집니다. 반대로 Relay는 주문 트랜잭션을 소유하지 않지만 브로커 `publish`는 담당합니다. Relay는 행을 브로커에 보내는 동안 주문 DB 잠금을 오래 잡지 않고, claim과 완료·재시도 표시처럼 자기 상태를 바꾸는 짧은 트랜잭션만 사용합니다.

## 한 주문의 상태를 끝까지 추적합니다

초기 상태는 다음과 같습니다.

```text
orders:       (id=o-17, state=PAID, version=4, total=12000)
outbox_events: 없음
broker:       없음
```

완료 요청이 들어오면 `state=PAID AND version=4` 조건으로 상태를 바꾸고, DB가 반환한 전이 결과에서 새 버전과 event payload를 얻어 같은 트랜잭션에서 `evt-5`를 삽입합니다. Relay가 최신 주문을 다시 조회하지 않고 outbox의 payload를 보내도록 event 내용을 고정합니다.

| 시점 | `orders` | `outbox_events` | 브로커 | 다음 행동 |
| --- | --- | --- | --- | --- |
| t0 | `PAID`, v4 | 없음 | 없음 | OrderService가 주문 트랜잭션 시작 |
| t1 | `DONE`, v5 예정 | `evt-5` 예정 | 없음 | 아직 확정 전이라 외부에서 보이지 않음 |
| t2 | `DONE`, v5 | `evt-5`, `PENDING`, lease=NULL | 없음 | 두 행이 함께 확정됨 |
| t3 | `DONE`, v5 | `evt-5`, `CLAIMED`, generation 7, lease 만료 시각 설정 | 없음 | Relay가 소유권을 얻음 |
| t4 | `DONE`, v5 | `CLAIMED`, generation 7 | `evt-5` 수락 여부 확인 중 | ACK 확인 전 또는 표시 전 Relay가 중단될 수 있음 |
| t5 | `DONE`, v5 | 재전달 후 `SENT`, lease=NULL | `evt-5`가 두 번 도착할 수도 있음 | stable `event_id`로 consumer 경계에서 중복 방어 |

t1에서 서버가 중단되면 트랜잭션이 되돌려져 주문도 outbox도 남지 않습니다. t2에서 확정한 뒤 서버가 중단되면 주문과 `PENDING` 행이 함께 남고, `lease_until=NULL`인 초기 행도 `next_attempt_at` 조건으로 Relay가 찾을 수 있습니다. t4의 중복 가능성은 Outbox가 실패해서가 아니라 DB 확정과 브로커 ACK를 하나의 원자 경계로 만들 수 없어서 생기는 별도의 사실입니다.

## 실제 처리 순서

주문 서비스는 상태 전이의 영향받은 행과 DB가 확정한 새 값을 확인한 뒤 event를 만듭니다. `markDone`이 0행인데도 outbox를 삽입하면 완료되지 않은 주문의 완료 event를 만들게 되므로, INSERT는 성공한 전이 뒤에만 실행합니다. event 본문은 `command`에서 조립하지 않고 `RETURNING` 결과인 `transition`에서 만듭니다.

```text
OrderRepository.markDone(tx, command):
    return tx.queryOne("""
        UPDATE orders
           SET state = 'DONE',
               version = version + 1,
               updated_at = dbNow()
         WHERE id = :orderId
           AND state = 'PAID'
           AND version = :expectedVersion
        RETURNING id, state, version, total, currency
    """)

OrderService.completeOrder(command):
    tx = db.begin()
    try:
        transition = OrderRepository.markDone(tx, command)

        if transition == null:
            tx.rollback()
            current = OrderRepository.read(command.orderId)
            if current == null:
                return notFound(command.orderId)
            if current.state == "DONE":
                return alreadyCompleted(current)
            return conflict(current)

        event = Event(
            eventId=stableEventId(
                aggregateId=transition.id,
                aggregateVersion=transition.version,
                eventType="OrderCompleted"
            ),
            aggregateId=transition.id,
            aggregateVersion=transition.version,
            type="OrderCompleted",
            payload=completionPayloadFrom(transition)
        )
        OutboxRepository.append(tx, event)
        tx.commit()
        return success(transition.id, transition.version)
    except:
        tx.rollback()
        raise
```

`transition`에는 DB가 실제로 갱신한 `version=5`, `state=DONE`, `total`, `currency`가 들어 있으므로 `transition.version` 외의 추정 버전이나 요청 본문의 금액을 사용할 필요가 없습니다. `transition == null`일 때는 반드시 확정 전 읽기로 돌아가 `current == null`인 주문 없음, 이미 `DONE`인 재요청, 그 밖의 버전·상태 충돌을 나눕니다. `current`가 없는데 `current.state`를 읽지 않는 것이 이 경로의 중요한 조건입니다.

위 코드는 인증·자원별 권한 검사를 통과한 명령과 적절한 DB 격리를 전제로 한 슈도코드입니다. SQL의 바인딩 값은 드라이버로 전달하고, `RETURNING`은 갱신 결과이지 아직 커밋 성공 확인은 아닙니다. 잠금·직렬화 충돌 오류는 엔진 계약에 맞게 트랜잭션 전체를 재시도하거나 보고해야 합니다. 커밋 응답을 잃었다면 같은 상태·버전 조건으로 결과를 확인하며, 이미 끝난 트랜잭션에 무조건 rollback을 호출해 원래 오류를 가리지 않습니다.

두 완료 명령이 같은 주문·같은 버전으로 동시에 들어오면 한 UPDATE만 `transition`을 반환합니다. 다른 요청은 `transition == null`이 된 뒤 현재 행을 읽으므로, 첫 요청이 확정한 `DONE`을 보고 이미 완료된 명령으로 끝나며 새 outbox를 만들지 않습니다.

Relay는 네트워크 전송 중에 DB 잠금을 유지하지 않도록 먼저 짧게 claim합니다. 선택 조건은 초기 `PENDING`과 lease가 끝난 `CLAIMED`를 분리합니다. `claimOne`은 확정된 row와 자신이 얻은 generation을 반환하고, 찾지 못했을 때의 대기는 트랜잭션 바깥에서 합니다.

```text
Relay.claimOne():
    tx = db.begin()
    try:
        claimNow = tx.dbNow()
        candidate = tx.selectOne(
            outbox_events,
            where=(
                (status = "PENDING" AND next_attempt_at <= claimNow)
                OR
                (status = "CLAIMED" AND lease_until <= claimNow)
            ),
            orderBy=created_at,
            forUpdateSkipLocked=true
        )

        if candidate == null:
            tx.rollback()
            return null

        nextGeneration = candidate.lease_generation + 1
        claimed = tx.updateOutbox(candidate.event_id)
            .set(
                status="CLAIMED",
                lease_owner=this.relayId,
                lease_generation=nextGeneration,
                lease_until=claimNow + LEASE_DURATION
            )
            .returning(
                event_id, event_type, aggregate_id, aggregate_version,
                payload, lease_owner, lease_generation, lease_until
            )
        tx.commit()
        return claimed
    except:
        tx.rollback()
        raise

Relay.loop():
    while true:
        claimed = Relay.claimOne()
        if claimed == null:
            sleep(POLL_INTERVAL)       // 트랜잭션 밖에서 대기
            continue

        outcome = broker.publish(
            eventId=claimed.event_id,
            type=claimed.event_type,
            payload=claimed.payload
        )

        if outcome == ACK_CONFIRMED:
            Relay.markSent(claimed)
        else if outcome in [ACK_UNKNOWN, RETRYABLE_FAILURE]:
            Relay.markPendingForRetry(claimed, outcome.error)
        else if outcome == PERMANENT_FAILURE:
            Relay.quarantine(claimed, outcome.error)
```

여기서 `ACK_CONFIRMED`는 단순히 TCP 쓰기가 끝났다는 뜻이 아닙니다. 브로커의 설정된 내구성 계약에 따라 event를 수락했고, Relay가 성공 응답으로 간주할 수 있다는 확인이어야 합니다. 연결 timeout이나 응답 유실은 브로커가 받았는지 모르는 `ACK_UNKNOWN`으로 처리합니다. 이때도 `SENT`로 먼저 바꾸지 않고 같은 `event_id`로 다시 보낼 수 있게 둡니다. 브로커별로 ACK가 무엇을 보장하는지 명시하지 않으면 `SENT`라는 저장 상태의 의미가 흔들립니다.

완료와 재시도 표시는 모두 현재 소유자와 generation을 조건으로 갱신합니다. 재시도 대상이 다시 `PENDING`이 될 때는 lease 소유자와 만료 시각을 반드시 비워야 초기 행과 같은 선택 조건으로 돌아옵니다.

```text
Relay.markSent(claimed):
    tx = db.begin()
    try:
        tx.update(outbox_events)
           .set(
               status="SENT",
               sent_at=tx.dbNow(),
               lease_owner=null,
               lease_until=null
           )
           .where(
               event_id=claimed.event_id,
               status="CLAIMED",
               lease_owner=claimed.lease_owner,
               lease_generation=claimed.lease_generation
           )
        tx.commit()
    except:
        tx.rollback()
        raise

Relay.markPendingForRetry(claimed, error):
    tx = db.begin()
    try:
        tx.update(outbox_events)
           .set(
               status="PENDING",
               attempts=attempts + 1,
               next_attempt_at=backoffTime(),
               last_error=error,
               lease_owner=null,
               lease_until=null
           )
           .where(
               event_id=claimed.event_id,
               status="CLAIMED",
               lease_owner=claimed.lease_owner,
               lease_generation=claimed.lease_generation
           )
        tx.commit()
    except:
        tx.rollback()
        raise

Relay.quarantine(claimed, error):
    tx = db.begin()
    try:
        tx.update(outbox_events)
           .set(
               status="QUARANTINED",
               last_error=error,
               lease_owner=null,
               lease_until=null
           )
           .where(
               event_id=claimed.event_id,
               status="CLAIMED",
               lease_owner=claimed.lease_owner,
               lease_generation=claimed.lease_generation
           )
        tx.commit()
    except:
        tx.rollback()
        raise
```

각 갱신의 영향받은 행이 0이면 이미 lease가 다른 Relay로 넘어갔거나 다른 경로가 처리한 것입니다. 이 경우 옛 Relay가 성공으로 단정해 상태를 덮어쓰지 않고, 다음 조회에서 최신 상태를 확인해야 합니다. 브로커가 `ACK_CONFIRMED`를 준 뒤 `markSent` 전에 Relay가 죽으면 같은 event가 다시 발행될 수 있습니다. 따라서 Relay의 안전한 기본값은 안정적인 `event_id`를 가진 최소 한 번 전달이며, consumer는 그 ID를 처리 기록과 실제 효과에 함께 사용해야 합니다. 그 consumer 트랜잭션의 상세 설계는 이 노트의 범위가 아닙니다.

## 중단 지점별 실패 표

| 중단 지점 | 주문 DB | Outbox | 브로커 | 복구와 경계 |
| --- | --- | --- | --- | --- |
| `markDone` 전 또는 주문 트랜잭션 되돌림 | `PAID`, v4 | 없음 | 없음 | 명령 재시도, 완료 event를 만들지 않음 |
| 주문 UPDATE 뒤 outbox INSERT 전 프로세스 종료 | 확정되지 않음 | 확정되지 않음 | 없음 | 같은 트랜잭션이라 두 변경 모두 되돌림 |
| 주문과 outbox 확정 직후 Relay가 꺼짐 | `DONE`, v5 | `PENDING`, lease=NULL | 없음 | Relay 재기동 후 `next_attempt_at`으로 전달 |
| Relay claim 뒤 브로커 연결 timeout | `DONE`, v5 | `CLAIMED`, generation 7 | 수락 여부 불명 | `ACK_UNKNOWN`, lease 만료 또는 조건부 재시도 |
| 브로커 ACK 확인 뒤 `SENT` 표시 전 Relay 종료 | `DONE`, v5 | `CLAIMED` 또는 재시도 대상 | event가 이미 한 번 있을 수 있음 | 재발행, consumer가 ID로 중복 방어 |
| lease 만료 뒤 옛 Relay가 늦게 `SENT` 기록 | `DONE`, v5 | 새 generation 소유 | 이미 발행됐을 수 있음 | generation 조건이 옛 표시를 0행으로 거절 |
| 영구 발행 오류로 격리 | `DONE`, v5 | `QUARANTINED` | 전달 안 됐거나 확인 불가 | 경보와 원인 수정 뒤 명시적으로 재처리 |
| `SENT` 표시를 먼저 하고 publish 실패 | `DONE`, v5 | `SENT`로 잘못 표시 | 없음 | 유실. 이 순서를 구현에서 금지 |

표의 브로커 전달 이후 행들은 Outbox가 자동으로 해결하지 않는 부분을 보여 줍니다. generation 조건은 로컬 outbox 상태를 옛 Relay가 덮어쓰지 못하게 할 뿐, 이미 브로커에 전달된 중복을 되돌리지는 못합니다. 따라서 Relay 중복은 정상 복구 경로로 취급하고, event ID의 보관 기간과 consumer의 중복 처리 계약을 함께 정해야 합니다.

## 보관과 적체의 경계

Relay가 복구되지 않거나 브로커가 오래 장애를 일으키면 `PENDING` 행이 주문 DB의 디스크와 인덱스를 차지합니다. 그래서 `created_at` 기준 가장 오래된 미전달 event의 나이, 미전달 개수, 재시도 횟수, DB 여유 공간을 관찰해야 합니다. 보낸 행을 바로 삭제하면 재생과 장애 조사가 어려워질 수 있으므로, consumer 재생 기간과 감사 요구를 먼저 정하고 보관·삭제합니다.

Outbox가 있다고 해서 모든 확정이 영원히 전달되는 것은 아닙니다. 주문 DB의 내구성, outbox 행의 보존, Relay의 재기동, 브로커의 ACK 확인이 모두 이어져야 합니다. 반대로 브로커의 exactly-once 기능이 있어도 애플리케이션의 `SENT` 표시와 완전히 같은 원자 경계가 된다고 가정하지 않는 편이 안전합니다.

### Polling과 CDC는 전달 위치와 운영 비용이 다릅니다

위 Relay는 outbox의 due 행을 polling합니다. 적절한 status·next_attempt_at 인덱스, 제한된 batch, 빈 polling 주기, claim 세대가 필요합니다. 구성은 직접적이지만 테이블 조회·상태 갱신·잠금·정리 비용을 냅니다. 여러 Relay가 aggregate의 이벤트를 다른 속도로 보내면 created_at 정렬만으로 키별 최종 적용 순서가 보장되지는 않습니다.

CDC는 커밋된 outbox 삽입을 DB 변경 로그에서 읽어 broker로 전달할 수 있습니다. 미전달 행을 계속 검색하는 비용을 줄일 수 있지만 connector의 로그 위치·초기 snapshot·스키마 변화·WAL 보존·재시작 상태를 관리해야 합니다. sink 기록과 connector offset의 확정 경계에 따라 재전달이 생길 수 있으며 특정 connector의 exactly-once 범위를 외부 소비자 DB 효과까지 확대하지 않습니다.

두 방식 모두 당시 payload와 안정 event ID·aggregate version을 유지합니다. DB commit과 발행 위치, broker 수락과 consumer 적용을 하나의 완료 상태로 뭉뚱그리지 않습니다. polling의 ACK 뒤 표시 전 중단과 CDC의 sink 수락 뒤 offset 저장 전 중단을 각각 시험하고, 중복 소비의 원장 경계를 유지합니다. CDC 중단으로 원본 로그가 쌓이면 공간·재개 가능 위치·최대 보존 기간을 확인합니다. 로그를 잃은 connector는 새 snapshot과 증분 연결이 필요할 수 있습니다.

선택은 평균 발행 지연·DB 읽기·운영 connector·복구 위치·스키마 대응 비용을 같은 workload에서 비교합니다. 이 노트는 polling·CDC의 설계 설명이며 실제 connector와 broker를 실행한 결과는 아닙니다.

## 직접 확인할 입력과 예상 결과

1. `o-17`을 `PAID`, v4로 두고 완료 명령을 한 번 실행하면 DB가 반환한 v5와 그 행의 금액으로 만든 `evt-5/PENDING`이 주문과 같은 확정에 생겨야 합니다.
2. DB 확정 직후 Relay를 중단하면 주문은 그대로 `DONE`이고 `lease_until=NULL`인 outbox 행은 남아, 재기동 후 `PENDING` due 조건으로 event가 전달되어야 합니다.
3. 브로커가 `ACK_CONFIRMED`를 반환한 직후 `SENT` 갱신 전에 Relay를 중단하면 같은 `event_id`가 다시 발행될 수 있지만, outbox가 먼저 `SENT`가 되어 event가 사라지면 안 됩니다.
4. 브로커 연결 timeout을 `ACK_UNKNOWN`으로 주입하면 Relay가 성공으로 표시하지 않고 lease 만료 또는 조건부 재시도 경로로 남겨야 합니다.
5. 두 완료 명령을 같은 주문·같은 버전으로 동시에 넣으면 하나의 UPDATE만 새 `transition`을 반환하고 완료 event도 하나만 만들어져야 합니다. 다른 요청에서 현재 행이 `DONE`이면 새 event 없이 이미 완료된 결과로 끝나야 합니다.
6. 완료 확정 뒤 주문을 취소한 다음 Relay를 실행해도 `evt-5` payload는 최신 취소 상태가 아니라 DB가 완료 전이에서 반환한 저장 본문이어야 합니다.
7. lease를 인계받은 새 Relay가 `generation=8`을 사용한 뒤 옛 `generation=7`의 늦은 `SENT` 표시를 넣으면, 조건부 UPDATE가 0행이어야 합니다.
8. 재시도 표시가 `PENDING`으로 바뀔 때 `lease_owner`와 `lease_until`이 NULL인지 확인하고, `next_attempt_at`이 지난 뒤 다시 claim되는지 확인해야 합니다.

이 확인은 “event가 언젠가 나갔다”만 보지 않습니다. DB가 확정한 전이 결과를 event에 사용했는지, 주문과 outbox가 함께 확정되는지, 초기 `PENDING`이 실제로 선택되는지, ACK 불명확성과 Relay 재시도를 어떻게 다루는지, 옛 소유자의 늦은 쓰기를 거절하는지를 각각 확인해야 Transactional Outbox의 실제 보장 범위를 정확히 설명할 수 있습니다.

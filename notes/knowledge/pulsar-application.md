---
id: pulsar-application
title: Pulsar 전달·재처리 구현
topic: 분산 시스템
summary: Pulsar의 producer·consumer 완료 경계와 ACK·재전달·retry topic·DLQ를 외부 효과의 멱등 처리와 복구 순서로 연결합니다.
questionIds: []
prerequisites: [pulsar-foundations, idempotency]
related: [broker-redelivery, idempotency, transactional-outbox, kafka-consumer-offset, kafka-partition-order]
reviewedAt: '2026-09-17'
---

# Pulsar 전달·재처리 구현

## 전달 계약과 완료 사건

Pulsar 애플리케이션에서 가장 위험한 오해는 `send`나 `ack`를 업무 완료로 읽는 것입니다. producer의 비동기 send는 local queue에 넣은 뒤 즉시 반환할 수 있고, 동기 send는 broker confirmation을 기다립니다. 어느 쪽도 consumer가 주문 DB를 commit했다는 뜻은 아닙니다.

consumer 쪽에서도 메시지를 받았다는 사건, 외부 효과가 끝났다는 사건, broker에 ACK를 보냈다는 사건을 분리해야 합니다. 여기서 **멱등성**은 같은 논리 요청을 여러 번 실행해도 최종 업무 효과가 한 번 실행된 것과 같도록 만드는 성질입니다. 구현은 전달 시도 횟수를 1로 만드는 것이 아니라, 반복 시도에도 효과 수를 통제하는 방향으로 설계합니다.

재전달은 at-least-once 전달에서 예상할 수 있는 경로입니다. 처리 후 ACK 전에 worker가 죽으면 broker는 아직 확인되지 않은 메시지를 다시 전달할 수 있습니다. 그러므로 재전달 자체를 장애의 증거로 단정하지 말고, 같은 `eventId`가 몇 번 전달되었고 몇 번 실제 효과를 만들었는지를 분리해 기록합니다.

## Producer 전송의 두 경계

비동기 producer API는 호출이 성공적으로 반환되었다는 이유만으로 원격 broker 기록을 확인했다고 말할 수 없습니다. local queue가 가득 차면 설정에 따라 호출이 block되거나 실패할 수 있습니다. 애플리케이션은 호출 반환값과 비동기 결과 future를 각각 어떤 상태로 해석할지 정해야 합니다.

동기 send는 broker confirmation을 기다리는 쪽으로 설명할 수 있지만, 응답 유실은 여전히 가능합니다. timeout 뒤 같은 event를 재시도하면 첫 요청이 broker에 기록됐을 수도 있으므로 논리 `eventId`를 유지해야 합니다. broker publication deduplication을 외부 DB inbox나 결제 provider의 멱등 키를 대신하는 장치로 취급하지 않습니다.

| 사건 | producer가 아는 것 | 아직 모르는 것 |
|---|---|---|
| local enqueue | client가 전송 작업을 보관 | broker 기록 여부 |
| broker confirmation | broker 경로의 저장 확인 범위 | consumer ACK·외부 효과 |
| send timeout | 응답을 제때 받지 못함 | 기록 유무가 불확실 |
| consumer effect commit | producer에는 자동 전달되지 않음 | 별도 결과 조회 필요 |

이 표의 목적은 API 호출을 느리게 만드는 것이 아니라 재시도 결정을 정확하게 만드는 것입니다. timeout은 “절대 저장되지 않았다”가 아니라 “관찰한 응답이 없다”일 수 있습니다. 재시도 정책은 이 불확정 상태를 중복 event ID로 다룰 수 있어야 합니다.

## Subscription과 작업 분배

subscription name은 consumer의 진행 상태와 전달 소유권을 결정합니다. `orders`의 모든 이벤트를 analytics와 notifications가 각각 받아야 한다면 `analytics-sub`과 `notifications-sub`으로 나눕니다. 같은 이름을 쓰면 한 subscription 안의 consumer들이 메시지를 분배하므로 각 목적지가 전체 이벤트를 받는 fan-out이 되지 않습니다.

같은 subscription 안에서 선택할 수 있는 전달 방식은 네 가지입니다.

| 모드 | 기본 전달 모양 | 설계 의미 |
|---|---|---|
| Exclusive | 한 consumer | 단일 활성 처리자 |
| Failover | 활성 1개와 대기자 | 장애 시 대체 |
| Shared | 여러 consumer에 분배 | 전체 순서 없음 |
| Key_Shared | key별 consumer 분배 | 같은 key의 동시 처리 범위 제한 |

Shared를 쓰면 처리량을 늘릴 수 있지만 topic 전체 순서는 제공되지 않습니다. Key_Shared도 같은 key를 한 consumer가 동시에 처리하는 문서 범위와 membership·redelivery 조건 안에서만 읽어야 합니다. 외부 DB에 도착하는 효과 순서까지 자동으로 정렬해 주지는 않습니다.

업무 목적이 서로 다르면 먼저 subscription을 분리하고, 한 목적 안에서만 병렬 consumer 수와 mode를 선택합니다. subscription을 공유해 처리량을 얻는 결정은 “두 소비자가 같은 사건을 나눠 가져도 되는가”에 답한 뒤에 내려야 합니다.

## ACK와 Cursor 상태

individual ACK는 특정 메시지를 확인합니다. cumulative ACK는 선택한 메시지와 그 앞선 메시지를 함께 확인하는 방식이지만, 확인된 Pulsar 문서에서는 Shared와 Key_Shared에 cumulative acknowledgment를 사용할 수 없습니다. subscription mode를 바꿀 때 ACK 방식도 다시 검토해야 합니다.

ACK는 외부 효과와 같은 transaction에 자동 포함되지 않습니다. 다음은 중복을 허용하되 누락을 줄이는 일반적인 경계입니다.

```diagram
{"title":"외부 효과 뒤 ACK의 재전달 경계","caption":"DB 효과와 broker ACK 사이의 종료 틈을 드러냅니다. ACK보다 먼저 효과를 확정하면 재전달은 중복이지만 누락보다 복구하기 쉽습니다.","rows":[[{"id":"receive","label":"메시지 수신","detail":["eventId 확보","attempt 관찰"]}],[{"id":"inbox","label":"Inbox unique 검사","detail":["ID·fingerprint 대조"]}],[{"id":"effect","label":"도메인 효과 commit","detail":["같은 DB transaction"]}],[{"id":"ack","label":"Individual ACK","detail":["broker 확인 위치 전진"]}],[{"id":"redeliver","label":"재전달 또는 완료","detail":["ACK 전 종료 시 재전달"]}]],"edges":[{"from":"receive","to":"inbox","label":"논리 ID로 시작"},{"from":"inbox","to":"effect","label":"새 ID만 적용"},{"from":"effect","to":"ack","label":"commit 이후"},{"from":"ack","to":"redeliver","label":"응답 성공 또는 재전달"}]}
```

DB commit 뒤 ACK 직전에 프로세스가 종료되면 E1이 다시 옵니다. inbox의 unique key가 이미 처리한 `eventId`를 찾으면 domain mutation을 반복하지 않고 저장된 결과를 확인한 뒤 ACK할 수 있습니다. 같은 ID인데 fingerprint가 다르면 정상 중복이 아니라 충돌이므로 격리합니다.

반대로 ACK를 먼저 보내고 DB를 바꾸면, ACK 직후 worker가 죽을 때 broker는 성공으로 알고 메시지를 다시 보내지 않을 수 있습니다. 그 경우 외부 효과가 영구히 빠집니다. 따라서 “중복을 흡수할 수 있는가”를 확인한 뒤 효과 후 ACK 순서를 선택합니다.

## 재연결과 처리 수명

Pulsar client는 연결이 끊겼을 때 exponential backoff로 재연결할 수 있습니다. 이 backoff는 연결 복구 정책이지 이미 실행 중인 DB나 HTTP 작업이 완료됐다는 신호가 아닙니다. consumer close나 reconnect가 worker의 외부 호출을 자동으로 취소한다고 가정하지 않습니다.

공식 client 문서에는 기존 subscription에 consumer가 합류하면 가장 이른 미확인 메시지에서 시작하고, 새 subscription은 topic 끝에서 시작하는 기본 동작이 설명됩니다. 이를 모든 reconnect 경로의 절대 규칙으로 확대하지 말고, 재연결·subscription 재생성·명시적 시작 위치를 서로 다른 상태로 기록합니다.

worker가 오래 걸릴수록 ACK timeout이나 수동 negative ACK와 경합할 수 있습니다. timeout은 메시지 전달 상태를 다시 판단하는 기준이지 실행 중인 작업을 중단하는 타이머가 아닙니다. A가 DB 작업 중일 때 B가 같은 메시지를 받아 동시에 실행할 수 있으므로 event ID와 DB 조건부 갱신이 필요합니다.

## Retry Topic과 재시도 횟수

일반 negative ACK만 반복하면 재시도 횟수가 내구성 있게 보존되지 않을 수 있습니다. 확인한 Pulsar messaging 문서는 reliable retry counting과 최종 DLQ routing을 위해 retry-topic 경로에서 `reconsumeLater`와 `enableRetry(true)`를 사용하는 계약을 설명하며 `maxRedeliverCount` 설정을 명시합니다. 이 이름은 JetStream의 `MaxDeliver`를 Pulsar에 옮겨 부른 것이 아닙니다.

이것은 모든 client 언어의 호출 서명을 이 글에서 확정한다는 뜻이 아닙니다. 실제 builder, listener, timeout, close API는 사용하려는 client 버전을 고정한 뒤 공식 client 문서와 함께 컴파일 검증해야 합니다. retry count가 증가해도 business effect가 한 번만 실행된다는 뜻은 아니므로, attempt와 effect count를 별도 필드로 기록합니다.

| 입력 상태 | broker 경로 | 업무 설계 해석 |
|---|---|---|
| 처리 전 실패 | negative ACK 또는 재시도 | 효과 없음인지 확인 |
| 효과 후 ACK 전 종료 | 일반 재전달 가능 | inbox로 중복 흡수 |
| retry topic 경로 | 시도 횟수 보존 경로 | 원인과 attempt 기록 |
| `maxRedeliverCount` 도달 | DLQ 격리 경로 | 폐기가 아닌 복구 대기 |

`reconsumeLater`의 delay와 max count를 업무 SLA보다 길게 설정하면 사용자 결과가 늦어질 수 있습니다. 반대로 너무 짧게 설정하면 같은 장애에 재시도가 몰립니다. retry age, queue age, downstream recovery time을 함께 보고 수치를 정합니다.

## DLQ 격리와 복구 순서

DLQ(정상 소비 흐름에서 격리하는 보류 큐)는 “처리가 끝났다”가 아니라 “자동 흐름에서 분리했다”는 상태입니다. schema를 읽지 못하는 오류, 참조 데이터 누락, 하위 시스템의 일시 장애, 코드 결함을 먼저 나누고, 고칠 수 있는 원인만 retry 또는 redrive 대상으로 삼습니다.

확인한 문서 범위에서는 DLQ subscription이 미리 존재하지 않으면 DLQ 메시지가 보존되지 않을 수 있다는 조건이 있습니다. Shared나 Key_Shared에서 DLQ 적용 범위와 subscription precondition을 배포 전에 확인해야 합니다. 이 글은 client별 모든 조합을 실행해 확정한 것이 아닙니다.

DLQ envelope에는 적어도 `originalEventId`, 원본 payload version, fingerprint, 원래 topic·subscription, 첫 수신 시각, 마지막 오류, attempt, schema 정보, 담당자와 복구 기한을 남깁니다. 원본 ID가 바뀌면 redrive가 새 업무 사건처럼 보여 중복 대사를 어렵게 합니다.

원인을 수정하지 않고 전체 DLQ를 redrive하면 실패와 중복이 동시에 늘어납니다. 먼저 10건 같은 작은 batch에서 schema 해석, 권한, 기대 effect, duplicate count를 확인한 뒤 rate limit을 두고 규모를 늘립니다. 원래 ID와 처리 결과를 유지해야 다시 멈췄을 때 어디까지 복구했는지 알 수 있습니다.

## 멱등 DB 효과와 외부 API

DB 안에서 inbox unique 삽입, domain mutation, 결과 저장을 하나의 transaction으로 묶으면 재전달에 따른 DB 중복 효과를 줄일 수 있습니다. 이미 같은 event ID가 있으면 원래 fingerprint와 현재 payload를 비교하고, 동일하면 저장된 처리 결과를 반환합니다.

이 경계는 같은 DB에 한정됩니다. 결제나 외부 HTTP 호출은 provider가 제공하는 idempotency key, 상태 조회, 보상 절차가 별도로 필요합니다. Pulsar producer deduplication이나 retry-topic count가 임의 외부 side effect의 exactly-once를 만들어 주지 않습니다.

```pseudocode
NOTE: 설명용 의사코드. 특정 언어 client의 실제 메서드 서명은 고정 버전에서 확인합니다.
process(message):
    try:
        db.transaction:
            prior = inbox.find(message.eventId)
            if prior is absent:
                inbox.insert(message.eventId, message.fingerprint, status="processing")
                result = apply_domain_change(message)  # 같은 DB transaction
                inbox.mark_done(message.eventId, result)
            else if prior.fingerprint == message.fingerprint and prior.status == "done":
                result = prior.result                 # 재전달 효과 없음
            else:
                raise DuplicatePayloadConflict
        consumer.ack(message)                         # commit 뒤 ACK
    catch transientError:
        schedule_retry_or_nack(message)
    catch permanentError:
        publish_to_retry_or_dlq(message)
```

동시 중복 worker 둘이 모두 `find`를 통과하지 않게 inbox에 unique constraint를 둡니다. 충돌한 transaction은 이미 확정된 결과를 다시 조회한 뒤 효과 없이 ACK할 수 있습니다. `processing` 상태가 오래 남으면 worker가 죽은 것으로 판단해 재시도하되, lease를 회수하는 규칙과 소유 generation을 별도로 설계합니다.

## 구현 흐름과 관측 항목

한 worker의 실무 흐름은 receive에서 event ID와 delivery attempt를 로그에 남기고 payload fingerprint를 계산하는 것으로 시작합니다. DB transaction 안에서 중복 여부와 domain effect를 확정한 뒤 ACK를 보냅니다. ACK 실패는 effect 실패가 아니며 재전달을 허용합니다.

관측값을 하나의 “처리량”으로 합치지 않습니다.

| 지표 | 의미 | 진단 예 |
|---|---|---|
| delivery attempts | broker가 전달한 횟수 | timeout·nack 경합 |
| effect count | 논리 event가 남긴 효과 수 | 중복 방지 실패 |
| retry age | retry topic 체류 시간 | downstream 장애 |
| DLQ age/count | 자동 흐름 밖의 잔량 | 복구 미착수 |
| ACK latency | 효과 commit 후 ACK까지 | client·연결 지연 |
| unresolved user impact | 아직 끝나지 않은 업무 | 단순 queue depth보다 중요 |

worker를 재시작할 때는 in-flight 작업이 외부에 남았는지 확인합니다. 종료 신호는 새 메시지 수신을 멈추고, 현재 transaction이 끝날 시간을 주며, 남은 메시지는 ACK하지 않은 상태로 두는 순서가 안전합니다. 이 절차도 process kill이나 외부 provider 호출을 소급 취소하지는 않습니다.

## 실패 입력과 복구 판정

E42를 worker A가 받아 DB commit한 뒤 ACK 직전에 중단한다고 하겠습니다. A의 처리 로그에는 `effect=1, ack=unknown`이 남고, broker에서는 E42가 pending으로 남거나 재전달됩니다. worker B가 같은 ID를 받으면 inbox unique 충돌 또는 기존 완료 조회가 발생하고 domain effect는 1로 유지되어야 합니다.

이어서 schema 오류를 가진 E43이 retry topic에서 `attempt=1..N`으로 이동하고 max count에 도달했다고 하겠습니다. DLQ에는 원본 ID와 오류가 남고 정상 subscription에서는 해당 메시지가 자동 흐름에서 빠집니다. schema를 고친 뒤 10건을 redrive했을 때 `delivery attempts >= 10`, `effect count = 고유 event 수`, `DLQ unresolved 감소`를 확인 기준으로 삼습니다. 이 값은 실행 결과가 아니라 검증할 기준입니다.

다음 시험은 서로 섞지 않고 각각 기록합니다. ACK timeout 직전의 긴 DB 처리, negative ACK, retry topic count, DLQ subscription 미생성, redrive 중단, worker 재시작을 독립 입력으로 둡니다. 실제 server·client 조합과 API 서명을 고정하기 전에는 표의 결과를 실행했다고 말하지 않습니다.

## 운영 경계와 적용 순서

애플리케이션 설정은 delivery mode 하나만으로 결정하지 않습니다. 먼저 메시지의 논리 ID와 payload fingerprint를 정하고, 같은 subscription을 공유해도 되는 업무인지 확인합니다. 그 다음 DB effect와 inbox를 같은 transaction에 넣을 수 있는지, 외부 API가 idempotency key를 지원하는지, 실패 시 retry topic과 DLQ를 누가 소유하는지 적습니다.

이 순서를 지키면 “재전달을 없애자”라는 불가능한 목표 대신 “재전달이 와도 효과 수를 통제하자”라는 검증 가능한 목표를 세울 수 있습니다. 정상 입력, 중복 입력, 같은 ID의 다른 payload, ACK 전 종료, 원인 수정 뒤 redrive를 각각 독립적으로 재생하고 logical event ID와 user impact를 대조합니다.

## 참고 자료와 검증 범위

- [Pulsar Messaging](https://pulsar.apache.org/docs/5.0.x/concepts-messaging/): 확인일 2026-09-17, 5.0.x 문서 branch. subscription mode, durable cursor, individual/cumulative ACK, redelivery, retry topic, `maxRedeliverCount`, DLQ와 at-least-once 경계의 근거입니다.
- [Pulsar Clients](https://pulsar.apache.org/docs/5.0.x/concepts-clients/): 확인일 2026-09-17, 5.0.x 문서. asynchronous/synchronous send, local queue, reconnect backoff, subscription 시작 위치, client transaction 범위의 근거입니다.
- [Pulsar Overview](https://pulsar.apache.org/docs/5.0.x/concepts-overview/): 확인일 2026-09-17, 5.0.x 문서. persistent message storage와 guaranteed message delivery 표현의 범위를 확인했습니다.
- [Apache Pulsar Downloads](https://pulsar.apache.org/download/): 확인일 2026-09-17, checked snapshot에서 current stable은 4.2.4이며 5.0.0-M2는 production용이 아닌 milestone입니다. 본문은 설치 버전을 특정하지 않습니다.
- 실제 Pulsar client 호출, retry/DLQ 재전달, max count, DB 효과 시험은 실행하지 않았습니다. 의사코드와 상태값은 구현 시 검증할 문서 기반 계약입니다.

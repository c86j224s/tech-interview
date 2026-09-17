---
id: kafka-application
title: Kafka 생산자·소비자 구현
topic: 분산 시스템
summary: Java client의 생산·소비·commit·transaction 경계를 실제 API 계약과 실패 순서로 연결하고, 외부 효과의 중복과 누락을 별도로 다룹니다.
questionIds: []
prerequisites: [kafka-foundations, idempotency]
related: [kafka-partition-order, kafka-consumer-offset, kafka-transaction-scope, transactional-outbox]
reviewedAt: '2026-09-17'
---

# Kafka 생산자·소비자 구현

## 구현 목표와 계약

Kafka 구현은 `send()`와 `poll()`을 호출하는 것으로 끝나지 않습니다. 어떤 논리 사건을 발행하는지, key bytes가 어느 partition으로 가는지, 성공 응답을 어느 경계에서 믿는지, 외부 효과를 언제 완료로 표시하는지부터 정해야 합니다. 이 순서가 없으면 재시도와 장애가 정상 흐름을 훼손합니다.

이 장의 예제 사건은 `eventId=evt-41`, `key=acct-7`, `entitySequence=42`, `amount=-10`입니다. eventId는 같은 논리 사건의 재전송을 찾는 식별자이고 entitySequence는 계정 상태 전이 순서를 검증하는 업무 번호입니다. 둘 다 Kafka offset과 다른 값입니다.

본문의 API 설명은 2026-09-17에 확인한 Kafka client API 4.3.1 Javadoc과 Kafka 4.3.X 설정 문서를 기준으로 합니다. Java code block은 컴파일한 완제품이 아니라 소유권, 수명, 오류 경계를 보여 주는 축약 예제입니다. 이 작업에서 Kafka cluster나 Java compiler를 실행하지 않았으므로 실행 결과로 읽어서는 안 됩니다.

## 생산 레코드와 key 직렬화

producer가 partition을 명시하지 않으면 partitioner가 record의 목적지를 선택합니다. Kafka 4.3.X producer 설정 문서의 기본 동작은 key가 있으면 key hash를 사용하고, key와 partition이 모두 없으면 sticky partition을 선택하는 방식입니다. 같은 문자열을 만들었다는 사실만으로 다국어 producer의 key bytes가 같다고 보장할 수 없습니다.

팀 간 계약에는 문자열 인코딩, Unicode 정규화, 빈 문자열과 null의 의미, partition 수, 사용자 정의 partitioner 여부를 기록합니다. Java와 Python이 모두 `acct-7`을 UTF-8로 보내면 key bytes는 같을 수 있지만, 공백 제거 또는 정규화 규칙이 다르면 목적지가 달라질 수 있습니다. 파티션 수를 바꾸면 key hash 기반 목적지도 달라질 수 있습니다.

record에는 논리 eventId, 업무 key, schema version, entitySequence, 생성 시각과 필요한 trace header를 둡니다. schema version은 payload 해석 규칙이고 offset은 broker 로그 위치입니다. 개인정보와 비밀을 key나 header에 넣지 않는 정책도 이 계약과 분리해 명시합니다.

```diagram
{"title":"생산자 계약의 분리된 경계","caption":"논리 사건, key bytes, partition 선택, broker 결과를 각각 관찰합니다. metadata offset은 논리 중복을 판정하는 eventId가 아닙니다.","rows":[[{"id":"intent","label":"논리 이벤트","detail":["eventId=evt-41","key=acct-7","sequence=42"]}],[{"id":"serialize","label":"직렬화·header","detail":["schema version","key bytes"]}],[{"id":"route","label":"Partitioner","detail":["현재 partition 수","목적지 계산"]}],[{"id":"broker","label":"Broker partition","detail":["append·복제"]}],[{"id":"result","label":"Producer 결과","detail":["metadata 또는 예외","논리 중복과 별도"]}]],"edges":[{"from":"intent","to":"serialize","label":"record 구성"},{"from":"serialize","to":"route","label":"bytes 전달"},{"from":"route","to":"broker","label":"send"},{"from":"broker","to":"result","label":"ACK 또는 오류"}]}
```

## 비동기 send와 결과 처리

`KafkaProducer.send(record)`는 broker ACK를 기다리지 않고 buffer에 넣은 뒤 반환할 수 있습니다. 반환된 `Future<RecordMetadata>`는 전송 완료를 관찰하는 수단입니다. `.get()`을 호출하면 성공 metadata나 예외가 나올 때까지 기다리므로 모든 send를 즉시 기다리면 batch 처리 이점이 줄어듭니다.

send 호출 자체에서 serialization 오류나 buffer 대기 timeout 같은 직접 오류가 나올 수 있고, broker 응답 오류는 callback이나 Future에서 나중에 나타날 수 있습니다. callback은 producer I/O thread에서 실행될 수 있으므로 DB 작업이나 오래 걸리는 재시도를 callback 안에 넣지 않고 내부 결과 큐로 넘깁니다.

```java
// 축약 예제: callback은 결과만 bounded 큐에 전달합니다.
ProducerRecord<String, byte[]> record =
    new ProducerRecord<>("account-events", "acct-7", payload);
record.headers().add("event-id", eventId.getBytes(StandardCharsets.UTF_8));
try {
    producer.send(record, (metadata, error) -> {
        SendResult result = error == null
            ? SendResult.succeeded(eventId, metadata.topic(),
                                  metadata.partition(), metadata.offset())
            : SendResult.failed(eventId, error);
        if (!resultQueue.offer(result)) {
            // 결과를 잃지 않도록 명시적인 정지·보존 경로를 둡니다.
            signalResultBackpressure();
        }
    });
} catch (KafkaException e) {
    if (e instanceof InterruptException) Thread.currentThread().interrupt();
    resultQueue.offer(SendResult.failed(eventId, e));
}
```

위 코드는 `Producer`, `payload`, `eventId`, `SendResult`와 결과 큐의 수명을 생략한 축약 예제입니다. 실제 구현에서는 callback이 bounded 큐에 실패했을 때 in-memory 결과를 버리지 않도록 producer를 멈추거나 durable retry 기록으로 넘겨야 합니다. producer의 성공 metadata를 받았다는 것은 Kafka 전송 결과를 확인했다는 뜻이지 eventId가 중복 제거되었다는 뜻은 아닙니다.

`flush()`는 앞선 send들이 성공하거나 오류로 끝나는 것을 기다리는 동작이지 모두 성공했다는 증명이 아닙니다. `close()`는 자원과 background thread를 해제하고, 제한 시간을 둔 `close(Duration)`는 시간이 지나면 outstanding send가 실패할 수 있습니다. 종료 보고에는 성공 수와 실패·불확정 수를 별도로 남깁니다.

## 재시도와 멱등 생산

idempotence는 같은 producer session에서 broker ACK 유실이나 retry로 생기는 재전송을 PID, epoch, partition별 sequence로 식별하는 Kafka 내부 계약입니다. 애플리케이션이 재시작 뒤 같은 업무를 새 producer로 발행하거나 사용자가 같은 결제를 다시 제출한 경우까지 Kafka가 eventId로 동일시하지는 않습니다.

Kafka 4.3.X producer 설정 문서에서 확인한 호환 조건은 `acks=all`, `retries>0`, `max.in.flight.requests.per.connection<=5`입니다. 이 조건을 다른 언어 client나 다른 broker/client 조합에 숫자만 복사하지 말고 적용 client의 문서와 시작 시 설정을 고정합니다. 명시적 idempotence와 충돌하는 설정은 `ConfigException`을 일으킬 수 있습니다.

재시도 분류는 일시 오류, timeout처럼 결과가 불확정인 오류, 권한·직렬화·fencing처럼 즉시 중단해야 하는 오류로 나눕니다. timeout을 실패 확정으로 기록하면 broker에 이미 들어간 record를 새 event로 다시 만들어 중복을 키울 수 있습니다. eventId와 payload hash를 보존해 원본 결과를 대조하고, 애플리케이션 논리 중복은 별도의 멱등성 저장소로 막습니다.

## 소비자 소유 thread와 poll

`KafkaConsumer`는 thread-safe하지 않습니다. poll, commit, pause, resume, assignment 상태를 한 소유 thread에서 다루고 worker thread는 consumer를 직접 호출하지 않은 채 결과만 내부 thread-safe queue로 돌려보냅니다. 종료를 위해 다른 thread가 `wakeup()`을 호출하는 문서상 경계는 일반 method를 여러 thread에서 호출하는 것과 구분합니다.

`poll()`이 offset 10, 11, 12를 반환하면 client position은 다음 fetch 위치인 13으로 전진할 수 있습니다. DB와 HTTP 효과가 끝났다는 뜻은 아닙니다. 처리 뒤 13을 commit하려면 세 record의 필요한 효과가 모두 완료되고, 그 partition을 여전히 소유하고 있어야 합니다.

자동 commit은 client가 애플리케이션 처리 완료를 판단해 주는 기능이 아닙니다. 외부 효과를 먼저 실행하고 다음 offset을 명시적으로 commit하면 commit 응답 유실 뒤 중복 처리가 생길 수 있으므로 eventId inbox나 외부 API idempotency key를 둡니다. offset을 먼저 commit하면 프로세스 종료 시 외부 효과가 영구히 누락될 수 있습니다.

```java
// 축약 의사코드에 가까운 예제: consumer 호출은 소유 thread에서만 합니다.
while (!closing) {
    try {
        ConsumerRecords<String, byte[]> records = consumer.poll(Duration.ofMillis(100));
        // poll로 이미 받은 전체 batch를 먼저 보관·등록합니다.
        // max.poll.records뿐 아니라 fetch 크기와 큰 record용 여유도 예산에 포함합니다.
        pendingByPartition.addAllAndRegister(records, assignmentGeneration, delivered);
        // 큐가 찬 partition은 pause하고, 미제출 항목은 다음 반복까지 보존합니다.
        dispatchPendingWithinBudget(consumer, workerQueue, pendingByPartition);
        for (WorkResult result : completionQueue.drain()) {
            delivered.markCompleteIfCurrent(result);
        }
        Map<TopicPartition, OffsetAndMetadata> ready =
            delivered.contiguousNextOffsets();
        if (!ready.isEmpty()) consumer.commitSync(ready);
    } catch (WakeupException e) {
        if (!closing) throw e;
    } catch (CommitFailedException e) {
        // 소유권을 잃었을 수 있으므로 candidate를 성공 checkpoint로 기록하지 않습니다.
        retainForRedeliveryAndDedup(e);
    }
}
```

이 코드는 의사코드에 가까운 축약 예제이며 `pendingByPartition`의 본문 보관, 완료 큐의 오류 처리, pause 후 resume 조건, commit timeout과 ownership failure 분류를 생략했습니다. 특히 poll이 반환한 전체 batch를 먼저 등록·보관해야 합니다. 중간 항목의 큐 제출이 실패했다고 반복문을 빠져나와 나머지 batch를 버리면 안 됩니다. 그렇지 않으면 뒤 record가 먼저 끝날 때 앞 record를 건너뛸 수 있습니다.

## 병렬 처리와 연속 완료

P0에서 10·11·12를 poll한 뒤 worker가 11과 12만 성공했다고 하겠습니다. position은 13일 수 있지만 안전한 다음 commit은 10입니다. 10이 끝나지 않았으므로 13을 저장하면 10을 건너뜁니다. 완료된 offset 중 최댓값을 commit하는 방식은 이 상태에서 안전하지 않습니다.

실제 전달 순서 목록을 `10,11,12`로 보관하고 완료 집합에 11과 12를 넣으면 watermark는 10에 멈춥니다. 10이 성공하면 앞에서부터 연속된 10·11·12를 제거하고 next commit을 13으로 올립니다. 존재하지 않는 offset gap을 임의로 완료 집합에 넣지는 않습니다.

watermark는 commit 누락을 막는 경계일 뿐 외부 효과 순서를 되돌리지 않습니다. 10이 잔액 차감이고 11이 환불이면 worker가 11을 먼저 DB에 적용할 수 있습니다. 같은 key 작업을 직렬화하거나 저장소 transaction에서 `expectedSequence`를 검사해 순서가 맞지 않는 작업을 보류해야 합니다.

## Transaction과 read_committed

Kafka transaction은 여러 Kafka partition으로 보내는 출력 record와 consumer group의 다음 offset을 Kafka 내부에서 하나의 commit 또는 abort 경계로 묶을 수 있습니다. `transactional.id`는 이전 producer를 fencing할 수 있으므로 동시에 실행될 독립 producer가 같은 ID를 공유하지 않게 합니다.

Java API의 개념적 순서는 `initTransactions()` 후 `beginTransaction()`, record send, 필요하면 `sendOffsetsToTransaction()`으로 처리 후 다음 offset과 group metadata를 연결하고, `commitTransaction()` 또는 `abortTransaction()`을 호출하는 흐름입니다. 자동 offset commit과 별도 수동 commit을 transaction offset과 섞지 않습니다. 이 paragraph는 API 순서를 설명하며 실제 실행 검증 결과가 아닙니다.

`read_committed` consumer는 abort된 transactional output을 애플리케이션 record로 넘기지 않습니다. 앞쪽에 열린 transaction이 남아 있으면 LSO(last stable offset)가 확정 경계를 넘지 않아 뒤 record 전달이 지연될 수 있습니다. high watermark, LSO, position, committed offset을 하나의 숫자로 기록하지 않습니다.

`ProducerFencedException`, `OutOfOrderSequenceException`, `UnsupportedVersionException`, `AuthorizationException` 같은 치명적 오류를 abort retry로 회복한다고 가정하지 않습니다. producer를 닫는 경계를 두고, commit이나 abort timeout이 불확정일 때는 임의의 다른 operation으로 바꾸지 말고 적용 API의 재시도·종료 계약을 확인합니다.

## 외부 DB 효과의 원자성

Kafka transaction은 외부 DB transaction에 자동으로 참여하지 않습니다. DB를 먼저 commit한 뒤 Kafka offset이나 output을 commit하기 전에 프로세스가 죽으면 DB 효과는 남고 input은 다시 전달됩니다. 반대로 Kafka 쪽 commit 뒤 DB가 실패하면 offset이 전진한 채 외부 효과가 빠질 수 있습니다.

외부 DB가 권위 저장소라면 같은 DB transaction 안에 eventId inbox 기록, 업무 변경, 결과 outbox를 넣는 구조를 고려할 수 있습니다. 이후 outbox를 Kafka로 발행하는 과정도 중복될 수 있으므로 downstream consumer도 eventId나 업무 멱등성 key를 검사합니다. 결제처럼 Kafka 밖의 시스템에는 제공자가 보장하는 idempotency key와 결과 조회 계약이 필요합니다.

| 장애 지점 | Kafka 상태 | 외부 상태 | 재시작 책임 |
|---|---|---|---|
| broker ACK 전 timeout | record 존재 불확정 | 효과 없음 | eventId로 결과 대조 뒤 재시도 |
| DB commit 뒤 offset 전 종료 | offset 미전진 가능 | 효과 있음 | inbox 또는 effect key로 중복 흡수 |
| offset commit 뒤 DB 전 종료 | offset 전진 | 효과 없음 | 이미 commit했다면 별도 누락 복구 |
| transaction abort | output 가시성 없음 | 외부 DB 자동 rollback 아님 | 외부 효과와 Kafka 결과 대조 |
| transactional.id fencing | producer 소유권 상실 | 옛 외부 효과는 남을 수 있음 | fencing을 무한 네트워크 retry로 취급하지 않음 |

## 종료와 장애 시퀀스

정상 종료는 새 입력을 막고 worker에 투입한 작업을 제한된 시간 안에 끝내거나 재시작 가능한 상태로 남긴 뒤, partition별 연속 완료 위치를 commit하고 producer를 flush·close하는 순서로 설계합니다. 제한 시간에 queue가 남으면 “완료”가 아니라 checkpoint와 중단 원인을 기록합니다.

rebalance의 정상 revoke에서는 새 작업 투입을 멈추고 현재 owner인 동안 완료된 연속 구간만 commit할 수 있습니다. lost callback에서는 이미 다른 consumer가 partition을 맡았을 수 있으므로 마지막 commit 기회로 사용하지 않습니다. 늦은 worker 결과에는 assignment generation을 붙여 현재 소유자와 비교하고, 외부 저장소에는 eventId와 entity version 조건을 함께 둡니다.

운영 로그에는 eventId, topic, partition, offset, generation, producer result, inbox 결과, 외부 API idempotency key, committed offset을 각각 남깁니다. 그래야 record가 broker에 있었는지, group이 어디서 재개하는지, 외부 효과가 이미 실행됐는지를 서로 다른 질문으로 답할 수 있습니다.

## 구현 확인의 범위

단위 테스트에서는 key bytes와 partition 수를 고정한 golden vector, null·empty key, serialization 오류, contiguous watermark, 늦은 generation 결과, retry classifier를 검사합니다. 이 테스트는 broker를 실행하지 않아도 상태 계산의 경계를 확인할 수 있습니다.

통합 테스트에서는 producer ACK 응답 유실, consumer commit 실패, process restart, 정상 revoke, lost 뒤 늦은 worker 완료, transaction abort를 별도 입력으로 만듭니다. 각 시험에서 broker log, producer metadata, group committed, DB inbox와 업무 원장, 외부 API 효과를 분리 수집합니다.

이 작업에서는 Java 코드를 컴파일하거나 실제 producer·consumer·transaction을 실행하지 않았습니다. 따라서 code block과 표는 실행 증거가 아니라 API 계약과 예상 상태를 설명하는 초안입니다. 적용하는 client와 broker 버전, 설정 기본값, transaction timeout, group protocol 조합을 고정한 뒤 별도 시험으로 확인해야 합니다.

## 참고 자료와 검증 범위

- [Apache Kafka 4.3.1 KafkaProducer Javadoc](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/producer/KafkaProducer.html): 2026-09-17 확인. Kafka client API 4.3.1 문서. 비동기 `send`, Future·callback, flush·close, transaction API와 fencing 경계의 근거입니다.
- [Apache Kafka 4.3.1 KafkaConsumer Javadoc](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html): 2026-09-17 확인. Kafka client API 4.3.1 문서. position, committed offset, commit, thread safety의 근거입니다.
- [Apache Kafka 4.3.1 ConsumerRebalanceListener Javadoc](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/ConsumerRebalanceListener.html): 2026-09-17 확인. Kafka client API 4.3.1 문서. revoke, assigned, lost callback의 소유권 경계 근거입니다.
- [Apache Kafka 4.3 Producer Configs](https://kafka.apache.org/43/configuration/producer-configs/): 2026-09-17 확인. Kafka 4.3.X 문서. key routing과 idempotence 호환 설정의 근거입니다.
- [Apache Kafka 4.3 Consumer Configs](https://kafka.apache.org/43/configuration/consumer-configs/): 2026-09-17 확인. Kafka 4.3 문서. `max.poll.interval.ms`, group protocol, 자동 commit 관련 설정의 근거입니다.

실제 Java 컴파일, Kafka cluster 실행, broker 장애, rebalance, transaction runtime test는 수행하지 않았습니다. 지원 최신 버전과 release별 transaction·consumer protocol 호환표는 이번 공식 자료에서 확정하지 못했으므로, 배포 전에 실제 broker/client 조합의 문서를 별도로 고정해야 합니다.

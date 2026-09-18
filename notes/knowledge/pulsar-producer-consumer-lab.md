---
id: pulsar-producer-consumer-lab
title: Pulsar producer·consumer 실습
topic: 분산 시스템
summary: Pulsar 4.2.4의 생산 확인·구독 cursor·업무 효과·ACK를 분리하고, 파일 원장과 다중 broker·bookie 구성의 장애 검증 경계를 추적합니다.
questionIds: []
prerequisites: [pulsar-foundations, pulsar-application, idempotency]
related: [event-contracts, broker-redelivery, kafka-consumer-offset]
reviewedAt: '2026-09-18'
---

# Pulsar producer·consumer 실습

## 실습 구성과 버전

Pulsar에서 메시지를 보냈다는 사실과 업무가 처리되었다는 사실은 다릅니다. producer는 broker의 저장 확인을 받고, consumer는 구독을 통해 전달받은 메시지를 처리한 뒤 ACK합니다. 그 사이에 프로세스가 종료되면 같은 메시지가 다시 전달될 수 있습니다.

이 실습은 `pulsar-client:4.2.4`와 `apachepulsar/pulsar:4.2.4`를 고정합니다. Java 17 코드, standalone 구성, ZooKeeper 1개·bookie 3개·broker 2개를 연결한 다중 노드 구성을 제공합니다. 단일 ZooKeeper는 metadata의 단일 장애 지점이므로 전체 구성을 완전한 고가용성 시스템이라고 부르지 않습니다. 버전 고정은 최신·지원 상태의 영구 보증도 아닙니다.

## 저장 확인과 업무 완료

```diagram
{"title":"Pulsar의 완료 경계","caption":"저장 확인과 ACK 사이에 업무 효과를 별도로 확정합니다. 처리 실패는 ACK 성공 경로와 분리합니다.","rows":[[{"id":"producer","label":"Producer","detail":["eventId·key","send 저장 확인"]}],[{"id":"broker","label":"Broker·BookKeeper","detail":["persistent message"]}],[{"id":"consumer","label":"구독 consumer","detail":["Shared 또는 Key_Shared"]}],[{"id":"effect","label":"업무 원장","detail":["effect commit → ACK"]},{"id":"retry","label":"처리 실패","detail":["Shared retry·DLQ","Key_Shared negative ACK"]}]],"edges":[{"from":"producer","to":"broker","label":"publish"},{"from":"broker","to":"consumer","label":"delivery"},{"from":"consumer","to":"effect","label":"정상 처리"},{"from":"consumer","to":"retry","label":"실패"}]}
```

정상 경로는 다음과 같습니다.

1. producer가 안정적인 논리 `eventId`와 key를 전송하고 `MessageId`를 받습니다.
2. consumer가 메시지를 받아 payload를 해석합니다.
3. `InboxStore.apply()`가 원본 payload·fingerprint·효과 결과를 기록하고 `FileChannel.force(true)`를 완료합니다.
4. `COMMIT` 로그 뒤에 individual ACK를 보냅니다.
5. ACK가 반환되면 `ACK` 로그를 남깁니다. 이는 외부 업무의 전역 exactly-once 보장이 아닙니다.

`COMMIT`과 `ACK` 사이에서 프로세스를 종료하면 원장에는 효과가 남지만 broker는 재전달할 수 있습니다. 재시작한 consumer가 같은 event ID를 받으면 `applied=false`로 기존 결과를 사용한 뒤 ACK합니다. producer 재실행이 새 event ID를 생성하면 별개 업무로 간주하므로, 실서비스의 재시도에서는 업무 식별자를 보존해야 합니다.

## 파일 원장의 내구성과 한계

원장은 length·magic·CRC가 있는 append record입니다. 생성자와 `apply()`는 OS 파일 lock을 획득하고, 같은 JVM에서는 경로별 lock으로 overlapping file-lock 오류를 막습니다. 여러 worker가 중복 효과를 공유하려면 같은 정규화된 파일 경로를 사용해야 합니다. 별도 파일을 쓴 worker의 로컬 중복 제거를 전역 중복 제거라고 부를 수 없습니다.

기록 끝의 불완전한 frame은 재개 시 잘라내지만, 완전한 frame의 magic·length·CRC 오류는 조용히 삭제하지 않고 실패합니다. 같은 event ID의 payload fingerprint가 다르면 충돌입니다. `force(true)` 이후 성공을 반환하지만 전원 손실·파일시스템·디렉터리 엔트리 내구성을 시험한 것은 아닙니다. 이 원장의 효과는 저장한 문자열 결과이며, 외부 결제·HTTP 부작용과 원자적으로 묶이지 않습니다.

원장 전체를 다시 읽는 작은 교육용 구현이므로 큰 이력에 적합하지 않습니다. 운영에서는 보존 기간·용량 상한·압축 또는 DB의 unique constraint와 업무 변경을 함께 사용하는 거래가 필요합니다. symlink 별칭이나 서로 다른 마운트 경로의 동일 파일까지 JVM lock identity로 정규화하지 않습니다.

## 구독과 batching

`Shared`는 작업을 나누지만 전체 순서를 보장하지 않습니다. `Key_Shared`는 key별 분배 경계를 제공하며, producer에는 `BatcherBuilder.KEY_BASED`를 사용합니다. 같은 key라고 해도 membership 변경·재전달·외부 처리 순서를 모두 하나의 전역 순서로 확대하면 안 됩니다.

4.2.x 문서의 retry letter topic 범위에 맞춰 `enableRetry(true)`, `DeadLetterPolicy`, `reconsumeLater`는 Shared 경로에만 둡니다. Key_Shared의 처리 실패는 negative ACK입니다. poison payload를 직접 보내면 retry/DLQ 경로를 시험할 수 있지만 기본 producer는 정상 event만 보냅니다. DLQ 전달 횟수·원본 속성·redrive는 실제 broker 검증이 필요한 별도 항목입니다.

## 다중 노드 연결

다중 노드 Compose는 두 standalone 인스턴스가 아닙니다. 모든 broker·bookie가 하나의 metadata와 ledger 경로를 공유합니다. `metadata-init` 성공 후 bookie를 시작하고, 세 bookie의 readiness 뒤 broker를 시작합니다.

broker 설정의 `bindAddresses`는 실제 listen 주소, `advertisedListeners`는 client에게 반환할 주소입니다. 내부 listener는 `broker-1:6650`·`broker-2:6650`이고, 외부 listener는 컨테이너 16650을 host `127.0.0.1:6650`·`:6651`로 매핑합니다. host Java client는 `PULSAR_LISTENER_NAME=external`을 선택합니다. 이 이름과 port mapping을 섞으면 첫 bootstrap 연결은 성공해도 lookup 뒤 연결에 실패할 수 있습니다.

BookKeeper는 ensemble 3, write quorum 3, ACK quorum 2입니다. bookie가 정확히 세 개이고 여분이 없으므로 한 bookie 장애 뒤 지속 쓰기나 재복제를 보장하지 않습니다. broker owner 재배정, bookie 데이터 가용성, metadata 가용성을 각각 검사해야 합니다.

## 실행과 장애 순서

[실습 코드](https://github.com/c86j224s/tech-interview/tree/main/examples/knowledge/pulsar-producer-consumer-lab/)는 Java 17·Maven·Docker Compose v2를 사용합니다.

```sh
cd examples/knowledge/pulsar-producer-consumer-lab
mvn test
bash scripts/run-standalone.sh
bash scripts/run-multinode-failure.sh
```

standalone은 consumer의 `READY`를 확인한 뒤 publish합니다. 새 구독은 `Earliest`로 만들지만 기존 durable subscription의 cursor를 그 설정으로 초기화하지는 않습니다. standalone volume과 로컬 원장은 재시작 실험을 위해 보존합니다.

다중 노드 runner는 임의 project 이름과 새 topic을 사용합니다. 생성한 disposable Compose project의 volume은 종료 시 정리하고 `var/<run-id>/`의 로그와 원장은 남깁니다.

1. 첫 worker의 효과 `COMMIT`을 기다리고 10초 ACK 지연 구간 안에서 해당 프로세스를 종료합니다.
2. 두 번째 worker가 같은 원장과 구독으로 재전달받아 `applied=false`로 ACK하는지 확인합니다.
3. 실제 partition owner를 조회하여 그 broker를 중지합니다. owner가 항상 broker-1이라고 가정하지 않습니다.
4. 살아 있는 broker로 owner가 바뀐 뒤 consumer를 먼저 준비하고 세 sentinel event를 전송합니다.
5. producer가 출력한 세 ID가 consumer ACK 로그에 모두 나타나는지 제한 시간 안에 확인합니다.
6. bookie-1 중지는 topology 관찰만 남깁니다. 실제 읽기·under-replication·복구 검증을 수행한 것으로 표시하지 않습니다.

## 실행 결과와 남은 검증

2026-09-18 JDK 17과 격리된 Maven 3.9.9로 Pulsar 4.2.4 client 코드를 실제 컴파일하고 JUnit 5개 테스트를 통과했습니다. 중복 효과, payload 충돌, poison 거절, 동시 중복, 원장 재열기를 검사합니다. 같은 JVM에서 store를 닫고 여는 JUnit 사례와 별도 프로세스 재시작 검사는 구분합니다.

Docker가 없어 standalone·다중 노드 시작, 실제 ACK·redelivery, broker failover, bookie loss/recovery, retry/DLQ, Key_Shared wire 동작은 실행하지 않았습니다. Compose YAML 문법과 공식 소스 설정 대조는 container startup 성공을 대신하지 않습니다. 실패한 실행은 `FAIL`이며, 실행 환경이 없어 시작하지 못한 경우만 `NOT_RUN`입니다.

## 공식 근거

- [Pulsar 4.2.x messaging](https://pulsar.apache.org/docs/4.2.x/concepts-messaging/) — 구독·ACK·재전달·retry/DLQ 개념입니다.
- [v4.2.4 broker.conf](https://github.com/apache/pulsar/blob/v4.2.4/conf/broker.conf) — `bindAddresses`, advertised listener와 내부 listener 설정입니다.
- [v4.2.4 BookKeeper launcher](https://github.com/apache/pulsar/blob/v4.2.4/bin/bookkeeper) — `BOOKIE_CONF`와 bookie 실행 인자입니다.
- [v4.2.4 ClientBuilder](https://github.com/apache/pulsar/blob/v4.2.4/pulsar-client-api/src/main/java/org/apache/pulsar/client/api/ClientBuilder.java) — `listenerName`과 client 설정입니다.
- [v4.2.4 ConsumerBuilder](https://github.com/apache/pulsar/blob/v4.2.4/pulsar-client-api/src/main/java/org/apache/pulsar/client/api/ConsumerBuilder.java) — 구독 초기 위치, retry와 DLQ 설정입니다.

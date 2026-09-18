---
id: kafka-lab
title: Kafka 소비·파일 inbox 실습
topic: 분산 시스템
summary: 단일 broker track과 3-broker KRaft RF3/minISR2 track을 나누어 producer·consumer·재전달·inbox·연속 offset·ISR·broker 복구 증거를 분리합니다.
questionIds: []
prerequisites: [kafka-foundations, kafka-application, kafka-operations]
related: [consumer-inbox, idempotency, kafka-consumer-offset]
reviewedAt: '2026-09-18'
---

# Kafka 소비·파일 inbox 실습

```diagram
{"title":"Kafka record와 외부 완료의 분리","caption":"poll 전달, 파일 inbox 효과, group commit은 서로 다른 상태입니다.","rows":[[{"id":"producer","label":"Producer","detail":["evt-0..5","acks=all"]}],[{"id":"broker","label":"Kafka broker","detail":["lab-events/P0"]}],[{"id":"consumer","label":"Consumer poll","detail":["auto commit 없음"]},{"id":"inbox","label":"파일 inbox","detail":["event ID unique"]}],[{"id":"group","label":"Group committed","detail":["재시작 경계"]}]],"edges":[{"from":"producer","to":"broker","label":"send"},{"from":"broker","to":"consumer","label":"poll"},{"from":"consumer","to":"inbox","label":"effect"},{"from":"inbox","to":"group","label":"commit after contiguous completion"}]}
```

## 실습 목적과 두 실행 track

이 실습은 `poll` 전달 위치, 외부 inbox 효과, consumer group committed offset을 서로 다른 상태로 추적합니다. `examples/knowledge/kafka-lab/compose.yaml`은 빠른 단일 broker RF1 track을 보존하고, `compose.multi.yaml`은 실제 3-broker KRaft combined cluster에서 RF3/minISR2, ISR 축소·복귀, broker 중단·복구와 consumer 재시작을 확인하는 확장 track입니다.

단일 broker는 replication failover를 증명하지 않습니다. 3-broker track만 `kafka-topics.sh --describe`의 `Replicas`와 `Isr`를 사용해 복제 상태를 검사합니다. ISR 상태, consumer group offset, inbox 업무 효과는 서로 다른 증거입니다.

## 3-broker KRaft 구성

`compose.multi.yaml`은 Apache Kafka 공식 plaintext combined KRaft Docker 예제의 구조를 따릅니다. 세 노드는 `KAFKA_NODE_ID` 1·2·3, `KAFKA_PROCESS_ROLES=broker,controller`, 동일한 `KAFKA_CONTROLLER_QUORUM_VOTERS`, 내부 `PLAINTEXT://:19092`, controller `CONTROLLER://:9093`, host `PLAINTEXT_HOST://:9092`를 사용합니다. host ports는 `127.0.0.1:29092`, `39092`, `49092`로 loopback에만 매핑하고 advertised host endpoint는 각 `localhost` port를 가리킵니다.

세 노드는 `KAFKA_MIN_INSYNC_REPLICAS=2`, `KAFKA_DEFAULT_REPLICATION_FACTOR=3`, offsets/transaction/share coordinator replication factor 3, 관련 min ISR 2, `KAFKA_UNCLEAN_LEADER_ELECTION_ENABLE=false`를 사용합니다. `lab-events`는 자동 생성하지 않고 partition 1, RF3, topic `min.insync.replicas=2`로 명시 생성합니다. image는 `apache/kafka:4.3.1` tag로 고정했으며 tag 불변 digest나 최신·지원 상태를 주장하지 않습니다.

공식 구성 근거는 Apache Kafka repository의 `https://raw.githubusercontent.com/apache/kafka/trunk/docker/examples/docker-compose-files/cluster/combined/plaintext/docker-compose.yml`입니다. 공식 Docker 문서의 실행 예시는 `apache/kafka:4.3.1`입니다.

## 상태 모델과 Java 코드

producer는 `acct-7` key와 `evt-0`부터 `evt-5`까지의 header를 `acks=all`, idempotence로 전송합니다. `KILL_BEFORE_ACK_EVENT_ID`는 send 결과를 기다리기 전 종료하는 ACK 불확정 주입이며, replication 성공이나 broker 장애 증거가 아닙니다.

consumer는 `enable.auto.commit=false`, `auto.offset.reset=earliest`로 owner thread에서 poll합니다. `Checkpoint`는 전달 deque와 완료 집합을 사용해 contiguous next commit만 허용합니다. `InboxStore`는 event ID를 새 파일을 force한 뒤 원자 교체하고 프로세스 시작 때 reload하므로 commit 전 종료 뒤 동일 ID 재전달을 `inboxApplied=false`로 흡수합니다. 파일 저장소는 실제 DB unique constraint와 업무 변경을 하나의 원자 transaction으로 묶지 않는 교육용 대체물입니다. 한 writer만 허용하는 실습이며 여러 consumer 프로세스가 같은 파일에 동시에 쓰면 안 됩니다. 파일 교체의 원자성이 없는 파일시스템에서는 실패하며 전원 손실·디렉터리 fsync 내구성은 검증하지 않습니다.

`InboxWorker`는 `ConsumerRebalanceListener`의 revoked/assigned/lost callback을 로그로 남깁니다. 이 로그는 group ownership 증거이며, inbox 효과나 commit 성공을 뜻하지 않습니다. `onPartitionsLost`는 이미 소유권을 잃은 상태이므로 마지막 commit 기회로 사용하지 않습니다.

## 결정적 consumer 재시작 검사

`make multi-integration`은 RF3/minISR2 topic을 만들고 초기 `Replicas`/`Isr`를 검사한 뒤 6개 event를 전송합니다. 첫 consumer는 `STOP_AFTER_EVENT_ID=evt-2 KILL_BEFORE_COMMIT=true MAX_RECORDS=3`으로 실행되어 inbox 효과 세 개를 남기고 exit 42로 끝납니다. 로그 marker와 inbox의 정확한 ID 집합 `evt-0..evt-2`를 검사합니다.

같은 group으로 consumer를 재시작하면 이미 적용된 ID에서 `inboxApplied=false`가 출력되고, 최종 `committed partition=0 offset=6`이 관찰되며, inbox는 `evt-0..evt-5` 각 한 번으로 남아야 합니다. 이것은 물리 재전달과 외부 효과 중복 제거를 검증하며, group coordinator의 실제 상태는 commit 응답과 별도로 해석해야 합니다.

## broker 중단·복구 검사

`make multi-failure`의 순서는 다음과 같습니다.

1. 세 broker를 기동하고 RF3/minISR2 topic을 생성합니다.
2. 중단 전 describe에서 RF3와 ISR 3을 검사합니다.
3. producer와 pre-commit consumer kill을 수행하고 exit 42 및 inbox ID 세 개를 검사합니다.
4. `docker compose -f compose.multi.yaml stop kafka-1`을 실행합니다.
5. kafka-2에서 describe를 조회해 broker ID 1이 ISR에서 빠지고 ISR이 정확히 2인지 검사합니다. 이는 ISR 증거이며 leader 변경을 자동으로 주장하지 않습니다.
6. kafka-1이 중단된 동안 같은 consumer group을 재시작해 exit 0, commit offset 6, inbox ID 정확한 집합을 검사합니다. 이는 consumer 재시작/효과 증거이며 ISR 증거와 별개입니다.
7. `start kafka-1` 뒤 describe를 다시 조회해 RF3와 ISR 3을 검사합니다. 이는 broker 복구와 ISR catch-up 증거입니다.

Makefile은 각 단계의 describe와 consumer 로그를 `.lab-inbox/`에 저장하고, startup 이전에 종료 trap을 등록하여 해당 disposable project의 volume을 정리합니다. 로그와 원장은 보존합니다. `assert_replication.py`는 `Replicas`와 `Isr`를, `assert_consumer.py`는 kill marker와 evt-2의 중복 효과 억제를, `OffsetAdmin`과 `assert_offset.py`는 broker coordinator의 실제 offset을, `assert_inbox.py`는 정확한 ID 집합을 검사합니다.

## 실행 범위

```sh
cd examples/knowledge/kafka-lab
make python-test
make test
make integration
make multi-integration
make multi-failure
make multi-down
```

현재 작성 환경은 macOS 27 arm64이며 JDK 21(`/opt/homebrew/opt/openjdk@21/bin`)과 Gradle 9.6.0으로 Java compile·JUnit 4개·installDist를 통과했습니다. 격리 Maven cache를 사용한 JUnit 실행도 4개 테스트 모두 통과했습니다. Docker/Compose가 없어 Compose parse, image pull, broker readiness, 실제 producer/consumer, process kill, consumer rebalance, broker stop/recovery, RF/ISR assertions는 모두 `NOT_RUN`입니다. Python과 shell static checks도 통과했습니다.

## 공식 근거

- Apache Kafka Docker: `https://kafka.apache.org/43/getting-started/docker/`
- Apache Kafka official combined plaintext cluster compose: `https://raw.githubusercontent.com/apache/kafka/trunk/docker/examples/docker-compose-files/cluster/combined/plaintext/docker-compose.yml`
- Apache Kafka basic operations: `https://kafka.apache.org/43/operations/basic-kafka-operations/`
- KafkaConsumer Javadoc: `https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html`
- ConsumerRebalanceListener Javadoc: `https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/ConsumerRebalanceListener.html`
- Producer configs: `https://kafka.apache.org/43/configuration/producer-configs/`

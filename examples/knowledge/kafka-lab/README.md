# Kafka 파일 inbox 실습

이 패키지는 두 개의 실행 track을 보존합니다. 기본 `compose.yaml`은 빠른 단일 broker 경로이고, `compose.multi.yaml`은 실제 3-broker KRaft 복제·ISR·broker 장애·consumer 재시작을 확인하는 확장 경로입니다. 두 경로 모두 Kafka broker/client를 실제로 사용하며, Docker가 없는 현재 환경에서는 broker 통합 결과를 `NOT_RUN`으로 기록합니다.

## Track A: 단일 broker

단일 broker는 `compose.yaml`의 `apache/kafka:4.3.1`, combined KRaft mode, `127.0.0.1:19092` loopback mapping, RF1 topic으로 빠르게 poll·inbox·contiguous checkpoint를 보여 줍니다. `make integration`이 이 단순 경로를 실행합니다. RF1이므로 replication failover, ISR 축소/복귀, leader failover를 증명하지 않습니다.

## Track B: 3-broker KRaft replication

`compose.multi.yaml`은 Apache Kafka 공식 Docker repository의 combined plaintext cluster 예제와 같은 구조를 따릅니다.

- `kafka-1`, `kafka-2`, `kafka-3`은 각각 broker/controller combined node ID 1·2·3입니다.
- controller quorum은 `1@kafka-1:9093,2@kafka-2:9093,3@kafka-3:9093`입니다.
- broker 내부 listener는 `PLAINTEXT://:19092`, controller listener는 `CONTROLLER://:9093`, host client listener는 `PLAINTEXT_HOST://:9092`입니다.
- host client ports are explicitly loopback-only: `127.0.0.1:29092`, `127.0.0.1:39092`, `127.0.0.1:49092`. Advertised host addresses are `localhost` with those ports; container-to-container broker addresses use service hostnames.
- all three nodes use the same explicit cluster ID and independent named volumes.
- `KAFKA_MIN_INSYNC_REPLICAS=2`, `KAFKA_DEFAULT_REPLICATION_FACTOR=3`, offsets/transaction/share-coordinator replication factor 3, corresponding min ISR 2, and unclean leader election disabled make the lab fail visibly rather than silently accepting an RF3 write with only one ISR member.
- automatic topic creation is disabled. The fixture creates `lab-events` explicitly with one partition, replication factor 3, and topic `min.insync.replicas=2`.

The official Apache source used for the KRaft/listener shape is `https://raw.githubusercontent.com/apache/kafka/trunk/docker/examples/docker-compose-files/cluster/combined/plaintext/docker-compose.yml`. The image is pinned to the requested released tag `apache/kafka:4.3.1`; this is a tag pin, not a verified immutable digest or support/latest claim.

## Producer, consumer, and state boundaries

`ProducerMain` sends `evt-0` through `evt-5` with key `acct-7`, `acks=all`, and idempotence. `KILL_BEFORE_ACK_EVENT_ID` ends the process before waiting for a send result; this is an ACK uncertainty injection and not a replication or broker-failure assertion.

`InboxWorker` disables auto commit and uses `auto.offset.reset=earliest`. It logs `rebalance revoked=`, `rebalance assigned=`, and `rebalance lost=` through the official `ConsumerRebalanceListener` callbacks. Callback logs are group ownership evidence only; they do not prove that an external effect committed.

The worker records delivery in `Checkpoint`, applies the event ID through file-backed `InboxStore`, marks completion, then commits the contiguous next offset. `KILL_BEFORE_COMMIT=true` applies the selected event and halts with exit 42 before commit. A restart with the same group can redeliver the event; `InboxStore` reloads the event IDs and reports `inboxApplied=false`, preserving one logical effect per ID. This file store is an educational stand-in, not an atomic database transaction joining business state and Kafka offset.

## Deterministic restart test

Run the multi-broker fixture with `make multi-integration`. It starts the multi-broker Compose project, creates the RF3/minISR2 topic, asserts the initial replica count and ISR size, builds an install distribution, sends six IDs with direct Java, runs the consumer with `STOP_AFTER_EVENT_ID=evt-2 KILL_BEFORE_COMMIT=true MAX_RECORDS=3`, asserts exact exit 42 and exactly three unique inbox IDs, then restarts the same consumer group with `MAX_RECORDS=6`. `assert_inbox.py` requires exactly `evt-0` through `evt-5` once; this assertion is about external effects, not group offset state.

The expected restart evidence is:

1. the first run prints `KILL_BEFORE_COMMIT eventId=evt-2` and exits 42;
2. the inbox contains exactly three unique IDs after that process kill;
3. the restarted process explicitly replays `evt-2` with `inboxApplied=false`;
4. the broker coordinator query reports group `lab-inbox`, partition 0, committed offset 6;
5. inbox ID count remains six.

The consumer log's commit line is diagnostic only. `OffsetAdmin` reads the committed offset from the broker coordinator, and `assert_offset.py` checks that result.

## Broker stop, ISR, and recovery procedure

Run `make multi-failure` on a host with Docker Engine, Compose, Java 17+, Gradle, and network access to pull the image. The script starts the multi-broker Compose project itself. The procedure is intentionally ordered so different claims are not conflated:

1. Start all three brokers and create `lab-events` with RF3/minISR2.
2. Capture `kafka-topics.sh --describe` and assert `ReplicationFactor=3` and ISR size exactly 3. This is initial topology/ISR evidence.
3. Produce six IDs and run the deterministic pre-commit consumer kill. Assert exit 42 and inbox size 3. This is external-effect/restart evidence.
4. Execute `docker compose -f compose.multi.yaml stop kafka-1`.
5. Query the topic from kafka-2. Assert the stopped broker ID 1 is absent from ISR and ISR size remains at least 2. This is broker stop/ISR evidence; it does not claim that a leader changed unless the describe output shows it.
6. Restart the same consumer group while kafka-1 is down. Assert exit 0 and inbox IDs remain exactly six. This is consumer availability/restart evidence; it is separate from inbox effects and separate from ISR state.
7. Execute `docker compose -f compose.multi.yaml start kafka-1`, query describe again, and assert RF3 with ISR size exactly 3. This is broker recovery/ISR catch-up evidence.

`kafka-topics.sh --describe` fields are used as documented by Apache: `Replicas` is the assigned replica set and `Isr` is the in-sync set. A stopped broker being absent from ISR is not the same assertion as a new leader being elected. Likewise, a consumer's successful `commitSync` response is not the same evidence as a broker describe result or an external inbox effect.

## Commands and execution limits

```sh
cd examples/knowledge/kafka-lab
make python-test
make test
make integration          # Track A, single broker
make multi-integration    # Track B, RF3/minISR2 and restart
make multi-failure        # Track B, stop/recover kafka-1
make multi-down
```

Use `GRADLE=./gradlew` when a host-provided wrapper is available. The Bash runners register teardown before startup and remove their disposable project volumes at the end. Logs are preserved.

On macOS 27 arm64 (2026-09-18), JDK 21 and Gradle 9.6.0 compiled the Kafka 4.3.1 clients, passed all 4 JUnit tests, and built `installDist`. Maven independently passed the same 4 tests. Docker is unavailable: broker startup, wire protocol, rebalance, ISR/failover and recovery are NOT_RUN. Python format/checkpoint tests and shell syntax checks are separate from broker integration.

The file inbox is single-writer only. Do not run simultaneous consumers against this file: synchronized methods protect one instance, not another process. Each integration script uses a uniquely named disposable Compose project and an inbox subdirectory; only that project's volumes are removed at teardown. Diagnostic logs remain in `.lab-inbox/`. Atomic file replacement is required; directory fsync/power-loss durability and real database transactions are not claimed.

## Official references

- Apache Kafka Docker: `https://kafka.apache.org/43/getting-started/docker/` — official `apache/kafka:4.3.1` launch example.
- Apache Kafka official plaintext combined KRaft Docker Compose: `https://raw.githubusercontent.com/apache/kafka/trunk/docker/examples/docker-compose-files/cluster/combined/plaintext/docker-compose.yml` — node/listener/quorum layout used by `compose.multi.yaml`.
- Apache Kafka basic operations: `https://kafka.apache.org/43/operations/basic-kafka-operations/` — replicated topic creation and `Replicas`/`Isr` describe fields.
- KafkaConsumer Javadoc: `https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html` — position, committed offset, commit, and thread ownership.
- ConsumerRebalanceListener Javadoc: `https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/ConsumerRebalanceListener.html` — revoke, assigned, and lost callback boundaries.
- Producer configs: `https://kafka.apache.org/43/configuration/producer-configs/` — key routing and idempotence conditions.

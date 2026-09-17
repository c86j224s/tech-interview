---
id: pulsar-operations
title: Pulsar 운영과 Kafka 비교
topic: 분산 시스템
summary: Pulsar의 backlog·retention·compaction·offload·geo failover를 Kafka의 저장·복제·소비 진행과 같은 질문으로 비교하되 보장 범위를 섞지 않습니다.
questionIds: []
prerequisites: [pulsar-foundations, pulsar-application, kafka-foundations]
related: [kafka-consumer-offset, kafka-retained-state, kafka-transaction-scope, distributed-commit, kafka-partition-order]
reviewedAt: '2026-09-17'
---

# Pulsar 운영과 Kafka 비교

## 운영 판단의 기준

Pulsar와 Kafka를 “둘 다 durable한 메시징 시스템”이라고만 비교하면 운영 중인 장애의 위치를 찾을 수 없습니다. 저장 확인, consumer 진행, 외부 효과, 복제 지연, 재생 가능 범위를 각각 질문해야 합니다. 같은 `commit`이라는 단어도 Pulsar의 ACK·cursor와 Kafka의 committed offset에서 가리키는 상태가 다를 수 있습니다.

이 글에서는 Pulsar 5.0.x 공식 문서와 Kafka 4.3.x 공식 문서의 확인된 문장을 기준으로 비교합니다. 2026-09-17 확인 시점의 Pulsar downloads 페이지는 current stable을 4.2.4로 표시했고, 5.0.0-M2는 production용이 아닌 milestone로 표시했습니다. 따라서 `5.0.x`는 문서 branch를 가리키는 표기이지 현재 stable 배포 버전이라는 주장이 아닙니다. Kafka downloads 페이지는 4.3.1을 supported release로 표시했지만, 확인한 텍스트만으로 이를 latest stable이라고 부르지 않습니다.

공통 업무 예로 주문 `E1`을 사용합니다. producer 성공, consumer effect, 재시작 위치, 다른 지역에서 보이는 시점은 각각 다른 checkpoint입니다. 제품 이름이나 저장 계층이 다르다는 이유만으로 보장 범위를 넓히지 않습니다.

## Pulsar 저장 수명과 Backlog

Pulsar의 persistent topic은 BookKeeper ledger와 managed ledger를 통해 메시지를 저장합니다. subscription cursor가 아직 지나지 않은 unacknowledged backlog는 ledger 정리 시점을 붙잡을 수 있습니다. retention은 이미 ACK된 메시지를 더 오래 보관할 수 있는 정책이고, backlog는 아직 consumer가 확인하지 않은 데이터의 진행 상태입니다.

TTL과 cleanup은 메시지의 실제 수명을 바꿀 수 있습니다. 오래 멈춘 consumer가 “earliest”에서 시작해도 서비스가 만든 모든 역사보다 현재 보관 범위의 가장 이른 위치만 읽을 수 있습니다. earliest 위치, 현재 읽을 수 있는 저장 경계, snapshot 시점, 외부 효과 멱등 보관 기간을 함께 기록해야 합니다.

compaction은 key별 최신 메시지를 사용해 상태를 재구축하는 데 도움을 줍니다. 모든 과거 사건을 보존하는 감사 로그와 같지 않습니다. compaction horizon 앞뒤의 reader가 서로 다른 표현을 볼 수 있으므로, 중간 결제·취소 이력을 복원해야 한다면 원본 event history를 별도로 보관해야 합니다.

## Ledger와 Tiered Storage 수명

managed ledger는 successive ledger를 이어 붙이고, 현재 ledger가 닫히면 다음 ledger가 기록을 이어받습니다. tiered storage는 매우 긴 backlog를 대상으로 sealed BookKeeper segment를 더 저렴한 archival storage로 옮기는 기능입니다. 확인한 문서 범위에서는 current segment는 offload 대상에서 제외되고, segment는 한 번에 하나씩 복사되며 transferred segment는 immutable이 됩니다.

offload가 끝났다는 상태와 local BookKeeper 사본 삭제 시각은 같은 뜻이 아닙니다. 확인한 overview는 remote deletion, 복원 절차, 수치화한 내구성·지연 보장을 확정하지 않습니다. 운영자는 offload 상태, local ledger 보존, 문서에 설명된 remote read 경로를 별도 확인해야 합니다.

```diagram
{"title":"Pulsar 메시지의 보관 수명","caption":"cursor·retention·compaction·offload는 서로 다른 경계를 만듭니다. 한 경계의 완료를 다른 경계의 삭제나 전체 역사 보장으로 해석하지 않습니다.","rows":[[{"id":"publish","label":"Persistent publish","detail":["BookKeeper append","현재 ledger"]}],[{"id":"pending","label":"Unacknowledged backlog","detail":["cursor 뒤처짐","삭제 지연 가능"]}],[{"id":"ack","label":"ACK·cursor 진행","detail":["subscription 상태"]},{"id":"retain","label":"Retention 보관","detail":["ACK 후에도 보존 가능"]}],[{"id":"compact","label":"Compaction 표현","detail":["key별 최신 상태","complete history 아님"]}],[{"id":"offload","label":"Sealed segment offload","detail":["current 제외","immutable remote copy"]}]],"edges":[{"from":"publish","to":"pending","label":"아직 미확인"},{"from":"pending","to":"ack","label":"consumer ACK"},{"from":"ack","to":"retain","label":"보관 정책"},{"from":"ack","to":"compact","label":"상태 재구축 경로"},{"from":"compact","to":"offload","label":"sealed segment 수명"}]}
```

운영 대시보드에서는 pending count만 보지 않습니다. oldest message age, backlog bytes, subscription cursor, compaction horizon, offload 상태, 재생 시작 위치를 함께 표시합니다. queue depth가 줄어도 cursor가 잘못 전진했거나 외부 effect가 누락된 경우가 있고, queue depth가 커도 retention으로 정상 보관 중일 수 있습니다.

## Pulsar Geo Replication과 Failover

Pulsar geo-replication은 source cluster에서 local persistence가 된 뒤 다른 cluster로 message data를 asynchronous하게 전달합니다. producer가 A에서 성공한 시점, B에서 E1이 보이는 시점, B consumer가 효과를 확정한 시점에는 시간 차이가 날 수 있습니다.

동일한 subscription name이라도 각 cluster의 subscription state는 local입니다. failover를 위한 문서 경로에서는 개별 ACK가 하나씩 그대로 이동하는 것이 아니라 mark-delete cursor baseline이 동기화됩니다. bidirectional replication, broker 지원, consumer opt-in 같은 구성 조건도 필요합니다.

따라서 A와 B에서 consumer를 동시에 켜면 같은 논리 이벤트가 두 지역에서 처리될 수 있습니다. noncontiguous ACK가 있는 상태에서 전환하면 이미 처리한 일부가 다시 재생될 수 있습니다. per-producer ordering은 topic 전체의 전역 순서나 두 cluster의 외부 효과 순서를 보장하지 않습니다.

cluster-level failover 문서는 minimum data loss와 reduced recovery time을 설명하지만 숫자 RPO/RTO를 주지 않습니다. 문서의 다른 문맥에는 controlled switching에서 data loss가 발생할 수 있다는 조건도 있으므로, 이를 unconditional zero-loss나 zero-duplicate 보장으로 옮기지 않습니다. 아직 B로 복사되지 않은 E2는 B에서 즉시 읽을 수 없습니다.

| checkpoint | Cluster A | Cluster B | 운영 해석 |
|---|---|---|---|
| E1 local append | 확인 | 없음 | producer local 성공 |
| E1 remote forwarding | 확인 | 수신 중 | replication lag 존재 |
| E1 destination visible | 확인 | consumer 수신 가능 | B effect 시작 가능 |
| A mark-delete | 이동 | baseline은 별도 동기화 | 개별 ACK 복사와 다름 |
| failover 이후 | active 아님 | active 전환 | E2 미복제·E1 replay 확인 |

failover 직전에는 source와 destination event ID, replication backlog, last replicated event, mark-delete baseline, oldest lag age를 함께 저장합니다. 복귀 후에는 duplicate effect와 source·destination의 논리 ID 집합을 대사하고, 자동으로 손실이 없었다고 보고하지 않습니다.

## Pulsar와 Kafka의 저장·복제 비교

Pulsar는 broker와 BookKeeper를 분리한 구조입니다. broker는 topic ownership과 dispatch를 맡고 BookKeeper가 ledger 데이터를 보관합니다. Kafka는 broker가 partition leader와 follower replica를 관리하고 ISR(in-sync replicas, 현재 동기화 상태로 인정되는 사본 집합)을 통해 복제 진행을 판단합니다.

Pulsar의 `E`, `Qw`, `Qa`는 ensemble, write quorum, acknowledgment quorum을 표현합니다. Kafka의 RF, ISR, `min.insync.replicas`와 같은 숫자처럼 보이지만 같은 계층이나 동일한 실패 의미가 아닙니다. Pulsar quorum 관계를 Kafka의 “현재 ISR 전체”로 번역하지 않습니다.

Kafka 4.3의 단순 ISR 모델에서 RF=3, ISR={L,F1,F2}, `acks=all`이면 현재 ISR 전체의 확인을 기다립니다. `min.insync.replicas=2`는 정확히 두 replica만 기다린다는 뜻이 아니라 쓰기를 허용할 최소 ISR 크기입니다. ISR이 {L,F1}로 줄면 두 member의 확인으로 성공할 수 있지만, ISR이 {L}이면 min ISR 2 때문에 쓰기를 거절하는 경계가 생깁니다.

Pulsar에서도 ACK가 어떤 저장·복제 경계를 확인하는지와 외부 effect를 분리해야 합니다. BookKeeper 관리 문서가 제시하는 `E >= Qw >= Qa`는 quorum 관계를 설명하지만 특정 장애 도메인, 복구 시간, 외부 시스템의 원자성을 보장하지 않습니다.

## Pulsar와 Kafka의 소비 진행 비교

Pulsar는 durable subscription cursor와 ACK로 pending 진행을 저장합니다. Kafka consumer는 `position`, `processed`, `committed`를 분리해야 합니다. `position`은 다음 poll 위치이고, `committed`는 재시작 후 읽을 다음 위치이며, `processed`는 애플리케이션 외부 효과의 완료 상태입니다.

Pulsar에서도 같은 사고를 적용하되 용어를 동일시하지 않습니다. consumer receive는 처리 시작이고, ACK는 broker에 확인을 보내는 사건이며, DB commit은 외부 effect의 사건입니다. 둘 다 broker 진행과 외부 DB 변경을 자동으로 원자화하지 않습니다.

| 질문 | Pulsar | Kafka |
|---|---|---|
| 저장 레코드 | BookKeeper ledger·managed ledger | broker partition log |
| 소비 진행 | subscription cursor·ACK | position·group committed offset |
| 재전달 | 미확인 메시지 redelivery | commit 전 record 재전달 |
| 순서 범위 | subscription mode·partition·key 조건 | partition 내부 |
| 외부 DB effect | 별도 inbox·transaction | 별도 inbox·transaction |

공통 worked example은 다음과 같습니다. E1이 저장된 뒤 worker가 DB commit을 완료했지만 Pulsar ACK 또는 Kafka offset commit 전에 종료됩니다. Pulsar는 E1을 다시 전달하고 Kafka는 committed offset 뒤에서 다시 읽을 수 있습니다. 두 경우 모두 `eventId` unique와 domain mutation을 같은 DB transaction에 두면 effect count를 1로 유지할 수 있습니다.

반대로 progress를 먼저 저장하고 외부 effect를 나중에 실행하면 worker 종료 시 누락이 생길 수 있습니다. Kafka transaction은 Kafka 내부의 consumed offset과 Kafka output을 함께 묶는 조건부 경계이지 임의의 DB·HTTP·payment exactly-once가 아닙니다. Pulsar client transaction도 확인한 문서 범위에서는 transactional publish와 acknowledgment의 succeed-or-fail-together 표현을 외부 효과로 확장하지 않습니다.

## Pulsar와 Kafka의 순서 비교

Kafka는 partition 내부에서 기록 순서를 유지하지만 topic 전체 전역 순서는 제공하지 않습니다. Pulsar도 partition routing, key, subscription mode가 정하는 범위를 넘어 topic 전체나 외부 DB effect의 전역 순서를 자동 제공한다고 말하지 않습니다.

Pulsar의 SinglePartition과 RoundRobinPartition은 key가 있을 때 hashing을 사용하며, key가 없는 기록은 routing mode의 선택 규칙을 따릅니다. 확인한 감사에서는 client별 hash 구현과 partition expansion 이후의 공식 전환 계약을 확정하지 못했습니다. Kafka의 partition expansion 규칙을 Pulsar에 이식하지 않습니다.

Key_Shared는 같은 key를 한 consumer가 처리하는 범위를 제공하지만 membership 변화와 redelivery가 개입할 수 있습니다. Shared는 ordering guarantee가 없습니다. Kafka consumer group도 partition을 여러 worker가 나누어 읽으므로 병렬 완료 순서가 partition 기록 순서와 같다고 가정하지 않습니다.

업무 상태 전이가 순서에 의존하면 두 제품 모두 `entitySequence`를 넣고 저장소에서 expected sequence를 조건으로 검사하거나 같은 key의 효과를 직렬화합니다. delivery order, ACK·offset order, DB effect order를 각각 기록해야 합니다.

## Retention과 State Reconstruction 비교

Pulsar compaction은 key별 최신 상태를 compacted representation으로 유지하며 retention을 존중하고 compaction horizon을 경계로 사용합니다. Kafka log compaction도 key별 마지막 상태를 남기는 방향이고, tombstone은 key와 null payload로 삭제를 전파합니다. 양쪽 모두 최신 상태 복원과 complete historical event log를 구분합니다.

Pulsar tiered storage는 sealed BookKeeper segment를 remote archive로 옮기고 current segment는 제외합니다. Kafka tiered storage는 local retention과 remote storage retention을 분리하며, 확인한 Kafka 문서는 remote upload 이후 local 삭제가 가능하고 local 제거 뒤 remote read가 가능한 경계를 보여 줍니다. 이것을 Pulsar의 remote deletion이나 restore guarantee로 번역하지 않습니다.

| 복구 질문 | Pulsar 판단 | Kafka 판단 |
|---|---|---|
| 최신 key 상태 | compaction 지원 | log compaction 지원 |
| 전체 사건 이력 | compaction만으로 불충분 | compaction만으로 불충분 |
| 오래 중단한 consumer | 실제 보관 범위의 earliest 확인 | log start와 committed offset 확인 |
| remote storage | sealed ledger offload | remote tier와 local retention 분리 |
| 삭제 전파 | topic·retention·compaction 조건 확인 | tombstone 보존 창 확인 |

snapshot+delta 복구에서는 snapshot version과 이후 재생 위치를 한 쌍으로 저장합니다. key별 최신 상태만 가진 compacted 표현에서 중간 effect를 재실행하면 event ID dedup이 필요합니다. 실제 retention cleanup timing, remote deletion, restore procedure는 해당 제품과 배포 설정의 공식 운영 문서 및 시험 결과 없이는 단정하지 않습니다.

## 운영 검증 행렬

다음 행렬은 실행 결과가 아니라 두 제품을 같은 질문으로 비교하는 입력 계약입니다. 이번 작성에서는 Pulsar broker·BookKeeper·다중 cluster나 Kafka cluster를 실행하지 않았습니다.

| 주입 입력 | Pulsar에서 기록할 값 | Kafka에서 기록할 값 | 공통 외부 값 |
|---|---|---|---|
| producer 응답 유실 | message ID·ledger 위치 | record ID·partition/offset | 재시도 후 effect 수 |
| 저장 노드 장애 | bookie·ledger recovery | leader·ISR·high watermark | visible event ID |
| effect 후 progress 전 종료 | cursor·pending·redelivery | committed offset·redelivery | inbox·domain 결과 |
| key 병렬 처리 | partition·subscription mode | partition·group assignment | delivery/effect 순서 |
| retention·compaction | cursor·horizon·offload | log start·cleaner·tombstone | snapshot 재생 결과 |
| 지역 전환 | replication backlog·mark-delete | MirrorMaker 상태 | duplicate·missing ID |

Pulsar replication backlog는 문서에 제시된 `pulsar-admin topics stats`와 `stats-internal` 경로로 확인할 수 있습니다. Kafka에서는 ISR, committed offset, partition log start/end와 MirrorMaker 상태를 별도로 읽습니다. 명령어의 출력 필드와 권한은 실제 운영 버전을 고정해 확인합니다.

장애 대시보드에서 “lag 0”만 보고 복구를 선언하지 않습니다. consumer lag이 0이어도 외부 effect가 실패했거나 commit이 먼저 전진했을 수 있습니다. 반대로 lag이 남아도 retention이 의도된 보관을 수행하고 있을 수 있습니다. logical event ID, effect count, unresolved user impact를 최종 판단에 포함합니다.

## Exactly-once 주장 범위

Pulsar 공식 overview의 “guaranteed message delivery with persistent message storage”는 메시지 저장·전달의 표현입니다. 이것을 외부 DB나 결제 효과가 정확히 한 번이라는 주장으로 확장하지 않습니다.

Kafka 공식 design 문서는 at-least-once, at-most-once, exactly-once processing을 서로 다른 경로로 설명하고, Kafka-to-Kafka exactly-once는 consumed offset과 output transaction을 결합하는 조건에서 성립한다고 설명합니다. 임의의 외부 destination에는 그 시스템의 협력이 필요합니다.

따라서 결제 요구사항을 “Pulsar냐 Kafka냐”의 단일 기능 선택으로 쓰지 않습니다. broker가 저장 성공을 확인하는 시점, consumer progress를 영속화하는 시점, DB effect와 event ID를 함께 commit하는 시점, 외부 provider의 idempotency key, 재생·보관 기간, failover에서 허용할 missing·duplicate 범위를 명시합니다.

## 참고 자료와 검증 범위

- [Pulsar Overview](https://pulsar.apache.org/docs/5.0.x/concepts-overview/): 확인일 2026-09-17, 5.0.x 문서 branch. persistent BookKeeper storage, guaranteed message delivery, geo-replication, subscription 개요의 근거입니다.
- [Pulsar Architecture Overview](https://pulsar.apache.org/docs/5.0.x/concepts-architecture-overview/): 확인일 2026-09-17, 5.0.x 문서. broker·metadata store·BookKeeper·managed ledger·cursor·ownership·recovery의 근거입니다.
- [Pulsar Messaging](https://pulsar.apache.org/docs/5.0.x/concepts-messaging/): 확인일 2026-09-17, 5.0.x 문서. subscription, ACK, redelivery, retry/DLQ, compaction과 backlog 경계의 근거입니다.
- [Pulsar Metadata store and BookKeeper administration](https://pulsar.apache.org/docs/5.0.x/administration-zk-bk/): 확인일 2026-09-17, 5.0.x 문서. durable data, disk synchronization, `E >= Qw >= Qa`, rereplication의 근거입니다.
- [Pulsar Tiered Storage](https://pulsar.apache.org/docs/5.0.x/tiered-storage-overview/): 확인일 2026-09-17, 5.0.x 문서. sealed segment offload, current segment 제외, immutable transferred segment의 근거입니다.
- [Pulsar Geo Replication](https://pulsar.apache.org/docs/5.0.x/concepts-replication/): 확인일 2026-09-17, 5.0.x 문서. asynchronous forwarding, local subscription state, duplicate·lag 경계의 근거입니다.
- [Pulsar Geo Administration](https://pulsar.apache.org/docs/5.0.x/administration-geo/): 확인일 2026-09-17, 5.0.x 문서. mark-delete baseline, 구성, stats 경로의 근거입니다.
- [Pulsar Cluster-level Failover](https://pulsar.apache.org/docs/5.0.x/concepts-cluster-level-failover/): 확인일 2026-09-17, 5.0.x 문서. failover의 비수치적 minimum data loss·recovery time 표현과 미복제 메시지 경계의 근거입니다.
- [Pulsar Downloads](https://pulsar.apache.org/download/): 확인일 2026-09-17, checked snapshot에서 current stable 4.2.4, 5.0.0-M2는 production용이 아닌 milestone입니다.
- [Kafka Design](https://kafka.apache.org/43/design/design/): 확인일 2026-09-17, 4.3 문서. ISR 복제, at-least/at-most/exactly-once processing, Kafka transaction과 external cooperation의 근거입니다.
- [Kafka Geo-Replication](https://kafka.apache.org/43/operations/geo-replication-cross-cluster-data-mirroring/): 확인일 2026-09-17, 4.3 문서. MirrorMaker 2의 streaming transfer·partitioning과 deployment-specific exactly-once의 근거입니다.
- [Kafka Tiered Storage](https://kafka.apache.org/43/operations/tiered-storage/): 확인일 2026-09-17, 4.3 문서. local retention·remote storage retention과 remote read 경계의 근거입니다.
- [Kafka Downloads](https://kafka.apache.org/community/downloads/): 확인일 2026-09-17, checked page는 supported release 4.3.1을 표시하지만 stable이라고 명시한 문장은 확인하지 못했습니다.
- 실제 Pulsar·Kafka cluster, replication failover, retention cleaner, tiered restore, delivery test는 실행하지 않았습니다. 표와 검증 행렬은 문서 기반 예상 및 실행 계획이며 benchmark 결과가 아닙니다.

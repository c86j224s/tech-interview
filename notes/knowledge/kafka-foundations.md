---
id: kafka-foundations
title: Kafka 아키텍처와 로그
topic: 분산 시스템
summary: Kafka의 토픽, 파티션, 오프셋, 복제, 소비자 그룹, KRaft 메타데이터를 하나의 상태 흐름으로 연결하고 각 보장의 경계를 구분합니다.
questionIds: []
prerequisites: [data-system-foundations]
related: [kafka-partition-order, kafka-consumer-offset, kafka-replication-acks, kraft-control-plane]
reviewedAt: '2026-09-17'
---

# Kafka 아키텍처와 로그

## 학습 출발점과 경계

Kafka를 단순한 메시지 큐라고 부르면 중요한 상태가 사라집니다. Kafka는 사건(record)을 토픽에 기록하고, 여러 소비자가 각자의 위치에서 그 기록을 다시 읽는 분산 로그 시스템입니다. 따라서 생산자가 성공 응답을 받은 시점, 복제된 시점, 소비자가 받은 시점, 업무 효과가 끝난 시점은 서로 다를 수 있습니다.

이 장에서는 주문 `order-17`의 결제 사건을 예로 듭니다. 토픽과 파티션에서 시작해 offset, leader와 follower의 복제, consumer group의 재시작 위치를 차례로 추적한 뒤 KRaft의 메타데이터 쿼럼을 사용자 record 로그와 분리합니다.

구체적인 설정과 용어는 2026-09-17에 확인한 Apache Kafka 4.3 문서와 Kafka client API 4.3.1 문서를 기준으로 합니다. 이 기준은 문서 적용 범위이지 현재 최신 배포판이나 지원 기간을 판정한 결과가 아닙니다. 아래 숫자 표는 실제 클러스터를 실행한 결과가 아니라 문서 계약을 따라 만든 예상 상태입니다.

## 이벤트·토픽·파티션 로그

이벤트는 업무에서 일어난 사실이고, record는 그 사실을 Kafka에 저장하는 표현입니다. `eventId=evt-41`, `key=order-17`, `status=paid`를 가진 record를 발행할 수 있습니다. `eventId`는 재시도와 대사를 위한 애플리케이션 식별자이며 Kafka offset의 대체물이 아닙니다.

토픽은 record를 보관하는 논리적인 이름입니다. 소비자가 읽었다고 record가 즉시 사라지지 않으므로, 서로 다른 consumer group이 같은 토픽을 독립적으로 읽을 수 있습니다. broker는 토픽의 로그를 저장하고 요청을 처리하는 Kafka 서버입니다.

토픽은 하나 이상의 partition으로 나뉩니다. 파티션은 독립적인 추가 전용 로그이며 그 안의 각 record에 offset이 붙습니다. 여러 파티션을 여러 broker에 배치하면 처리 단위를 병렬화할 수 있지만, Kafka가 파티션 사이에 하나의 전역 순서를 만들어 주지는 않습니다.

같은 업무 키를 같은 파티션에 계속 기록하면 해당 파티션의 추가 순서를 활용할 수 있습니다. 그러나 파티션 수, key의 바이트 표현, partitioner가 바뀌면 신규 record의 목적지가 달라질 수 있습니다. 파티션 내부 순서와 업무 전체의 순서는 별도 계약으로 다뤄야 합니다. 자세한 증설 경계는 [Kafka 키 순서와 파티션 증설의 경계](/tech-interview/notes/kafka-partition-order/)로 이어집니다.

```diagram
{"title":"이벤트가 파티션 로그로 흐르는 경로","caption":"하나의 record가 토픽의 한 partition에 append된 뒤 consumer group의 위치에서 읽히는 흐름입니다. P0과 P1 사이에는 전역 순서가 없습니다.","rows":[[{"id":"event","label":"주문 이벤트","detail":["eventId=evt-41","key=order-17"]}],[{"id":"topic","label":"Topic","detail":["논리 보관 이름"]}],[{"id":"p0","label":"P0 로그","detail":["독립 offset 순서"]},{"id":"p1","label":"P1 로그","detail":["독립 offset 순서"]}],[{"id":"group","label":"Consumer group","detail":["할당된 partition 읽기"]}]],"edges":[{"from":"event","to":"topic","label":"produce"},{"from":"topic","to":"p0","label":"목적지 선택"},{"from":"topic","to":"p1","label":"다른 목적지"},{"from":"p0","to":"group","label":"fetch"},{"from":"p1","to":"group","label":"fetch"}]}
```

## 오프셋·로그 경계

offset은 특정 partition에서 다음 record를 찾기 위한 위치입니다. topic 전체의 시계나 업무 순번이 아니므로 P0의 offset 100과 P1의 offset 100을 비교해 어느 쪽이 더 최신이라고 말할 수 없습니다. compaction, 제어 record, aborted transaction 필터와 보관 정리 때문에 애플리케이션이 받는 offset 숫자 사이에 빈 구간도 생길 수 있습니다.

`position`은 한 consumer가 다음 poll에서 가져올 위치입니다. `committed offset`은 consumer group에 저장한 재시작 checkpoint입니다. 예를 들어 offset 12를 commit한다는 것은 필요한 처리가 12 미만까지 끝났고 재시작하면 12부터 읽겠다는 뜻입니다. position이 12로 이동했다고 외부 DB 효과가 끝났다는 뜻은 아닙니다.

`log start`는 현재 보관되어 있는 가장 이른 위치이고 `log end`는 새 record가 이어질 끝 경계입니다. log start보다 앞선 위치가 서비스가 만든 전체 역사의 시작이라고 볼 수는 없습니다. 오래된 committed offset으로 재개할 때 log start 밖으로 밀려났다면 `latest`로 조용히 이동해 누락을 숨기지 말고 snapshot 또는 원본 대조 경로를 선택해야 합니다.

`high watermark`는 복제된 record가 소비자에게 보일 수 있는 복제 경계입니다. `read_committed` 소비에서는 열린 transaction 때문에 확정된 결과의 경계인 LSO(last stable offset)가 별도로 작동할 수 있습니다. high watermark, LSO, position, committed offset은 각각 다른 참여자와 의미를 가진 숫자입니다.

## 리더·팔로워·ISR 복제

각 partition에는 정해진 수의 replica가 배치됩니다. RF(replication factor)는 leader를 포함한 전체 replica 수입니다. leader가 produce 요청을 먼저 받고 follower가 leader의 로그를 따라갑니다. ISR(in-sync replicas)은 현재 동기화 상태로 인정되는 replica의 집합이며 RF와 매 순간 같을 필요는 없습니다.

RF=3, `ISR={L,F1,F2}`, `min.insync.replicas=2`인 상태에서 F2가 늦어지면 ISR은 `{L,F1}`로 줄 수 있습니다. `acks=all`은 “세 replica 중 임의의 두 개를 기다린다”는 옵션이 아니라 현재 ISR의 확인을 기다리는 설정입니다. min ISR=2는 현재 쓰기를 허용할 최소 ISR 크기입니다.

F1까지 빠져 ISR이 `{L}`만 되면 min ISR=2인 `acks=all` 쓰기는 거절되는 경계가 생깁니다. min ISR을 낮추면 쓰기 가용성은 높아질 수 있지만 성공 응답 뒤 기록을 보존할 동기화 사본의 여유가 줄어듭니다. `acks=1`은 leader append 확인, `acks=0`은 broker 확인을 기다리지 않는 별도 계약입니다.

producer ACK는 소비자 가시성, 물리 디스크의 매번 `fsync`, 외부 DB 반영을 함께 증명하지 않습니다. 복제 설계 문서의 내구성 설명은 crash/recovery 장애 모델을 전제로 하므로 악의적으로 잘못된 데이터를 쓰는 노드까지 같은 보장으로 확대하지 않습니다. 복제와 ACK의 상세 상태는 [Kafka 복제 ACK와 기록 보존 경계](/tech-interview/notes/kafka-replication-acks/)에서 다룹니다.

## 소비자 그룹·할당·프로토콜

consumer group은 하나의 논리적인 소비 작업 단위입니다. group 안에서는 한 시점에 partition 하나가 한 consumer에만 할당됩니다. 파티션이 세 개인데 consumer가 다섯 개면 최대 세 consumer만 활성 처리 단위를 가집니다. 서로 다른 group은 같은 토픽을 각자의 committed offset으로 독립적으로 읽습니다.

P0과 P1에 C0과 C1이 하나씩 할당되었다고 합시다. C0이 P0을 poll해 position을 12로 옮겨도 DB 반영이 끝났다는 뜻은 아닙니다. 처리 뒤 P0의 다음 위치 12를 commit하기 전에 프로세스가 죽으면 재시작 시 같은 record가 다시 전달될 수 있습니다. 따라서 중복을 허용하거나 eventId inbox 같은 외부 멱등성 경계를 둬야 합니다.

정상적인 revoke는 재할당 전 소유권을 넘길 기회이고, lost는 이미 소유권을 잃었을 수 있는 통지입니다. lost callback을 마지막 commit 기회로 삼으면 새 consumer가 이미 같은 파티션을 맡은 뒤 옛 consumer가 checkpoint를 덮을 수 있습니다. assignment callback은 새 파티션을 fetch하기 전 위치와 외부 상태를 준비하는 경계입니다.

Kafka 4.3 consumer 설정 문서에는 `group.protocol=classic`과 `group.protocol=consumer`가 함께 표시됩니다. classic은 client의 heartbeat와 session 설정을 중심으로 하고 consumer protocol은 broker가 timing을 관리하는 대안으로 설명됩니다. 이 문서만으로 consumer protocol의 도입 release나 모든 client·broker 호환 조합을 단정하지 않습니다.

## KRaft 메타데이터 쿼럼

KRaft에서 controller들은 metadata quorum을 구성해 topic, partition 배치, broker 등록, leader 배치 같은 metadata를 결정합니다. broker의 partition 로그에는 사용자가 발행한 record가 저장되고 replica가 복제됩니다. 두 로그는 참여자와 권위가 다른 상태 공간입니다.

controller가 세 개라고 해서 주문 topic의 RF가 자동으로 3이 되지 않습니다. 반대로 user partition의 ISR이 세 개라고 해서 controller quorum이 건강하다는 뜻도 아닙니다. 두 숫자는 모두 여러 사본을 세는 것처럼 보이지만 각각 metadata와 user data의 다른 상태를 나타냅니다.

Kafka 4.3 KRaft 문서는 process role을 broker, controller, 또는 두 역할을 함께 수행하는 combined mode로 설명합니다. quorum availability에는 majority가 필요하고 N개 장애를 견디는 목표에는 2N+1 sizing이 사용됩니다. 중요한 production에서 combined mode를 권장하지 않는다는 문서 경계와 소규모 개발 구성을 구별해야 합니다.

## 상태 추적 예제

다음은 실행 결과가 아닌 숫자 trace입니다. broker B0·B1·B2, RF=3, P0·P1 두 partition, `account-7`의 고정된 key가 P0으로 간다고 가정합니다. E1과 E2는 P0의 offset 10과 11에 append됩니다.

| 시점 | Partition 상태 | Consumer 상태 | 분리해서 읽을 의미 |
|---|---|---|---|
| T0 | leader B0, ISR={B0,B1,B2} | committed=10, position=10 | 10부터 읽을 준비 |
| T1 | E1이 P0 offset 10 | 아직 poll 전 | append와 복제 확인을 별도 관찰 |
| T2 | E2가 P0 offset 11 | poll 뒤 position=12 | 두 record 전달과 업무 완료는 다름 |
| T3 | ISR 전체가 E1·E2를 따라잡음 | committed=10 | 복제 경계와 group checkpoint가 다름 |
| T4 | 외부 효과 E1만 성공 | effect watermark=11 후보 | E2가 끝나지 않아 12 commit 불가 |
| T5 | E1·E2 모두 성공 | committed=12 가능 | 12 미만의 필요한 효과가 끝남 |

T4의 후보가 11인 이유는 offset 10의 다음 위치가 11이기 때문입니다. E2가 먼저 끝났어도 E1이 실패한 상태에서 12를 commit하면 E1을 건너뜁니다. 반대로 watermark는 앞선 외부 효과가 끝날 때까지 commit을 늦출 뿐, 병렬 worker가 E2를 먼저 DB에 적용한 사실을 되돌리지 않습니다.

같은 표에 controller metadata commit을 넣지 않은 것은 의도적입니다. metadata가 T2에 commit되었더라도 E2의 DB 반영을 뜻하지 않습니다. 장애 분석에서는 metadata quorum의 상태, partition leader epoch·ISR·HW, consumer committed offset, 외부 effect watermark를 각각 보존해야 합니다.

## 설계 판단의 기준

“consumer를 다섯 개로 늘리면 처리량이 다섯 배가 된다”는 말은 partition 수, hot key, 하위 DB 용량을 빠뜨립니다. 파티션이 세 개면 같은 group에서 동시에 맡을 수 있는 단위도 최대 세 개이고, 한 key가 한 파티션에 몰리면 그 key의 순서와 처리 용량이 병목이 됩니다.

“offset 100이 가장 최신 이벤트다”라는 말도 partition과 group을 생략합니다. P0의 offset 100과 P1의 offset 100은 서로 다른 위치이며, group committed 100은 그 group이 100부터 재시작한다는 checkpoint일 뿐입니다.

“RF=3이면 성공한 모든 record가 항상 세 사본에 있다”는 말 역시 당시 ISR, `acks`, min ISR, leader 선출 정책을 확인하지 않은 주장입니다. 논리 eventId, producer 결과, broker log, consumer visibility, 외부 effect를 서로 다른 관측 항목으로 남기는 것이 운영 가능한 모델의 출발점입니다.

## 참고 자료와 검증 범위

- [Apache Kafka 4.3 Introduction](https://kafka.apache.org/43/getting-started/introduction/): 2026-09-17 확인. Kafka 4.3 문서. topic의 지속 보관, partition 분할, broker, partition 내부 순서와 복제의 기초 근거입니다.
- [Kafka 4.3 Replication Design](https://kafka.apache.org/43/design/design/): 2026-09-17 확인. Kafka 4.3 문서. RF가 leader를 포함한다는 점, leader·follower·ISR, crash/recovery 가정과 기록 보존 경계의 근거입니다.
- [Kafka 4.3 Topic Configs](https://kafka.apache.org/43/configuration/topic-configs/): 2026-09-17 확인. Kafka 4.3 문서. `min.insync.replicas`, `acks=all`, cleanup 정책과 consumer visibility 경계의 근거입니다.
- [Kafka 4.3 KafkaConsumer Javadoc](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html): 2026-09-17 확인. Kafka client API 4.3.1 문서. position, committed offset, group 할당과 thread 계약의 근거입니다.
- [Kafka 4.3 Consumer Configs](https://kafka.apache.org/43/configuration/consumer-configs/): 2026-09-17 확인. Kafka 4.3 문서. group protocol 선택지와 `max.poll.interval.ms`의 근거입니다.
- [Kafka 4.3 KRaft](https://kafka.apache.org/43/operations/kraft/): 2026-09-17 확인. Kafka 4.3 문서. broker/controller/both role, metadata quorum, majority, 2N+1, combined mode 경계의 근거입니다.

실제 Kafka cluster, broker 장애, consumer rebalance, leader election은 이 작업에서 실행하지 않았습니다. 표와 trace는 예상 상태이며 실행 증거가 아닙니다. 2026-09-17에 확인한 공식 자료만으로는 4.3.1을 현재 최신 또는 지원 릴리스라고 판정할 수 없고, consumer protocol의 도입 release와 호환성 조합도 확정하지 않았습니다.

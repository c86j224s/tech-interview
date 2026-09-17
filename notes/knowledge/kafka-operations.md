---
id: kafka-operations
title: Kafka 운영과 변경 관리
topic: 분산 시스템
summary: Kafka 소비 지연, 복제 장애, 보존·재생, 파티션 변경을 관측값과 중단 조건으로 연결해 운영 판단과 복구 순서를 세웁니다.
questionIds: []
prerequisites: [kafka-foundations, kafka-application, operations-foundations]
related: [kafka-consumer-offset, kafka-replication-acks, kafka-retained-state, kafka-partition-order, kraft-control-plane]
reviewedAt: '2026-09-17'
---

# Kafka 운영과 변경 관리

## 운영 모델과 증거

Kafka 운영에서 가장 위험한 말은 “lag가 0이므로 처리가 끝났다”와 “producer가 성공했으므로 데이터가 안전하다”입니다. lag, 복제 상태, 외부 효과, KRaft metadata quorum은 서로 다른 상태 공간입니다. 운영자는 단일 상태 표시 대신 입력량, 처리량, partition별 position과 committed offset, in-flight 효과, ISR, leader epoch와 오류를 함께 봐야 합니다.

이 장은 2026-09-17에 확인한 Apache Kafka 4.3 공식 문서와 Kafka client API 4.3.1 문서를 기준으로 합니다. 이 문서 버전은 적용 범위이지 현재 최신 release나 지원 기간을 판정한 결과가 아닙니다. 수치와 시퀀스는 실제 Kafka 장애 관측 결과가 아니라 문서 계약을 따른 예상 상태입니다.

운영 순서는 관측값 보존, 영향 범위 분리, 안전한 중단 조건 확인, 최소 변경, 결과 대조로 잡습니다. consumer scale-out, ISR 축소, retention 변경, partition 증설을 같은 종류의 설정 변경으로 다루지 않아야 각 변경의 손실 경계를 보존할 수 있습니다.

## 소비 지연의 계측

partition의 `log end`와 group committed offset 사이의 차이는 broker에 남은 backlog의 한 단면입니다. poll position이 이미 앞서 있거나 worker queue에 일이 쌓이면 broker lag가 작아 보여도 외부 효과는 늦을 수 있습니다. 반대로 DB 효과가 끝났지만 commit 응답이 지연되면 lag가 크게 남을 수 있습니다.

최소한 partition별 input rate, processing rate, client position, group committed, effect watermark, 가장 오래된 in-flight 작업의 나이, retry·격리 큐 비율, rebalance duration을 별도 series로 둡니다. 시계 기준을 통일해야 “몇 건 남았는가”와 “언제부터 처리되지 않았는가”를 같이 읽을 수 있습니다.

P0의 log end가 200, committed가 180, position이 200, effect watermark가 175라면 단순 lag 20보다 외부 효과 미완료 구간 25가 더 중요한 신호입니다. 반대로 committed가 180, position이 180, effect watermark가 180이면 lag 20은 아직 읽지 않은 입력을 뜻할 뿐 이미 처리한 입력의 지연은 아닙니다.

```diagram
{"title":"Kafka 지연을 네 위치로 나누는 흐름","caption":"log end와 committed의 차이는 전체 처리 완료를 뜻하지 않습니다. position, effect watermark, committed를 각각 관찰합니다.","rows":[[{"id":"logend","label":"Partition log end","detail":["새 입력 끝 경계"]}],[{"id":"position","label":"Consumer position","detail":["다음 fetch 위치"]}],[{"id":"effect","label":"Effect watermark","detail":["외부 효과 연속 완료"]}],[{"id":"commit","label":"Group committed","detail":["재시작 checkpoint"]}]],"edges":[{"from":"logend","to":"position","label":"poll로 수신"},{"from":"position","to":"effect","label":"worker 처리"},{"from":"effect","to":"commit","label":"연속 완료 commit"}]}
```

lag 0도 queue가 비어 있고 외부 효과가 완료되었다는 조건과 함께 해석해야 합니다. 자동 commit이나 poll 직후 commit은 client가 전달한 위치를 저장할 뿐 업무 결과를 검사하지 않습니다. 대시보드에서 position, committed, effect watermark를 같은 색으로 합치지 않는 것이 진단에 유리합니다.

## Backpressure와 poll 수명

입력 속도가 초당 1,000건이고 외부 DB가 초당 700건만 처리하면 처리하지 못한 300건이 계속 늘어납니다. worker queue를 무한히 키우면 broker lag는 줄어 보일 수 있지만 heap 사용량과 작업 대기 시간이 커집니다. bounded queue는 수용량을 제한하고 한계에 도달하면 해당 partition을 pause해 더 받는 속도를 늦추는 경계를 제공합니다.

`pause`는 partition fetch를 일시 조절할 뿐 group에서 나가거나 소유권을 포기하는 동작이 아닙니다. consumer thread는 계속 `poll()`을 호출해 group protocol과 assignment 관리를 유지해야 합니다. `max.poll.interval.ms`를 넘는 긴 처리는 group failure와 rebalance 경로가 될 수 있으며 Kafka 4.3 consumer 문서에서 확인한 기본값은 300,000ms입니다.

static membership은 poll deadline을 넘긴 직후 partition이 새 consumer로 즉시 넘어가지 않고 session 만료까지 지연될 수 있는 별도 경계를 만듭니다. 이것은 외부 작업이 자동 취소되거나 효과가 한 번만 실행된다는 뜻이 아닙니다. static member의 지연과 processing timeout, oldest in-flight age를 별도 지표로 남깁니다.

consumer 수를 늘리는 판단은 queue 하나의 길이만으로 하지 않습니다. partition이 세 개인데 consumer가 여덟 개면 같은 group의 활성 처리 단위는 최대 세 개입니다. 한 hot key가 입력의 90%를 차지하면 consumer를 늘려도 해당 key의 파티션 순서와 하위 DB lock이 병목으로 남을 수 있습니다.

## 연속 완료 watermark

P0에서 10·11·12를 poll했고 worker가 11과 12만 성공했다고 하겠습니다. client position은 13일 수 있지만 안전한 commit 후보는 10입니다. 10의 외부 효과가 끝나지 않았는데 13을 commit하면 10을 건너뛰게 됩니다. offset 최댓값이 아니라 실제 전달 순서에서 앞쪽으로 끊김 없이 완료된 다음 위치를 사용합니다.

운영 로그에는 `deliveredOffsets=[10,11,12]`, `completed={11,12}`, `nextCommit=10`과 같이 중간 상태를 남길 수 있어야 합니다. 실제 전달된 record가 없는 offset gap을 완료 집합에 넣지 않습니다. compaction, control record, retention으로 숫자 사이에 빈 곳이 생기는 것과 실패한 업무 작업은 다릅니다.

worker가 11·12를 먼저 외부에 적용한 사실은 watermark가 10에서 멈춘다고 사라지지 않습니다. 순서가 업무 의미라면 key별 직렬화 또는 DB의 expected sequence 조건을 추가해야 합니다. watermark는 commit 누락을 막는 경계이지 병렬 외부 효과의 순서를 재배열하는 장치가 아닙니다.

실패한 작업을 무한 재시도하면 해당 partition 전체가 멈출 수 있습니다. 재시도 횟수, backoff, 격리 큐로 보낼 조건, 원본 보존 기간과 재처리 경로를 데이터 손실 정책으로 정합니다. 격리 큐로 옮긴 record가 업무상 성공한 것은 아니므로 처리율과 격리율을 분리합니다.

## Rebalance와 작업 소유권

정상 revoke는 assignment를 넘기기 전에 호출되는 handoff 경계입니다. 새 작업 투입을 멈추고 bounded drain을 수행한 뒤, 현재 소유권을 가진 동안 연속 완료된 next offset만 commit합니다. 시간 제한 안에 끝나지 않은 작업은 성공으로 표시하지 않고 재시작 시 재전달 가능한 상태로 남깁니다.

lost는 session 만료나 치명적인 group 오류 뒤 이미 partition 소유권을 잃었을 수 있는 경계입니다. 다른 consumer가 같은 partition을 맡았을 수 있으므로 lost callback을 마지막 commit 기회로 사용하지 않습니다. 늦은 worker 결과에는 assignment generation을 붙여 현재 generation과 다르면 결과 반영과 commit을 막습니다.

```diagram
{"title":"Rebalance에서 소유권이 이동하는 경계","caption":"정상 revoke는 소유권을 넘기기 전 정리 기회이고 lost는 이미 잃었을 수 있는 통지입니다. 옛 consumer는 lost 뒤 commit하지 않습니다.","rows":[[{"id":"old","label":"기존 consumer","detail":["P0 소유","worker 실행"]}],[{"id":"revoke","label":"정상 revoke","detail":["신규 투입 중지","연속 완료 commit"]},{"id":"lost","label":"소유권 lost","detail":["다른 owner 가능","commit 금지"]}],[{"id":"new","label":"새 consumer","detail":["assignment 수신","로그에서 재전달"]}]],"edges":[{"from":"old","to":"revoke","label":"정상 반납"},{"from":"revoke","to":"new","label":"checkpoint handoff"},{"from":"old","to":"lost","label":"session 만료"}]}
```

세대 검사는 이미 시작한 HTTP나 DB 호출을 소급해 취소하지 않습니다. 외부 저장소에는 eventId 중복 방지와 entity version 조건이 필요합니다. 새 consumer는 assignment callback 뒤 초기 position과 외부 처리 상태를 대조하고, log start보다 앞선 위치라면 조용히 latest로 보내지 않습니다.

cooperative rebalance는 일부 partition을 단계적으로 이동시킬 수 있지만 client·assignor·group protocol에 따른 callback 범위를 확인해야 합니다. 반납 대상의 queue와 generation을 계속 소유한 partition과 섞지 않습니다. cooperative나 static membership이 외부 DB 효과를 자동으로 한 번만 실행해 주는 것은 아닙니다.

## ISR 축소와 leader 장애

RF=3, `ISR={L,F1,F2}`, min ISR=2에서 F2가 뒤처져 ISR 밖으로 나가면 현재 write 집합은 `{L,F1}`입니다. `acks=all`은 현재 ISR member 전체의 확인을 기다리므로 이 상태에서는 L과 F1이 기준입니다. F1까지 빠져 ISR이 `{L}`이 되면 min ISR=2 조건의 write 거절 경계가 생깁니다.

장애 시에는 producer response, 당시 ISR, leader epoch, high watermark, broker log와 consumer visibility를 장애 시각에 저장합니다. `NotEnoughReplicas`와 `NotEnoughReplicasAfterAppend`를 같은 상태로 뭉뚱그리지 않고 append 전후를 기록합니다. timeout이나 ACK 유실은 record가 broker에 없다고 확정하지 않습니다.

ELR(Eligible Leader Replicas)은 leader 후보를 별도로 추적하는 모델입니다. Kafka 4.3 문서는 ISR, unfenced ELR, 최근 leader 후보를 구분하고 ISR이 min ISR 아래로 떨어질 때 high watermark 진행이 막힐 수 있음을 설명합니다. 현행 cluster에서 ELR 상태를 확인하지 않은 채 stale replica의 unclean election만으로 선출 결과를 예측하지 않습니다.

`unclean.leader.election.enable` 기본값은 Kafka 4.3 broker 설정 문서에서 false로 확인됩니다. 이를 허용하면 ISR 밖 replica를 마지막 수단으로 leader로 올려 가용성을 회복할 수 있지만 data loss 가능성이 생깁니다. 재생성 가능한 알림 로그와 금액·재고 원장을 같은 설정으로 처리하지 않습니다.

## 복제 장애 복구 순서

첫 단계는 상태를 바꾸지 않고 증거를 보존하는 것입니다. partition별 old leader, leader epoch, RF, ISR, min ISR, high watermark, producer의 성공·실패·timeout record ID, consumer group committed와 외부 effect를 같은 시각 기준으로 수집합니다. controller metadata도 user partition record와 분리합니다.

둘째, 새 leader가 선출되면 새 leader log에 성공 응답 record와 응답이 유실된 불확정 record가 있는지 대조합니다. consumer가 이미 효과를 실행했는지는 eventId inbox와 외부 원장에서 확인합니다. broker log에 없다는 결과만으로 외부 효과를 취소하거나 broker에 있다는 결과만으로 외부 효과가 완료됐다고 부르지 않습니다.

셋째, 손실 가능성과 서비스 재개를 결정합니다. ISR 또는 안전한 ELR이 살아 있어 committed record를 이어갈 수 있으면 보존을 우선합니다. stale candidate만 남은 상태에서 unclean election을 켜는 것은 record 손실 가능성을 승인하는 행위이므로, 영향 범위·재생·대사 계획 없이 명령만 실행하지 않습니다.

넷째, 복구 뒤 record ID 집합, partition offset, consumer effect watermark, duplicate와 missing 결과를 대조합니다. “leader가 살아났다”로 복구 보고를 끝내지 않고 producer, broker, consumer, 외부 시스템의 네 결과를 별도 보고합니다.

## Retention과 replay 운영

`delete` 정책은 시간과 크기에 따라 오래된 segment를 제거하고 `compact` 정책은 같은 key의 옛 record를 정리해 최신 상태 재구성을 돕습니다. compaction은 background 처리이므로 설정 시간이 되자마자 모든 옛 record가 사라지거나 key당 정확히 한 record만 남는다고 가정하지 않습니다.

`compact,delete` 조합에서는 최신 key record도 오래된 segment 삭제의 영향을 받을 수 있습니다. tombstone은 non-null key와 null value로 해당 key 삭제를 전파하는 record이며 null key와는 다른 개념입니다. 오래 중단한 cache가 tombstone을 놓쳤다면 latest 위치로 이동해 문제를 숨기지 말고 snapshot 또는 key-set reconciliation을 선택합니다.

snapshot에는 source version과 partition별 next offset을 함께 기록하고 snapshot 이후의 write와 delete가 빠지지 않도록 그 경계를 원자적으로 다룹니다. 재생 위치가 log start보다 앞서면 재생 가능 범위를 먼저 판정합니다. 전체 이력이 필요하다면 compacted topic만으로 감사 기록을 복원할 수 없으므로 원본 event history를 별도 보관합니다.

cleanup timing, cleaner 지표, compacted topic에서 null key record를 처리하는 client별 계약은 이번 확인 범위에서 확정하지 않았습니다. 이 세부 동작을 운영 명령이나 복구 보장으로 바꾸기 전에 실제 적용 version과 공식 자료를 다시 고정해야 합니다.

## 파티션 증설과 topic 변경

파티션을 3개에서 6개로 늘려도 기존 record가 새 partition으로 자동 이동하지 않습니다. key hash에 partition 수가 들어가는 routing에서는 같은 key의 신규 record 목적지가 달라질 수 있습니다. 예를 들어 해시 결과를 4로 고정한 설명에서는 3개일 때 `4 mod 3 = 1`인 P1, 6개일 때 `4 mod 6 = 4`인 P4가 됩니다. 이 숫자는 실제 client hash 측정값이 아니라 routing 변화 관계를 설명하는 입력입니다.

old P1의 E2가 외부에 아직 적용되지 않았는데 new P4의 E3가 먼저 처리되면 같은 key의 업무 순서가 뒤집힐 수 있습니다. P1 offset 101과 P4 offset 0은 서로 다른 partition 위치이므로 전역 비교를 할 수 없습니다. 신규 partition 발견 시점과 `auto.offset.reset=latest` 경계도 증설 계획에 포함합니다.

검증 가능한 변경은 stop-drain-switch-reconcile 순서를 갖습니다. stop에서 producer 발행 gate를 닫고 in-flight send와 metadata refresh를 정리합니다. drain에서 old partition별 마지막 input 위치, effect watermark, retry와 worker queue를 확인합니다. switch에서 새 routing generation을 활성화하고 reconcile에서 eventId·entitySequence·누락·중복을 대조합니다.

새 topic dual publish를 선택하면 old와 new offset을 같은 사건 번호처럼 기록하지 않습니다. old last input/effect barrier, new first input, source generation과 logical eventId를 함께 남깁니다. 한쪽만 성공한 dual publish는 outbox와 대사로 복구하며, new-only 변경을 old로 rollback하면 그 변경을 잃을 수 있는 복구 창을 먼저 계산합니다.

## KRaft metadata 운영

KRaft controller quorum은 topic·partition 구성과 broker 등록 같은 metadata를 결정하고, user partition broker는 실제 record와 replica를 다룹니다. controller quorum majority 손실, user partition leader 손실, consumer effect failure를 하나의 “Kafka 장애”로 집계하지 않습니다.

controller와 broker 역할을 분리하면 CPU, memory, disk, network의 공통 경합을 줄일 가능성이 있지만 별도 장애 영역과 노드 비용이 생깁니다. combined mode에서는 produce와 replication I/O가 metadata 합의와 경쟁할 수 있으므로 metadata 응답과 user data p99를 각각 측정합니다.

Kafka 4.3 KRaft 문서는 broker, controller, combined role, controller quorum majority, 2N+1 sizing을 설명하고 중요한 production에서 combined mode를 권장하지 않는 경계를 둡니다. 그러나 이번 확인 범위의 KRaft 페이지에는 metadata quorum과 data directory를 함께 잃은 상황의 지원되는 command-level disaster recovery 절차가 없습니다. 임의 cluster ID 초기화나 storage format 변경을 복구라고 부르지 않습니다.

복구 뒤에는 cluster ID, node ID, metadata 상태, partition assignment, leader epoch, ISR, HW, consumer committed, 외부 원장을 차례로 대조합니다. controller metadata commit이 user record commit이나 DB effect를 확인해 주는 것은 아닙니다.

## 운영 변경의 승인 순서

운영 변경 전에 변경 목적과 허용 손실을 한 문장으로 씁니다. 현재 partition·group·replica·retention·routing generation을 저장하고 rollback이 실제로 되돌리는 범위를 계산합니다. 데이터가 이미 new generation으로 생겼다면 설정을 되돌리는 일만으로 old 상태로 복귀하지 않습니다.

staging에서 실제 broker·client version을 고정하고 protocol, rebalance, commit, LSO, leader election과 retention을 시험합니다. production에서는 작은 범위와 관측 창을 정하고 중단 조건을 선언합니다. 변경 뒤 record ID, effect watermark, duplicate·missing, ISR·leader epoch, oldest age를 before 상태와 비교합니다.

중단 조건에는 새 leader가 선출되지 않음, ISR이 min ISR 아래로 계속 감소, oldest in-flight age가 업무 허용 창 초과, effect watermark가 committed보다 뒤짐, old/new reconciliation에 missing 발생처럼 상태와 영향이 함께 들어가야 합니다. 단순히 명령이 성공했다는 출력은 충분한 증거가 아닙니다.

## 참고 자료와 검증 범위

- [Apache Kafka 4.3 KafkaConsumer Javadoc](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html): 2026-09-17 확인. Kafka client API 4.3.1 문서. position, committed offset, commit과 consumer thread 경계의 근거입니다.
- [Apache Kafka 4.3 ConsumerRebalanceListener Javadoc](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/ConsumerRebalanceListener.html): 2026-09-17 확인. Kafka client API 4.3.1 문서. revoke, assigned, lost의 소유권 경계 근거입니다.
- [Apache Kafka 4.3 Consumer Configs](https://kafka.apache.org/43/configuration/consumer-configs/): 2026-09-17 확인. Kafka 4.3.X 문서. `max.poll.interval.ms`, group protocol, static membership 관련 설정의 근거입니다.
- [Apache Kafka 4.3 Replication Design](https://kafka.apache.org/43/design/design/): 2026-09-17 확인. Kafka 4.3 문서. RF, ISR, committed record와 leader 장애 모델의 근거입니다.
- [Apache Kafka 4.3 Topic Configs](https://kafka.apache.org/43/configuration/topic-configs/): 2026-09-17 확인. Kafka 4.3 문서. cleanup 정책, min ISR, consumer visibility의 근거입니다.
- [Apache Kafka 4.3 Broker Configs](https://kafka.apache.org/43/configuration/broker-configs/): 2026-09-17 확인. Kafka 4.3 문서. unclean leader election 설정과 손실 경계의 근거입니다.
- [Apache Kafka 4.3 Eligible Leader Replicas](https://kafka.apache.org/43/operations/eligible-leader-replicas/): 2026-09-17 확인. Kafka 4.3 문서. ELR 후보와 high watermark 제약의 근거입니다.
- [Apache Kafka 4.3 Basic Kafka Operations](https://kafka.apache.org/43/operations/basic-kafka-operations/): 2026-09-17 확인. Kafka 4.3 문서. 파티션 증설, 기존 데이터 자동 재배치 없음, 신규 partition 발견 경계의 근거입니다.
- [Apache Kafka 4.3 KRaft](https://kafka.apache.org/43/operations/kraft/): 2026-09-17 확인. Kafka 4.3 문서. process role, metadata quorum, majority, 2N+1, combined mode 경계의 근거입니다.

실제 consumer scale-out, broker 장애, leader election, retention cleaner, partition cutover, KRaft recovery는 이 작업에서 실행하지 않았습니다. 표와 숫자 trace는 예상 상태이며 실행 증거가 아닙니다. Kafka 4.3.1을 현재 최신 또는 지원 릴리스라고 판정할 공식 lifecycle 근거와 consumer protocol 도입 release·호환성 표는 확보하지 못했으므로 이 글에서는 주장하지 않습니다.

---
id: kafka-transaction-scope
title: Kafka Producer 중복·Transaction·외부 DB의 범위
topic: 분산 시스템
summary: PID·epoch·sequence와 논리 이벤트를 구분하고 in-flight 설정·transactional.id fencing·read_committed·LSO·DB inbox/outbox를 설명합니다.
questionIds: [kafka-idempotent-producer, kafka-idempotence-inflight-order, kafka-transactional-id-fencing, kafka-multipartition-transaction-read, kafka-transactions-external-db, kafka-open-transaction-lso-delay]
---

# Kafka Producer 중복·Transaction·외부 DB의 범위

## Broker에 저장됐지만 ACK가 유실되면 같은 배치를 재전송합니다

broker에 배치가 먼저 기록됐지만 ACK가 유실되면 producer는 같은 배치를 다시 보냅니다. idempotent producer는 producer ID·epoch·partition별 sequence를 비교해 이 재전송을 식별하고 중복 append를 줄입니다. 반대로 앱이 같은 payload를 두 번 새 이벤트로 만들어 다른 sequence로 보내면 Kafka는 이를 같은 전송으로 식별하지 않으므로, producer 전송 중복과 주문·포인트의 논리 중복을 따로 막아야 합니다.

consumer가 Kafka 레코드를 읽고 DB transaction을 commit한 직후, Kafka offset을 저장하기 전에 죽을 수 있습니다. 재시작한 consumer는 저장되지 않은 offset부터 같은 레코드를 다시 읽으므로 DB 변경도 다시 시도될 수 있습니다. producer idempotence는 이 소비 시점과 외부 DB 효과까지 자동으로 한 번으로 만들지 않으므로 DB inbox·effect key 같은 별도 경계가 필요합니다.

## In-flight·ACK·Retry 설정을 한 계약으로 봅니다

일반적으로 Kafka Java client에서 기대하는 idempotence는 acks=all, retries>0, max.in.flight.requests.per.connection<=5처럼 여러 설정이 함께 맞아야 하는 계약입니다. 예를 들어 in-flight 요청 수나 ACK 조건을 임의로 바꾸면 이 문서의 재전송·순서 설명을 같은 방식으로 적용할 수 있는지 다시 판단해야 합니다.

사용 client·broker 버전의 정확한 제한·기본값·명시적 idempotence와 충돌 설정 처리를 확인하고, 다른 언어 client에 숫자만 복사하지 않습니다.

idempotence 없이 여러 배치가 in-flight일 때 앞 배치가 실패·재시도되고 뒤 배치가 먼저 append되면 순서가 바뀔 수 있습니다. compatible idempotent 설정은 해당 producer·partition의 sequence 계약을 유지하는 데 도움되지만 여러 producer의 업무 생성 순서를 전역으로 만들지는 않습니다.

| 중복·순서 | 식별 근거 | 별도 책임 |
| --- | --- | --- |
| 같은 producer 배치 재전송 | PID·epoch·sequence | client 설정·유효 세션 |
| 앱이 같은 주문을 새로 발행 | 업무 event/request ID | producer가 자동 동일시 안 함 |
| consumer DB 재처리 | DB inbox·effect key | 변경과 같은 transaction |
| 외부 HTTP 결제 | 제공자 멱등 키·조회 | Kafka transaction 밖 |

## Transactional ID는 논리 Producer 소유권을 연결합니다

안정 transactional.id는 재시작한 논리 producer와 이전 실행의 fencing에 사용합니다. 같은 ID의 새 producer가 초기화되어 epoch가 바뀌면 옛 producer의 작업이 fenced될 수 있습니다. 소유권 상실 오류를 단순 네트워크 오류처럼 무한 재시도하지 않습니다.

동시에 독립적으로 활동해야 할 producer들이 같은 ID를 무심코 공유하면 서로를 차단할 수 있습니다. ID 배정·재시작·인스턴스 겹침의 의미를 정합니다. 이 fencing은 Kafka 생산·transaction 경계이며 외부 DB에 이미 보낸 옛 쓰기를 차단하지는 않습니다.

```diagram
{"title":"Kafka 안의 원자 범위와 외부 DB를 분리합니다","caption":"화살표는 입력·결과 처리입니다. 출력과 소비 offset은 Kafka transaction에 묶을 수 있지만 외부 DB commit은 그 참가자가 자동으로 되지 않습니다.","rows":[[{"id":"input","label":"Kafka 입력 레코드"}],[{"id":"tx","label":"Kafka transaction","detail":["출력 partition들","소비 offset"]},{"id":"db","label":"외부 DB 거래","detail":["inbox·업무 변경·outbox"]}],[{"id":"consumer","label":"read_committed 소비"}]],"edges":[{"from":"input","to":"tx","label":"Kafka 변환 경로"},{"from":"input","to":"db","label":"DB 효과 경로"},{"from":"tx","to":"consumer","label":"commit 출력 가시성"}]}
```

## Read_committed는 여러 Partition을 한 Poll에 묶지 않습니다

Kafka transaction은 관련 출력 records와 소비 group offset을 commit·abort 경계로 묶을 수 있습니다. read_committed 소비자는 aborted 출력을 업무 레코드로 받지 않도록 합니다. 그러나 한 transaction의 모든 partition 결과가 단일 poll·단일 consumer·한 외부 DB transaction으로 동시에 전달되는 것은 아닙니다. 여러 poll과 consumer에 걸친 적용 원자성은 앱의 별도 요구입니다.

앞쪽 Kafka transaction이 아직 commit·abort되지 않은 상태라면 read_committed consumer는 그 transaction의 결과가 정해질 때까지 이후 offset의 레코드를 업무 레코드로 넘기지 않을 수 있습니다. 이때 LSO(last stable offset)는 그런 미결정 transaction의 시작 offset을 넘지 않는 읽기 경계이고, high watermark는 복제가 확정된 경계라서 둘의 의미가 다릅니다.

consumer position은 다음 fetch에서 사용할 현재 읽기 위치이고 committed offset은 consumer group에 저장한 위치이므로 LSO와 같은 값이라고 보면 안 되며, 열린 transaction 뒤의 기록까지 기다리면서 consumer가 멈춘 것처럼 보일 수 있습니다.

외부 API의 긴 대기를 Kafka transaction 안에 넣으면 외부 원자성은 얻지 못하면서 LSO·timeout·coordinator 비용을 늘릴 수 있습니다. transaction 길이·batch·timeout·abort·commit 응답 유실을 관리합니다.

## DB 먼저와 Kafka 먼저에는 각각 실패 틈이 있습니다

DB commit 뒤 Kafka commit 전에 죽으면 DB 효과는 남고 입력은 다시 처리됩니다. Kafka commit 뒤 DB가 실패하면 출력·offset만 전진할 수 있습니다. 순서를 바꾸는 것으로 두 시스템이 하나의 transaction이 되지는 않습니다.

외부 DB가 권위라면 event ID inbox·업무 변경·결과 outbox를 같은 DB transaction에 넣고 이후 offset을 전진시키는 구조를 사용할 수 있습니다. outbox 발행은 중복될 수 있어 다음 소비자도 멱등해야 합니다. DB 조회만 하고 출력을 만들어도 재시도 때 원본값이 달라질 수 있으므로 어떤 version·snapshot을 변환하는지 정합니다.

## 물리 레코드 수와 논리 효과 수를 따로 셉니다

ACK 유실 재전송, producer 완전 재시작, 같은 업무의 새 이벤트, transactional.id 중첩, 열린 transaction, DB commit 뒤 중단을 나누어 시험합니다. broker log·read_committed 결과·group offset·DB 원장·외부 효과를 각각 대조합니다.

현재 작업에서는 Kafka producer·transaction을 실행하지 않았습니다. 본문은 보장 범위를 설명하며 설정 호환성과 LSO 동작은 실제 사용 버전에서 검증해야 합니다.

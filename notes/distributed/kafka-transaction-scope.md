---
id: kafka-transaction-scope
title: Kafka Producer 중복·Transaction·외부 DB의 범위
topic: 분산 시스템
summary: PID·epoch·sequence와 논리 이벤트를 구분하고 in-flight 설정·transactional.id fencing·read_committed·LSO·DB inbox/outbox를 설명합니다.
questionIds: [kafka-idempotent-producer, kafka-idempotence-inflight-order, kafka-transactional-id-fencing, kafka-multipartition-transaction-read, kafka-transactions-external-db, kafka-open-transaction-lso-delay]
---

# Kafka Producer 중복·Transaction·외부 DB의 범위

이 노트는 Kafka가 중복 전송을 판별하는 물리적 producer 상태와 애플리케이션이 같은 업무 효과인지 판별하는 논리적 ID를 분리합니다. Kafka transaction의 원자 범위도 외부 DB나 HTTP 효과까지 자동으로 확장되지 않으므로, 각 시스템의 commit 경계와 재시도 경계를 시간 순서로 따라가야 합니다.

## Broker 저장 후 ACK 유실에 따른 배치 재전송

broker에 배치가 먼저 기록됐지만 ACK가 유실되면 producer는 같은 배치를 다시 보냅니다. idempotent producer는 producer ID·epoch·partition별 sequence를 비교해 이 재전송을 식별하고 중복 append를 줄입니다. 반대로 앱이 같은 payload를 두 번 새 이벤트로 만들어 다른 sequence로 보내면 Kafka는 이를 같은 전송으로 식별하지 않으므로, producer 전송 중복과 주문·포인트의 논리 중복을 따로 막아야 합니다.

consumer가 Kafka 레코드를 읽고 DB transaction을 commit한 직후, Kafka offset을 저장하기 전에 죽을 수 있습니다. 재시작한 consumer는 저장되지 않은 offset부터 같은 레코드를 다시 읽으므로 DB 변경도 다시 시도될 수 있습니다. producer idempotence는 이 소비 시점과 외부 DB 효과까지 자동으로 한 번으로 만들지 않으므로 DB inbox·effect key 같은 별도 경계가 필요합니다.

먼저 물리 레코드와 논리 효과를 구분하면 재시도 경로가 단순해집니다. PID·epoch·sequence는 특정 producer session이 특정 partition에 보낸 전송을 식별하지만, “주문 42를 두 번 지급하지 말라”는 업무 의미는 event ID·inbox·effect key가 담당합니다. consumer의 DB commit과 offset commit 사이의 창은 producer idempotence가 닫아 주지 않습니다.

## In-flight·ACK·Retry 설정의 단일 계약

일반적으로 Kafka Java client에서 기대하는 idempotence는 acks=all, retries>0, max.in.flight.requests.per.connection<=5처럼 여러 설정이 함께 맞아야 하는 계약입니다. 예를 들어 in-flight 요청 수나 ACK 조건을 임의로 바꾸면 이 문서의 재전송·순서 설명을 같은 방식으로 적용할 수 있는지 다시 판단해야 합니다.

사용 client·broker 버전의 정확한 제한·기본값·명시적 idempotence와 충돌 설정 처리를 확인하고, 다른 언어 client에 숫자만 복사하지 않습니다.

idempotence 없이 여러 배치가 in-flight일 때 앞 배치가 실패·재시도되고 뒤 배치가 먼저 append되면 순서가 바뀔 수 있습니다. compatible idempotent 설정은 해당 producer·partition의 sequence 계약을 유지하는 데 도움되지만 여러 producer의 업무 생성 순서를 전역으로 만들지는 않습니다.

| 중복·순서 | 식별 근거 | 별도 책임 |
| --- | --- | --- |
| 같은 producer 배치 재전송 | PID·epoch·sequence | client 설정·유효 세션 |
| 앱이 같은 주문을 새로 발행 | 업무 event/request ID | producer가 자동 동일시 안 함 |
| consumer DB 재처리 | DB inbox·effect key | 변경과 같은 transaction |
| 외부 HTTP 결제 | 제공자 멱등 키·조회 | Kafka transaction 밖 |

선택 기준은 client가 제공하는 idempotence 계약을 그대로 사용할 수 있는지와 업무 순서를 어디에서 보장할지입니다. 한 producer·partition의 전송 순서와 여러 producer가 생성한 전역 업무 순서는 다른 문제이므로, 후자를 요구하면 partition key·단일 writer·업무 version 같은 별도 설계가 필요합니다. 설정값은 사용 언어와 client 버전의 공식 계약을 읽은 뒤 적용해야 합니다.

## Transactional ID와 논리 Producer 소유권

안정 transactional.id는 재시작한 논리 producer와 이전 실행의 fencing에 사용합니다. 같은 ID의 새 producer가 초기화되어 epoch가 바뀌면 옛 producer의 작업이 fenced될 수 있습니다. 소유권 상실 오류를 단순 네트워크 오류처럼 무한 재시도하지 않습니다.

동시에 독립적으로 활동해야 할 producer들이 같은 ID를 무심코 공유하면 서로를 차단할 수 있습니다. ID 배정·재시작·인스턴스 겹침의 의미를 정합니다. 이 fencing은 Kafka 생산·transaction 경계이며 외부 DB에 이미 보낸 옛 쓰기를 차단하지는 않습니다.

```diagram
{"title":"Kafka 안의 원자 범위와 외부 DB를 분리합니다","caption":"화살표는 입력·결과 처리입니다. 출력과 소비 offset은 Kafka transaction에 묶을 수 있지만 외부 DB commit은 그 참가자가 자동으로 되지 않습니다.","rows":[[{"id":"input","label":"Kafka 입력 레코드"}],[{"id":"tx","label":"Kafka transaction","detail":["출력 partition들","소비 offset"]},{"id":"db","label":"외부 DB 거래","detail":["inbox·업무 변경·outbox"]}],[{"id":"consumer","label":"read_committed 소비"}]],"edges":[{"from":"input","to":"tx","label":"Kafka 변환 경로"},{"from":"input","to":"db","label":"DB 효과 경로"},{"from":"tx","to":"consumer","label":"commit 출력 가시성"}]}
```

## Read_committed와 다중 Partition Poll의 분리

Kafka transaction은 관련 출력 records와 소비 group offset을 commit·abort 경계로 묶을 수 있습니다. read_committed 소비자는 aborted 출력을 업무 레코드로 받지 않도록 합니다. 그러나 한 transaction의 모든 partition 결과가 단일 poll·단일 consumer·한 외부 DB transaction으로 동시에 전달되는 것은 아닙니다. 여러 poll과 consumer에 걸친 적용 원자성은 앱의 별도 요구입니다.

앞쪽 Kafka transaction이 아직 commit·abort되지 않은 상태라면 read_committed consumer는 그 transaction의 결과가 정해질 때까지 이후 offset의 레코드를 업무 레코드로 넘기지 않을 수 있습니다. 이때 LSO(last stable offset)는 그런 미결정 transaction의 시작 offset을 넘지 않는 읽기 경계이고, high watermark는 복제가 확정된 경계라서 둘의 의미가 다릅니다.

consumer position은 다음 fetch에서 사용할 현재 읽기 위치이고 committed offset은 consumer group에 저장한 위치이므로 LSO와 같은 값이라고 보면 안 되며, 열린 transaction 뒤의 기록까지 기다리면서 consumer가 멈춘 것처럼 보일 수 있습니다.

외부 API의 긴 대기를 Kafka transaction 안에 넣으면 외부 원자성은 얻지 못하면서 LSO·timeout·coordinator 비용을 늘릴 수 있습니다. transaction 길이·batch·timeout·abort·commit 응답 유실을 관리합니다.

읽기 추적에서 consumer position, group committed offset, LSO, high watermark를 네 개의 별도 값으로 적어야 합니다. 미결정 transaction이 앞에 있으면 read_committed가 뒤 레코드를 바로 반환하지 않아 position이 진행되지 않는 것처럼 보일 수 있지만, 이것은 외부 DB가 원자적으로 묶였다는 의미가 아닙니다. 긴 외부 호출을 transaction 안에 넣을지 결정할 때 가시성 지연과 coordinator timeout을 함께 계산합니다.

## DB 선행·Kafka 선행 순서별 실패 구간

DB commit 뒤 Kafka commit 전에 죽으면 DB 효과는 남고 입력은 다시 처리됩니다. Kafka commit 뒤 DB가 실패하면 출력·offset만 전진할 수 있습니다. 순서를 바꾸는 것으로 두 시스템이 하나의 transaction이 되지는 않습니다.

외부 DB가 권위라면 event ID inbox·업무 변경·결과 outbox를 같은 DB transaction에 넣고 이후 offset을 전진시키는 구조를 사용할 수 있습니다. outbox 발행은 중복될 수 있어 다음 소비자도 멱등해야 합니다. DB 조회만 하고 출력을 만들어도 재시도 때 원본값이 달라질 수 있으므로 어떤 version·snapshot을 변환하는지 정합니다.

## 물리 레코드 수와 논리 효과 수의 분리

ACK 유실 재전송, producer 완전 재시작, 같은 업무의 새 이벤트, transactional.id 중첩, 열린 transaction, DB commit 뒤 중단을 나누어 시험합니다. broker log·read_committed 결과·group offset·DB 원장·외부 효과를 각각 대조합니다.

현재 작업에서는 Kafka producer·transaction을 실행하지 않았습니다. 본문은 보장 범위를 설명하며 설정 호환성과 LSO 동작은 실제 사용 버전에서 검증해야 합니다.

실패 시험은 각 경계의 결과를 별도 원장으로 남겨야 합니다. broker에 레코드가 몇 개 있는지, read_committed가 몇 개를 보았는지, group offset이 어디까지 갔는지, DB effect key가 몇 개인지, 외부 API 결과가 확정됐는지를 나란히 비교하면 “중복 레코드”와 “중복 업무 효과”를 구분할 수 있습니다. 이 노트에서는 실제 broker/client를 실행하지 않았으므로 수치 결과는 주장하지 않습니다.

---
id: broker-redelivery
title: JetStream·SQS 재전달과 실행 중 효과의 수명
topic: 분산 시스템
summary: AckWait·BackOff·NAK와 SQS visibility·receipt handle을 구분하고 효과 후 ACK·처리 ID 보관·DLQ·FIFO hot group을 설명합니다.
questionIds: [jetstream-ack-redelivery, jetstream-backoff-nak-policy, jetstream-event-id-retention, sqs-visibility-timeout, sqs-fifo-hot-message-group]
---

# JetStream·SQS 재전달과 실행 중 효과의 수명

## 메시지 재전달과 기존 Worker의 실행 지속

worker A가 40초 동안 DB 작업을 하는데 메시지의 미확인 대기 시간이 30초라면, broker는 A가 끝났는지 알 수 없어 B에게 같은 메시지를 다시 전달할 수 있습니다. 이 시간 제한은 전달 상태를 다시 판단하는 기준일 뿐 A의 프로세스나 DB 호출을 중단시키는 타이머가 아니므로, A와 B가 동시에 같은 효과를 시도할 수 있습니다. 따라서 DB 반영처럼 다시 확인할 수 있는 내구 효과를 먼저 확정하고, 그 뒤 ACK 또는 DeleteMessage를 보내며, 재전달은 같은 논리 event ID로 흡수해야 합니다.

JetStream의 AckWait와 SQS의 visibility timeout은 세부가 다르지만 이 한계는 공통입니다. 효과를 내구 반영한 뒤 ACK 또는 DeleteMessage를 하고, 그 사이 실패의 재전달을 같은 논리 event ID로 흡수해야 합니다.

## JetStream Timeout·명시 실패·진행 신호의 구분

| JetStream 수단 | 의미 | 남는 조건 |
| --- | --- | --- |
| AckWait | ACK가 없을 때 재전달 판단 시간 | 실행 시간의 강제 상한 아님 |
| BackOff | timeout 기반 재전달 간격 목록 | AckWait보다 우선하는 설정 관계 확인 |
| NAK | 명시적인 실패·재전달 요청 | 기본 즉시 또는 별도 지연 API 계약 |
| progress ACK | 처리 중임을 알리고 미확인 기한 연장 | 신호 유실·멈춘 worker 가능 |
| double ACK·AckSync | 서버의 ACK 수신을 추가 확인 | DB commit과 broker ACK의 원자화 아님 |

사용하는 server·client 버전에서 BackOff와 AckWait의 관계를 작은 테스트로 확인합니다. 같은 메시지를 ACK 없이 두고 재전달 시각을 기록해 BackOff의 첫 값이 초기 대기와 이후 간격에 어떻게 적용되는지 비교하고, NAK는 지연 인자를 달리해 별도 간격으로 관찰합니다. MaxDeliver에 도달한 뒤 실제로 원하는 DLQ로 이동하는지 확인한 다음, advisory·원본 ID·오류·시도 이력을 남길 경로와 재처리 경로를 정합니다.

## SQS Receipt Handle과 메시지·이벤트 ID의 구분

ReceiveMessage의 receipt handle은 그 수신 시도의 삭제·visibility 변경에 사용합니다. 재수신하면 새 handle이 생기므로 메시지 ID·업무 event ID와 같은 것으로 쓰지 않습니다. 오래된 handle로 삭제했을 때 성공 응답이 실제 최신 수신을 제거하는 보장인지 제품 계약을 확인하고 최신 수신 handle을 사용합니다.

Standard 큐는 visibility 안에서도 중복 가능성을 완전히 배제하는 독점 계약으로 보지 않습니다. 긴 작업은 지원 한도 안에서 visibility를 연장할 수 있지만 연장 실패·전체 처리 한도·worker pause를 고려합니다. timeout을 길게 하면 정상 중복은 줄 수 있어도 죽은 worker의 복구가 늦습니다.

```diagram
{"title":"효과 Commit과 Broker 완료 사이에는 재전달 틈이 있습니다","caption":"화살표는 정상 처리 순서입니다. DB commit 뒤 ACK·삭제 확인 전 중단되면 재전달될 수 있으므로 처리 ID와 효과를 같은 DB 경계에 기록합니다.","rows":[[{"id":"receive","label":"메시지 수신 시도"}],[{"id":"transaction","label":"DB inbox·효과·결과 commit"}],[{"id":"ack","label":"JetStream ACK 또는 SQS Delete"}],[{"id":"done","label":"broker 완료 확인"}]],"edges":[{"from":"receive","to":"transaction","label":"논리 event ID"},{"from":"transaction","to":"ack","label":"내구 효과 확인"},{"from":"ack","to":"done","label":"응답 유실 가능"}]}
```

## 처리 ID 조회와 동시 중복 방지의 한계

A·B가 각각 미처리 SELECT를 통과할 수 있으므로 inbox unique 삽입과 실제 포인트 변경을 같은 transaction에 넣습니다. 충돌한 쪽은 이미 확정된 결과를 확인하고 효과 없이 ACK합니다. 같은 ID의 다른 payload는 원래 fingerprint·schema·주체와 비교해 충돌로 격리하고 경고해야 합니다.

처리 ID를 1일만 보관하는데 stream이나 수동 replay는 1개월 전 메시지를 재전달할 수 있으면 중복 효과가 다시 생깁니다. 최대 재생·복구·수동 재처리 범위를 보관 정책과 맞추고, 오래된 재처리를 거절할지 영구 업무 키로 판단할지 정합니다. broker 생산 dedup window와 외부 DB inbox 수명은 별개입니다.

## FIFO Hot Group과 Consumer 확장의 한계

SQS FIFO의 message group은 순서 범위입니다. 한 group의 느린 작업이 뒤를 막을 수 있어 consumer를 늘려도 그 group의 순차 제약은 남습니다. 같은 batch 안 여러 메시지의 처리 순서도 앱이 의미를 지켜야 합니다. group을 더 나누려면 서로 독립인 키인지 확인합니다. 잔액·예약처럼 같은 전이에 속한 이벤트를 임의 분산하면 원래 순서 계약을 잃습니다.

독성 메시지를 DLQ로 옮기면 뒤가 진행할 수 있지만 원래 선행 효과를 건너뛴 것이 허용되는지 판단해야 합니다. DLQ는 오류 수정·원본 ID·재생·사용자 미완료를 관리할 곳이지 문제가 해결됐다는 완료 상태가 아닙니다. 대량 redrive는 작은 검증 batch·rate limit·멱등성을 유지합니다.

## 전달 시간·확인 결과·내구 효과의 분리 계측

AckWait 또는 visibility 초과, 연장 유실, DB commit 후 중단, ACK/Delete 응답 유실, MaxDeliver·DLQ, FIFO hot group을 각각 시험합니다. 전달 시도 수와 최종 원장 효과 수·메시지 나이·in-flight·오류·재생 가능 기간을 비교합니다.

현재 작업에서는 JetStream·SQS API나 재전달 시험을 실행하지 않았습니다. 본문은 제품별 신호와 외부 효과의 경계를 설명하며 외부 exactly-once를 주장하지 않습니다.

---
id: sqs-visibility-timeout
title: "SQS 메시지를 처리하는 동안 visibility timeout이 지나 다른 워커도 같은 메시지를 받았습니다. 기존 작업은 중단되며 중복 반영과 메시지 삭제는 어떻게 처리하나요?"
answerMinutes: 5
followups: [{"id":"message-consumer-idempotency","prompt":"삭제 응답 유실로 재전달되면 event ID 처리 기록을 어떤 DB 제약으로 보호하나요?"},{"id":"jetstream-ack-redelivery","prompt":"SQS visibility와 JetStream AckWait의 공통 재전달 경계와 차이는 무엇인가요?"},{"id":"request-timeout-idempotency","prompt":"처리 결과가 불확실할 때 결과 조회와 재시도를 어떤 작업 ID로 연결하나요?"}]
difficulty: 중하
category: 분산 시스템
tags: ["SQS","visibility timeout","메시지"]
related: ["message-consumer-idempotency"]
---

# SQS 메시지를 처리하는 동안 visibility timeout이 지나 다른 워커도 같은 메시지를 받았습니다. 기존 작업은 중단되며 중복 반영과 메시지 삭제는 어떻게 처리하나요?

## 구두 답변

SQS visibility timeout은 메시지를 잠시 숨기지만 워커를 중단하거나 DB 행을 잠그지 않습니다. 워커가 계속 실행 중이어도 시간이 지나면 다른 워커에 재전달될 수 있으므로 독점 실행 보장이 아니라 재전달 판단 시간입니다.

### 반영 뒤 삭제

처리 시간 p99와 장애 복구 목표로 timeout을 정하고 긴 작업은 visibility를 연장할 수 있지만 연장 실패를 전제로 합니다. DB에 결과를 내구 반영한 뒤 삭제하고, DB commit 직후 DeleteMessage 응답이 유실돼 재전달돼도 request/event ID 고유 제약으로 효과를 중복시키지 않습니다. receipt handle은 수신 시도의 삭제용 값이지 논리 작업 ID가 아닙니다.

Standard는 순서·중복을 강하게 보장하지 않고 FIFO도 지정 범위의 계약일 뿐 외부 DB exactly once가 아닙니다. 반복 실패는 DLQ에 원래 ID와 원인을 보존합니다. timeout을 너무 길게 잡으면 죽은 워커 복구가 늦고 짧으면 정상 처리와 중복 경쟁이 늘어납니다. timeout 초과·연장 실패·삭제 응답 유실·워커 중단·FIFO 핫 group을 시험합니다.

### 처리 중 숨김과 실제 독점

visibility를 30초로 설정하고 워커 A가 40초 동안 처리하면 30초 이후 워커 B가 같은 메시지를 받을 수 있습니다. A가 자동 중단되거나 DB 잠금을 잃는 것은 아닙니다. Standard 큐는 visibility 기간에도 중복 가능성을 완전히 배제하는 계약으로 해석하지 않겠습니다. 같은 논리 이벤트 ID로 DB 처리 기록 삽입과 실제 변경을 원자적으로 수행해야 두 워커가 실행돼도 효과가 하나로 남습니다.

ReceiveMessage가 주는 receipt handle은 해당 수신 시도의 삭제·visibility 변경에 사용하는 값입니다. 재수신하면 새 handle이 생기므로 메시지 ID나 업무 요청 ID와 목적을 구분하고, 오래된 handle을 최신 처리의 권위로 재사용하지 않습니다. DB commit 뒤 DeleteMessage가 실패하거나 응답을 잃으면 다시 받을 수 있고, 삭제부터 하면 DB 실패 시 복구할 메시지가 사라질 수 있습니다.

### 연장·DLQ·순서 계약

긴 작업은 진행 상태를 보고 visibility를 연장할 수 있지만 연장 API 자체가 실패하거나 워커가 멈출 수 있습니다. 최대 처리 시간, 연장 주기, 연장 실패 뒤 이미 실행 중인 효과의 정리 정책을 두고 원래 메시지가 다시 전달되어도 안전하게 만듭니다. 연장은 회복 지연을 늘리는 대가이므로 무한히 반복하지 않습니다.

FIFO 큐는 message group 단위 순서와 생산 중복 제거 계약을 제공하지만 외부 DB transaction과 메시지 삭제를 묶지는 않습니다. 한 group의 느린 작업이 뒤 작업을 막을 수 있고 DLQ로 넘기면 업무상 원래 순서가 달라질 수 있습니다. 순서가 필수인 상태 전이라면 독성 메시지를 건너뛰는 것이 허용되는지 먼저 정합니다.

DLQ 재처리에서는 원래 이벤트 ID와 오류·시도 이력을 유지합니다. 문제를 수정하지 않고 대량 재전송하면 같은 실패가 다시 큐를 채울 수 있으므로 작은 배치로 확인합니다. 메시지 나이, in-flight 수, 삭제 성공, 외부 DB 효과 수, DLQ 유입을 나눠 관측하고 보관 만료 전에 복구가 끝나는지 확인하겠습니다.

## 득점 포인트

- 숨김과 워커 실행·DB 잠금을 구분한다.
- 반영 뒤 삭제와 멱등성을 설명한다.
- receipt handle과 논리 ID를 나눈다.
- 큐 종류·DLQ를 검증한다.

## 감점 포인트

- timeout이 워커를 중단한다.
- FIFO가 외부 exactly once다.
- 반영보다 삭제를 먼저 한다.

## 더 파고들 거리

- 긴 timeout 복구 지연
- FIFO 핫 group
- DLQ 순서

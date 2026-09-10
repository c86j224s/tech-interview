---
id: kafka-transactions-external-db
title: "Kafka 메시지를 읽어 외부 DB를 갱신하고 결과를 다른 topic에 발행합니다. Kafka transaction만으로 DB 변경과 offset·결과 발행을 모두 원자적으로 묶을 수 있나요?"
answerMinutes: 5
followups: [{"id":"transactional-outbox","prompt":"DB 상태와 완료 이벤트를 같은 transaction에 넣어 발행 유실을 어떻게 줄이나요?"},{"id":"message-consumer-idempotency","prompt":"Kafka 밖 DB 재처리의 중복 효과를 inbox로 어떻게 막나요?"},{"id":"kafka-idempotent-producer","prompt":"idempotence와 transaction이 producer·consumer 중복을 각각 어떻게 줄이나요?"}]
difficulty: 중하
category: 분산 시스템
tags: ["Kafka","트랜잭션","외부 DB"]
related: ["transactional-outbox","message-consumer-idempotency"]
---

# Kafka 메시지를 읽어 외부 DB를 갱신하고 결과를 다른 topic에 발행합니다. Kafka transaction만으로 DB 변경과 offset·결과 발행을 모두 원자적으로 묶을 수 있나요?

## 구두 답변

Kafka transaction은 Kafka 내부의 출력 record와 소비 offset을 묶을 수 있지만 외부 DB나 HTTP API commit을 자동 포함하지 않습니다. Kafka만 읽고 쓰는 흐름은 한 transaction으로 처리할 수 있지만 DB를 갱신하는 순간 두 시스템 사이 장애 창이 생깁니다.

### 두 순서의 틈

DB를 먼저 commit한 뒤 Kafka transaction 전에 죽으면 DB 효과는 남고 input이 재처리됩니다. Kafka를 먼저 commit하고 DB가 실패하면 Kafka만 성공합니다. DB inbox에 이벤트 ID 고유 제약을 두고 실제 변경과 같은 로컬 transaction에 넣거나 outbox·멱등 API·대사를 사용하겠습니다.

`read_committed`는 중단된 Kafka transaction 출력은 숨기지만 외부 DB를 검증하지 않습니다. transaction이 오래 열리면 last stable offset이 늦어 소비가 지연될 수 있습니다. 같은 `transactional.id`의 새 producer가 옛 producer를 fencing하면 일시 오류처럼 재시도하지 말고 소유권 상실로 종료합니다. commit 전후 중단과 재시작을 각각 시험합니다.

### Kafka 안에서 묶이는 것

입력 topic의 레코드를 읽어 출력 topic으로 변환하는 흐름은 출력 레코드와 소비 offset을 같은 Kafka transaction에 포함할 수 있습니다. 커밋되지 않으면 read_committed 소비자는 출력 결과를 업무 데이터로 보지 않고 입력 offset도 전진하지 않아 다시 처리할 수 있습니다. 이는 Kafka에 기록된 처리 경계이며 외부 DB의 commit을 참가자로 자동 등록하지 않습니다.

트랜잭션이 오래 열려 있으면 last stable offset 뒤에 있는 레코드는 read_committed 경로에서 대기할 수 있습니다. 그러므로 외부 API의 긴 대기를 transaction 안에 넣으면 결과 원자성을 얻지 못하면서 Kafka 소비 지연도 늘릴 수 있습니다. transaction timeout, 배치 크기, 오류 발생 뒤 abort·재시작 정책을 실제 클라이언트 버전에서 확인하겠습니다.

### DB 원자 경계로 다시 설계합니다

외부 DB에 포인트를 더하는 소비자라면 이벤트 ID의 inbox 삽입과 포인트 변경을 DB transaction에 넣고 그 뒤 Kafka offset을 전진시킬 수 있습니다. 중간에 죽으면 같은 입력을 다시 받아도 고유 제약이 중복 효과를 막습니다. 결과 이벤트까지 보내야 하면 그 DB transaction에 outbox도 기록하고 별도 발행자가 Kafka에 보냅니다. 발행이 중복될 수 있으므로 다음 소비자 역시 멱등해야 합니다.

반대로 DB 조회만 하고 Kafka 출력을 만든다고 해도 재실행 때 DB 값이 달라지면 출력이 달라질 수 있습니다. 어떤 시점의 원본 상태를 변환하는지 버전이나 스냅샷을 입력 계약에 포함해야 재현할 수 있습니다. Kafka transaction은 외부 읽기의 일관성도 자동 보장하지 않습니다.

동일 transactional.id로 새 producer가 시작해 옛 producer가 fenced되면 옛 인스턴스는 더 높은 권위를 얻으려고 무한 재시도하지 않고 종료해야 합니다. 테스트에서는 외부 DB commit 전후, Kafka commit 응답 유실, producer 재시작과 두 인스턴스 중첩을 나눠 내부 출력과 외부 효과를 각각 대조하겠습니다.

## 득점 포인트

- Kafka 내부와 외부 DB 경계를 분리한다.
- inbox·outbox·멱등 키·대사를 제시한다.
- read_committed·LSO·fencing을 설명한다.
- commit 전후를 검증한다.

## 감점 포인트

- Kafka transaction이 DB까지 rollback한다.
- read_committed가 외부 효과를 검증한다.
- 범위 없는 exactly once를 말한다.

## 더 파고들 거리

- 오래 열린 transaction
- DB와 offset 재처리
- fencing 종료

---
id: kafka-idempotent-producer
title: "Kafka 발행 응답을 못 받아 재시도하고, 소비자도 같은 메시지를 다시 처리할 수 있습니다. 멱등 프로듀서를 켜면 어떤 중복이 줄고 어떤 중복은 남나요?"
answerMinutes: 5
followups: [{"id":"kafka-transactions-external-db","prompt":"Kafka transaction이 외부 DB를 원자적으로 포함하지 않는 이유와 inbox 대안을 설명해 보세요."},{"id":"message-consumer-idempotency","prompt":"consumer 재처리에서 이벤트 ID와 처리 기록으로 외부 효과를 한 번만 만드는 방법은 무엇인가요?"},{"id":"kafka-acks-isr","prompt":"idempotent producer와 acks·ISR이 각각 제공하는 보장 범위는 무엇인가요?"}]
difficulty: 중하
category: 분산 시스템
tags: ["Kafka","멱등 프로듀서","중복"]
related: ["message-consumer-idempotency"]
---

# Kafka 발행 응답을 못 받아 재시도하고, 소비자도 같은 메시지를 다시 처리할 수 있습니다. 멱등 프로듀서를 켜면 어떤 중복이 줄고 어떤 중복은 남나요?

## 구두 답변

Kafka idempotent producer는 한 producer 세션의 재시도 요청을 producer ID와 partition별 sequence로 식별해 로그의 중복 append를 줄입니다. broker가 저장하고 응답이 유실돼 재전송해도 이미 처리한 sequence를 중복 기록하지 않습니다. 범위는 producer와 Kafka 로그 사이입니다.

### 남는 중복

consumer가 DB를 바꾸고 offset commit 전에 죽으면 같은 레코드를 다시 처리합니다. producer sequence는 특정 세션의 전달 추적값이지 주문의 영구 ID가 아닙니다. 같은 주문을 애플리케이션이 두 번 만들어 서로 다른 sequence를 쓰면 Kafka가 같은 업무로 판별하지 않습니다. 이벤트 ID·주문 ID를 DB inbox 고유 키로 사용하고 실제 변경과 같은 transaction에 넣겠습니다.

`enable.idempotence`, `acks`, retry, in-flight, client 버전과 `transactional.id` 조건을 고정합니다. transactional producer의 fencing도 Kafka 내부 경계입니다. “exactly once”는 broker append인지 Kafka transaction인지 외부 DB인지 범위를 붙여 씁니다. 생산 응답 유실·producer 재시작·consumer DB commit 뒤 중단을 분리해 레코드와 효과를 셉니다.

### 식별자는 어떤 범위를 나타내는가

브로커에 레코드를 저장한 뒤 응답만 사라졌다면 producer는 같은 배치를 다시 보낼 수 있습니다. producer ID·epoch·partition별 sequence를 이용한 중복 판정은 이 전달 시도의 반복을 식별합니다. 새로운 producer 세션에서 payload가 같은 레코드를 새로 보내면 일반적인 idempotence만으로 앞선 업무와 같다고 판정하지 않습니다. 주문 ID 같은 도메인 식별자는 별도로 유지해야 합니다.

클라이언트의 idempotence 조건에는 acks, retries, 동시에 전송 중인 요청 수와 버전이 영향을 줍니다. 일반적인 Kafka 클라이언트는 idempotence와 양립하지 않는 설정을 거절하거나 설정 상태에 따라 기능이 달라질 수 있으므로 기본값만 외우지 않고 실제 활성 상태를 확인합니다. sequence 오류나 producer fencing은 일시적인 네트워크 실패와 다르게 취급해야 합니다.

### 트랜잭션과 소비 효과

여러 partition의 출력과 소비 offset을 Kafka 트랜잭션으로 묶을 수 있지만, 출력 consumer가 read_committed를 사용해야 중단된 트랜잭션의 결과를 업무 데이터로 적용하지 않습니다. transactional.id는 논리 producer의 재시작과 fencing에 사용하며 동시에 활동할 서로 다른 producer가 같은 ID를 무심코 공유하면 서로를 차단할 수 있습니다. 안정적인 식별과 인스턴스 소유권을 설계해야 합니다.

외부 DB를 바꾸는 소비자는 이벤트 ID 처리 기록과 변경을 같은 로컬 트랜잭션에 넣습니다. DB commit 후 offset commit 전 중단되면 재전달되지만 처리 기록이 두 번째 변경을 막습니다. 외부 결제 API에는 그 API의 멱등 키나 결과 조회가 필요합니다. Kafka의 producer dedup, Kafka 내부 transaction, 외부 효과의 중복 방지는 각각 다른 경계입니다.

테스트는 ACK 응답만 유실시키는 경우, producer를 완전히 재시작해 새로 발행하는 경우, 같은 주문을 새 이벤트 ID로 만드는 경우를 나눕니다. 브로커 레코드 수와 최종 주문·포인트 효과 수를 따로 세어 어느 중복이 제거되고 어느 중복은 남는지 확인하겠습니다.

## 득점 포인트

- producer 재시도 dedup과 consumer 재처리를 분리한다.
- sequence와 업무 멱등 키를 구분한다.
- Kafka transaction과 외부 효과를 나눈다.
- 중복·누락을 관측한다.

## 감점 포인트

- producer가 외부 DB도 한 번으로 만든다.
- 같은 payload 새 이벤트를 자동 제거한다.
- 설정 조건을 무시한다.

## 더 파고들 거리

- transactional.id fencing
- 다중 partition 원자성
- 키 보관 기간

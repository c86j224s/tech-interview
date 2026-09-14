---
id: "kafka-multipartition-transaction-read"
title: "여러 topic partition에 한 transaction으로 출력합니다. 소비자가 read_committed로 보는 원자성 범위는 무엇인가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","멱등 프로듀서","중복","심화 질문"]
related: ["kafka-idempotent-producer","message-consumer-idempotency"]
promotedFrom: {"id":"kafka-idempotent-producer","prompt":"다중 partition 원자성"}
---

# 여러 topic partition에 한 transaction으로 출력합니다. 소비자가 read_committed로 보는 원자성 범위는 무엇인가요?

## 구두 답변

Kafka transaction은 관련 출력과 소비 offset의 commit·abort 가시성을 묶을 수 있습니다. read_committed가 aborted 출력을 업무 데이터로 보지 않게 하는 범위와 여러 poll·partition의 관찰을 구분합니다.

외부 DB·HTTP 효과까지 원자적으로 포함하지는 않습니다. 장기 transaction의 LSO 지연·재시작·fencing과 결과 유실을 시험합니다. 소비자 처리가 모두 한 번 수행된다는 의미로 확대하지 않습니다.

## 득점 포인트

- Kafka transaction은 관련 출력과 소비 offset의 commit·abort 가시성을 묶을 수 있습니다. read_committed가 aborted 출력을 업무 데이터로 보지 않게 하는 범위와 여러 poll·partition의 관찰을 구분합니다.
- 소비자 처리가 모두 한 번 수행된다는 의미로 확대하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Kafka transaction은 관련 출력과 소비 offset의 commit·abort 가시성을 묶을 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka 발행 응답을 못 받아 재시도하고, 소비자도 같은 메시지를 다시 처리할 수 있습니다. 멱등 프로듀서를 켜면 어떤 중복이 줄고 어떤 중복은 남나요?](/tech-interview/questions/kafka-idempotent-producer/)

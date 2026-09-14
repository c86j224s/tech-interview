---
id: "kafka-transactional-id-fencing"
title: "같은 transactional.id로 두 producer가 실행됩니다. 새 epoch와 fenced 오류는 어떤 소유권을 뜻하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","멱등 프로듀서","중복","심화 질문"]
related: ["kafka-idempotent-producer","message-consumer-idempotency"]
promotedFrom: {"id":"kafka-idempotent-producer","prompt":"transactional.id fencing"}
---

# 같은 transactional.id로 두 producer가 실행됩니다. 새 epoch와 fenced 오류는 어떤 소유권을 뜻하나요?

## 구두 답변

동일 논리 transactional.id의 새 producer가 초기화되면 이전 producer를 fencing하는 epoch 규칙이 적용될 수 있습니다. fenced된 인스턴스는 네트워크 일시 실패처럼 계속 재시도하지 않고 소유권 상실로 처리합니다.

서로 독립적인 동시 producer가 같은 ID를 무심코 쓰지 않도록 배정합니다. Kafka의 fencing은 외부 DB writer까지 자동 차단하지 않습니다. 재시작·중첩 실행·commit 응답 유실을 시험합니다.

## 득점 포인트

- 동일 논리 transactional.id의 새 producer가 초기화되면 이전 producer를 fencing하는 epoch 규칙이 적용될 수 있습니다. fenced된 인스턴스는 네트워크 일시 실패처럼 계속 재시도하지 않고 소유권 상실로 처리합니다.
- 재시작·중첩 실행·commit 응답 유실을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 동일 논리 transactional.id의 새 producer가 초기화되면 이전 producer를 fencing하는 epoch 규칙이 적용될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka 발행 응답을 못 받아 재시도하고, 소비자도 같은 메시지를 다시 처리할 수 있습니다. 멱등 프로듀서를 켜면 어떤 중복이 줄고 어떤 중복은 남나요?](/tech-interview/questions/kafka-idempotent-producer/)

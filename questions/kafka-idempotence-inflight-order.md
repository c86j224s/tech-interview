---
id: "kafka-idempotence-inflight-order"
title: "Kafka producer의 in-flight 요청 수와 idempotence 설정을 바꿉니다. 재시도 중복과 순서 보장은 어떤 조건을 요구하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","acks","ISR","심화 질문"]
related: ["kafka-acks-isr","db-wal-durability"]
promotedFrom: {"id":"kafka-acks-isr","prompt":"idempotence와 in-flight"}
---

# Kafka producer의 in-flight 요청 수와 idempotence 설정을 바꿉니다. 재시도 중복과 순서 보장은 어떤 조건을 요구하나요?

## 구두 답변

producer 재시도에서 순서와 dedup은 idempotence·acks·retry·max in-flight와 client 버전의 결합 계약에 달려 있습니다. 임의로 한 옵션만 바꿔 같은 보장이 유지된다고 하지 않습니다.

ACK 유실·요청 역전·producer 재시작을 시험합니다. sequence 기반 broker dedup과 동일 주문을 새 이벤트로 두 번 만드는 문제는 다릅니다. 외부 DB 처리의 멱등성도 별도로 유지합니다.

## 득점 포인트

- producer 재시도에서 순서와 dedup은 idempotence·acks·retry·max in-flight와 client 버전의 결합 계약에 달려 있습니다. 임의로 한 옵션만 바꿔 같은 보장이 유지된다고 하지 않습니다.
- 외부 DB 처리의 멱등성도 별도로 유지합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: producer 재시도에서 순서와 dedup은 idempotence·acks·retry·max in-flight와 client 버전의 결합 계약에 달려 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka에서 복제 계수 3, acks=all, min.insync.replicas=2일 때 ISR이 2개 또는 1개로 줄면 생산 요청은 어떻게 되나요?](/tech-interview/questions/kafka-acks-isr/)

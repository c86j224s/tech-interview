---
id: "kafka-open-transaction-lso-delay"
title: "Kafka transaction이 오래 열려 read_committed 소비가 멈춘 것처럼 보입니다. LSO와 처리 지연은 어떻게 연결되나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","트랜잭션","외부 DB","심화 질문"]
related: ["kafka-transactions-external-db","transactional-outbox","message-consumer-idempotency"]
promotedFrom: {"id":"kafka-transactions-external-db","prompt":"오래 열린 transaction"}
---

# Kafka transaction이 오래 열려 read_committed 소비가 멈춘 것처럼 보입니다. LSO와 처리 지연은 어떻게 연결되나요?

## 구두 답변

read_committed는 아직 결정되지 않은 transaction 때문에 안전하게 공개할 수 있는 LSO 경계 뒤를 기다릴 수 있습니다. high watermark·LSO·consumer position을 나누어 봐야 합니다.

외부 API의 긴 대기를 Kafka transaction 안에 넣으면 원자성은 얻지 못하면서 지연을 키울 수 있습니다. transaction timeout·batch·abort·fencing을 관리하고 commit 전후 중단에서 결과 가시성을 검사합니다.

## 득점 포인트

- read_committed는 아직 결정되지 않은 transaction 때문에 안전하게 공개할 수 있는 LSO 경계 뒤를 기다릴 수 있습니다. high watermark·LSO·consumer position을 나누어 봐야 합니다.
- transaction timeout·batch·abort·fencing을 관리하고 commit 전후 중단에서 결과 가시성을 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: read_committed는 아직 결정되지 않은 transaction 때문에 안전하게 공개할 수 있는 LSO 경계 뒤를 기다릴 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka 메시지를 읽어 외부 DB를 갱신하고 결과를 다른 topic에 발행합니다. Kafka transaction만으로 DB 변경과 offset·결과 발행을 모두 원자적으로 묶을 수 있나요?](/tech-interview/questions/kafka-transactions-external-db/)

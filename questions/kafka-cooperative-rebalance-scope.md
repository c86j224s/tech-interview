---
id: "kafka-cooperative-rebalance-scope"
title: "cooperative rebalance를 켰습니다. 반납 범위가 줄어도 실행 중 외부 작업의 안전성은 왜 따로 필요한가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","리밸런싱","offset","심화 질문"]
related: ["kafka-rebalance-processing","kafka-consumer-group"]
promotedFrom: {"id":"kafka-rebalance-processing","prompt":"cooperative 범위"}
---

# cooperative rebalance를 켰습니다. 반납 범위가 줄어도 실행 중 외부 작업의 안전성은 왜 따로 필요한가요?

## 구두 답변

cooperative 방식은 일부 partition만 단계적으로 이동하게 해 전면 중단을 줄일 수 있지만 옛 worker의 실행 중 DB 호출을 원자 취소하지는 않습니다. 반납 대상과 여전히 가진 대상의 작업을 구분합니다.

revoke·lost와 commit 가능 범위를 client 계약으로 확인합니다. 외부 효과는 event ID·version으로 보호하고 poll·queue 상한을 유지합니다. 리밸런싱 감소와 정확성 보장은 별도 지표로 검증합니다.

## 득점 포인트

- cooperative 방식은 일부 partition만 단계적으로 이동하게 해 전면 중단을 줄일 수 있지만 옛 worker의 실행 중 DB 호출을 원자 취소하지는 않습니다. 반납 대상과 여전히 가진 대상의 작업을 구분합니다.
- 리밸런싱 감소와 정확성 보장은 별도 지표로 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: cooperative 방식은 일부 partition만 단계적으로 이동하게 해 전면 중단을 줄일 수 있지만 옛 worker의 실행 중 DB 호출을 원자 취소하지는 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka 소비자가 메시지를 처리하는 동안 리밸런싱으로 파티션을 잃으면, 작업과 offset을 어떤 순서로 정리해야 하나요?](/tech-interview/questions/kafka-rebalance-processing/)

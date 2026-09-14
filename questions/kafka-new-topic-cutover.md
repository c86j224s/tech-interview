---
id: "kafka-new-topic-cutover"
title: "새 Kafka topic으로 이전합니다. 옛·새 로그의 시작 위치·키 순서·중복 발행을 어떻게 전환하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","파티션 확장","키 순서","심화 질문"]
related: ["kafka-partition-expansion","message-ordering-scope","kafka-partition-offset"]
promotedFrom: {"id":"kafka-partition-expansion","prompt":"새 topic cutover"}
---

# 새 Kafka topic으로 이전합니다. 옛·새 로그의 시작 위치·키 순서·중복 발행을 어떻게 전환하나요?

## 구두 답변

옛 topic의 마지막 논리 처리 위치와 새 topic의 시작·생산 세대를 정합니다. dual publish하면 두 topic의 같은 이벤트가 중복되므로 안정 ID와 원장·대사가 필요합니다.

같은 키의 옛 메시지가 늦게 적용되지 않게 장벽·버퍼·version을 사용합니다. 새 쓰기 뒤 rollback은 역동기화가 필요할 수 있습니다. schema·partition·retention·consumer group을 함께 검증합니다.

## 득점 포인트

- 옛 topic의 마지막 논리 처리 위치와 새 topic의 시작·생산 세대를 정합니다. dual publish하면 두 topic의 같은 이벤트가 중복되므로 안정 ID와 원장·대사가 필요합니다.
- schema·partition·retention·consumer group을 함께 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 옛 topic의 마지막 논리 처리 위치와 새 topic의 시작·생산 세대를 정합니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka topic의 파티션 수를 늘린 뒤 같은 키의 이전 이벤트와 새 이벤트 순서가 깨질 수 있는 이유는 무엇인가요?](/tech-interview/questions/kafka-partition-expansion/)

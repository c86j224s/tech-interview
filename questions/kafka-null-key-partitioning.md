---
id: "kafka-null-key-partitioning"
title: "Kafka 레코드에 key가 없습니다. 분배·순서·compaction 요구에 어떤 제한이 생기나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","partition","offset","심화 질문"]
related: ["kafka-partition-offset","message-ordering-scope"]
promotedFrom: {"id":"kafka-partition-offset","prompt":"키 없는 레코드"}
---

# Kafka 레코드에 key가 없습니다. 분배·순서·compaction 요구에 어떤 제한이 생기나요?

## 구두 답변

null key의 배정은 producer partitioner·버전에 따라 달라질 수 있고 같은 업무 키의 순서를 표현하지 못합니다. null value tombstone과 null key를 혼동하지 않습니다.

compacted topic 등 실제 제약과 오류를 확인합니다. 순서가 필요한 계정은 안정적인 key bytes를 사용하고 partition 증설의 재배정도 검사합니다. 없는 키를 임의 상수로 합쳐 핫 partition을 만들지 않습니다.

## 득점 포인트

- null key의 배정은 producer partitioner·버전에 따라 달라질 수 있고 같은 업무 키의 순서를 표현하지 못합니다. null value tombstone과 null key를 혼동하지 않습니다.
- 없는 키를 임의 상수로 합쳐 핫 partition을 만들지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: null key의 배정은 producer partitioner·버전에 따라 달라질 수 있고 같은 업무 키의 순서를 표현하지 못합니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka 메시지의 offset을 처리 완료 번호처럼 저장하려 합니다. topic·partition·offset은 무엇을 식별하며, 메시지 위치와 실제 처리 완료는 왜 구분해야 하나요?](/tech-interview/questions/kafka-partition-offset/)

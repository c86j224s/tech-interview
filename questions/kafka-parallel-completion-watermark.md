---
id: "kafka-parallel-completion-watermark"
title: "Kafka 레코드 10·11·12를 병렬 처리해 11·12만 끝났습니다. 커밋할 다음 위치를 어떤 자료구조로 관리하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","consumer group","병렬성","심화 질문"]
related: ["kafka-consumer-group","kafka-partition-offset"]
promotedFrom: {"id":"kafka-consumer-group","prompt":"완료 watermark"}
---

# Kafka 레코드 10·11·12를 병렬 처리해 11·12만 끝났습니다. 커밋할 다음 위치를 어떤 자료구조로 관리하나요?

## 구두 답변

실제 전달된 레코드 순서의 완료 상태를 기록하고 가장 앞의 미완료 경계를 넘지 않게 commit합니다. 10이 남으면 11·12 완료만으로 다음 위치 13을 커밋할 수 없습니다.

뒤 완료를 집합·bitmap 등으로 유지하고 10이 끝나면 연속 구간을 전진시킵니다. offset 번호의 빈 구간과 미처리 레코드를 구분합니다. revoke·실패·재전달에서 외부 효과의 멱등성도 유지합니다.

## 득점 포인트

- 실제 전달된 레코드 순서의 완료 상태를 기록하고 가장 앞의 미완료 경계를 넘지 않게 commit합니다. 10이 남으면 11·12 완료만으로 다음 위치 13을 커밋할 수 없습니다.
- revoke·실패·재전달에서 외부 효과의 멱등성도 유지합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 실제 전달된 레코드 순서의 완료 상태를 기록하고 가장 앞의 미완료 경계를 넘지 않게 commit합니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka 파티션이 3개인데 같은 그룹의 소비자를 5개로 늘렸습니다. 왜 일부 소비자는 일을 하지 않으며 언제 확장이 도움이 되나요?](/tech-interview/questions/kafka-consumer-group/)

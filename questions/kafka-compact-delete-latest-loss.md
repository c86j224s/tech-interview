---
id: "kafka-compact-delete-latest-loss"
title: "compact와 delete를 함께 설정했습니다. 키의 최신 값도 삭제될 수 있는 조건과 snapshot 복구는 무엇인가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","retention","compaction","심화 질문"]
related: ["kafka-retention-compaction","kafka-partition-offset"]
promotedFrom: {"id":"kafka-retention-compaction","prompt":"compact·delete 시간 한계"}
---

# compact와 delete를 함께 설정했습니다. 키의 최신 값도 삭제될 수 있는 조건과 snapshot 복구는 무엇인가요?

## 구두 답변

compaction은 키별 상태 재구성을 돕지만 delete 정책이 시간·크기 기준으로 segment를 지우면 최신 값도 사라질 수 있습니다. 영구 원장으로 사용할 수 있는 보관 계약인지 확인해야 합니다.

최대 중단·재생·snapshot 주기와 실제 log start offset을 대조합니다. tombstone 만료와 기존 cache의 삭제 상태를 검사합니다. 복구 기준 snapshot 이후 이벤트를 빠짐없이 이어 붙입니다.

## 득점 포인트

- compaction은 키별 상태 재구성을 돕지만 delete 정책이 시간·크기 기준으로 segment를 지우면 최신 값도 사라질 수 있습니다. 영구 원장으로 사용할 수 있는 보관 계약인지 확인해야 합니다.
- 복구 기준 snapshot 이후 이벤트를 빠짐없이 이어 붙입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: compaction은 키별 상태 재구성을 돕지만 delete 정책이 시간·크기 기준으로 segment를 지우면 최신 값도 사라질 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka에 오래된 이벤트를 정리하면서 키별 최신 상태는 남기려 합니다. 시간·크기 기반 retention과 log compaction은 무엇을 각각 보존하나요?](/tech-interview/questions/kafka-retention-compaction/)

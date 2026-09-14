---
id: "kafka-tombstone-offline-consumer"
title: "오래 중단한 소비자가 tombstone 보관 기간을 넘겼습니다. 옛 삭제 상태를 잘못 유지하지 않으려면 어떻게 복구하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","retention","compaction","심화 질문"]
related: ["kafka-retention-compaction","kafka-partition-offset"]
promotedFrom: {"id":"kafka-retention-compaction","prompt":"tombstone 복구"}
---

# 오래 중단한 소비자가 tombstone 보관 기간을 넘겼습니다. 옛 삭제 상태를 잘못 유지하지 않으려면 어떻게 복구하나요?

## 구두 답변

tombstone을 놓친 기존 cache는 삭제된 키를 계속 보유할 수 있습니다. 보관 범위 밖 소비자를 조용히 최신 offset으로 보내지 않고 기준 snapshot이나 전체 재구축으로 삭제 상태까지 맞춥니다.

snapshot의 적용 위치 이후 이벤트를 이어 읽고 중복을 멱등 처리합니다. 최대 중단·재생 시간과 tombstone 보관 정책을 맞춥니다. 값 수만 아니라 원본에 없는 키가 남았는지 대조합니다.

## 득점 포인트

- tombstone을 놓친 기존 cache는 삭제된 키를 계속 보유할 수 있습니다. 보관 범위 밖 소비자를 조용히 최신 offset으로 보내지 않고 기준 snapshot이나 전체 재구축으로 삭제 상태까지 맞춥니다.
- 값 수만 아니라 원본에 없는 키가 남았는지 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: tombstone을 놓친 기존 cache는 삭제된 키를 계속 보유할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka에 오래된 이벤트를 정리하면서 키별 최신 상태는 남기려 합니다. 시간·크기 기반 retention과 log compaction은 무엇을 각각 보존하나요?](/tech-interview/questions/kafka-retention-compaction/)

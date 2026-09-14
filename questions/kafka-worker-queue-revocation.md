---
id: "kafka-worker-queue-revocation"
title: "partition 소유권을 잃을 때 메모리 worker 큐를 버립니다. 어떤 커밋 위치와 내구 기록이 있어야 누락 없이 재처리하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","리밸런싱","offset","심화 질문"]
related: ["kafka-rebalance-processing","kafka-consumer-group"]
promotedFrom: {"id":"kafka-rebalance-processing","prompt":"워커 큐 폐기 내구화"}
---

# partition 소유권을 잃을 때 메모리 worker 큐를 버립니다. 어떤 커밋 위치와 내구 기록이 있어야 누락 없이 재처리하나요?

## 구두 답변

메모리 큐를 버려도 원본 로그와 커밋 위치에서 다시 받을 수 있어야 합니다. 실제 처리 전 offset을 전진시켰다면 큐 폐기가 영구 누락을 만들 수 있습니다.

연속 완료 위치만 commit하고 외부 효과는 처리 ID로 중복 방지합니다. 이미 소유권을 잃은 뒤 늦은 commit은 실패할 수 있어 revoke·lost를 구분합니다. 실행 중 DB 쓰기까지 그룹 세대가 자동 차단하지는 않습니다.

## 득점 포인트

- 메모리 큐를 버려도 원본 로그와 커밋 위치에서 다시 받을 수 있어야 합니다. 실제 처리 전 offset을 전진시켰다면 큐 폐기가 영구 누락을 만들 수 있습니다.
- 실행 중 DB 쓰기까지 그룹 세대가 자동 차단하지는 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 메모리 큐를 버려도 원본 로그와 커밋 위치에서 다시 받을 수 있어야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka 소비자가 메시지를 처리하는 동안 리밸런싱으로 파티션을 잃으면, 작업과 offset을 어떤 순서로 정리해야 하나요?](/tech-interview/questions/kafka-rebalance-processing/)

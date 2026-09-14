---
id: "kafka-pause-versus-leave-group"
title: "Kafka 소비자가 포화돼 pause합니다. poll·heartbeat·그룹 탈퇴와 partition 소유권은 어떻게 다른가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","consumer group","병렬성","심화 질문"]
related: ["kafka-consumer-group","kafka-partition-offset"]
promotedFrom: {"id":"kafka-consumer-group","prompt":"pause와 탈퇴"}
---

# Kafka 소비자가 포화돼 pause합니다. poll·heartbeat·그룹 탈퇴와 partition 소유권은 어떻게 다른가요?

## 구두 답변

pause는 특정 partition의 새 레코드 반환을 조절하는 기능이며 그룹 소유권 포기·poll 중단과 같은 뜻은 아닙니다. client의 poll·heartbeat·max interval 계약을 계속 지켜야 합니다.

이미 받은 worker 작업은 남을 수 있어 큐·완료 watermark를 관리합니다. revoke·lost에는 별도 정리·commit 정책을 둡니다. pause를 무기한 쓰면 실제 작업 나이가 늘 수 있어 관측합니다.

## 득점 포인트

- pause는 특정 partition의 새 레코드 반환을 조절하는 기능이며 그룹 소유권 포기·poll 중단과 같은 뜻은 아닙니다. client의 poll·heartbeat·max interval 계약을 계속 지켜야 합니다.
- pause를 무기한 쓰면 실제 작업 나이가 늘 수 있어 관측합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: pause는 특정 partition의 새 레코드 반환을 조절하는 기능이며 그룹 소유권 포기·poll 중단과 같은 뜻은 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka 파티션이 3개인데 같은 그룹의 소비자를 5개로 늘렸습니다. 왜 일부 소비자는 일을 하지 않으며 언제 확장이 도움이 되나요?](/tech-interview/questions/kafka-consumer-group/)

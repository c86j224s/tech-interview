---
id: "duplicate-event-payload-conflict"
title: "동일 event ID가 다른 payload로 재전달됐습니다. 기존 성공 반환·거절·경보 중 어떤 정책을 적용하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["메시지","멱등성","inbox","심화 질문"]
related: ["message-consumer-idempotency","transactional-outbox"]
promotedFrom: {"id":"message-consumer-idempotency","prompt":"같은 event ID가 다른 payload로 재전달될 때 어떤 상태와 경보를 남길까요?"}
---

# 동일 event ID가 다른 payload로 재전달됐습니다. 기존 성공 반환·거절·경보 중 어떤 정책을 적용하나요?

## 구두 답변

동일 event ID는 동일 논리 사건·payload라는 계약이어야 합니다. 내용이 다르면 단순 중복 성공으로 숨기지 않고 원본 해시·버전·발행자를 비교해 충돌·오염 상태로 기록합니다.

기존 효과를 임의로 새 payload로 다시 적용하지 않습니다. 원본 저장소·발행 원장을 대사하고 정상 정정은 별도 이벤트 ID와 전이로 처리합니다. 민감 payload를 경보에 그대로 노출하지 않습니다.

## 득점 포인트

- 동일 event ID는 동일 논리 사건·payload라는 계약이어야 합니다. 내용이 다르면 단순 중복 성공으로 숨기지 않고 원본 해시·버전·발행자를 비교해 충돌·오염 상태로 기록합니다.
- 민감 payload를 경보에 그대로 노출하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 동일 event ID는 동일 논리 사건·payload라는 계약이어야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: 메시지에 따라 포인트를 지급한 뒤 ACK 전에 소비자가 죽었습니다. 같은 메시지를 다시 받아도 포인트가 한 번만 지급되도록 어떻게 처리하나요?](/tech-interview/questions/message-consumer-idempotency/)

---
id: "jetstream-event-id-retention"
title: "JetStream 메시지를 오래 뒤 재생합니다. 처리 ID 보존 기간이 짧으면 어떤 중복 효과가 다시 생기나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["NATS","JetStream","ACK","심화 질문"]
related: ["jetstream-ack-redelivery","message-consumer-idempotency"]
promotedFrom: {"id":"jetstream-ack-redelivery","prompt":"이벤트 ID 보존"}
---

# JetStream 메시지를 오래 뒤 재생합니다. 처리 ID 보존 기간이 짧으면 어떤 중복 효과가 다시 생기나요?

## 구두 답변

정상 ACK 지연보다 수동 재생·장기 보관 기간이 길면 처리 ID도 그 반복 가능성을 고려해 유지해야 합니다. 기록이 사라진 뒤 같은 이벤트를 받으면 다시 포인트를 지급할 수 있습니다.

영구 원장의 업무 키로 중복을 판정할지 오래된 재처리를 거절할지 계약을 둡니다. 동일 ID의 다른 payload는 오류로 대사합니다. 브로커 생산 dedup 창과 외부 DB의 처리 기록 수명은 별도입니다.

## 득점 포인트

- 정상 ACK 지연보다 수동 재생·장기 보관 기간이 길면 처리 ID도 그 반복 가능성을 고려해 유지해야 합니다. 기록이 사라진 뒤 같은 이벤트를 받으면 다시 포인트를 지급할 수 있습니다.
- 브로커 생산 dedup 창과 외부 DB의 처리 기록 수명은 별도입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 정상 ACK 지연보다 수동 재생·장기 보관 기간이 길면 처리 ID도 그 반복 가능성을 고려해 유지해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: JetStream 메시지 처리 중 AckWait가 지났거나 ACK가 유실돼 같은 메시지가 다시 왔습니다. 원래 작업과 중복 반영은 어떻게 처리하나요?](/tech-interview/questions/jetstream-ack-redelivery/)

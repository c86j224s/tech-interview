---
id: "jetstream-backoff-nak-policy"
title: "JetStream에서 BackOff·AckWait·NAK 지연을 설정합니다. timeout 재전달과 명시적 실패 신호는 어떻게 다른가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["NATS","JetStream","ACK","심화 질문"]
related: ["jetstream-ack-redelivery","message-consumer-idempotency"]
promotedFrom: {"id":"jetstream-ack-redelivery","prompt":"BackOff와 AckWait"}
---

# JetStream에서 BackOff·AckWait·NAK 지연을 설정합니다. timeout 재전달과 명시적 실패 신호는 어떻게 다른가요?

## 구두 답변

AckWait는 ACK 부재 뒤 재전달 판단 시간이고 BackOff는 timeout 기반 재전달 간격 설정과 연결됩니다. 명시적인 NAK는 별도의 지연 API·정책을 따를 수 있어 같은 것으로 취급하지 않습니다.

서버·client 버전과 BackOff 우선 규칙을 확인하고 진행 ACK·NAK·worker pause를 시험합니다. 어느 설정도 실행 중 DB 작업을 강제로 중단하거나 외부 중복을 제거하지 않습니다.

## 득점 포인트

- AckWait는 ACK 부재 뒤 재전달 판단 시간이고 BackOff는 timeout 기반 재전달 간격 설정과 연결됩니다. 명시적인 NAK는 별도의 지연 API·정책을 따를 수 있어 같은 것으로 취급하지 않습니다.
- 어느 설정도 실행 중 DB 작업을 강제로 중단하거나 외부 중복을 제거하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: AckWait는 ACK 부재 뒤 재전달 판단 시간이고 BackOff는 timeout 기반 재전달 간격 설정과 연결됩니다.

## 더 파고들 거리

- [기본 상황과 비교: JetStream 메시지 처리 중 AckWait가 지났거나 ACK가 유실돼 같은 메시지가 다시 왔습니다. 원래 작업과 중복 반영은 어떻게 처리하나요?](/tech-interview/questions/jetstream-ack-redelivery/)

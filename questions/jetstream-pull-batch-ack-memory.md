---
id: "jetstream-pull-batch-ack-memory"
title: "JetStream pull batch를 크게 잡았습니다. 메모리·ACK 지연·재전달·worker 수에 어떤 영향이 있나요?"
difficulty: "중하"
category: "성능"
tags: ["NATS","slow consumer","백프레셔","심화 질문"]
related: ["nats-slow-consumer","bounded-queue-backpressure"]
promotedFrom: {"id":"nats-slow-consumer","prompt":"JetStream pull batch 크기가 메모리·ACK 지연·재전달에 어떤 영향을 주나요?"}
---

# JetStream pull batch를 크게 잡았습니다. 메모리·ACK 지연·재전달·worker 수에 어떤 영향이 있나요?

## 구두 답변

큰 pull batch는 왕복을 줄일 수 있지만 이미 받은 메시지의 메모리·ACK 대기·작업 나이를 늘립니다. worker와 DB 연결이 적으면 마지막 메시지가 처리되기 전에 AckWait가 지날 수 있습니다.

batch 개수·바이트·대기·MaxAckPending을 함께 제한합니다. 진행 ACK가 실제 중복 효과를 제거하지는 않습니다. 취소·worker 종료·부분 성공에서 ACK를 내구 처리 뒤 보내는지 검사합니다.

## 득점 포인트

- 큰 pull batch는 왕복을 줄일 수 있지만 이미 받은 메시지의 메모리·ACK 대기·작업 나이를 늘립니다. worker와 DB 연결이 적으면 마지막 메시지가 처리되기 전에 AckWait가 지날 수 있습니다.
- 취소·worker 종료·부분 성공에서 ACK를 내구 처리 뒤 보내는지 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 큰 pull batch는 왕복을 줄일 수 있지만 이미 받은 메시지의 메모리·ACK 대기·작업 나이를 늘립니다.

## 더 파고들 거리

- [기본 상황과 비교: NATS slow consumer 경고가 서버 전체 병목인지 특정 subscriber의 처리 지연인지 어떻게 구분하고 대응하나요?](/tech-interview/questions/nats-slow-consumer/)

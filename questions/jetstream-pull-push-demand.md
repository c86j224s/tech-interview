---
id: "jetstream-pull-push-demand"
title: "JetStream의 pull과 push 소비를 비교합니다. 수신량·미확인 메시지·앱 worker 예산을 어떻게 연결하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["NATS","JetStream","durable consumer","심화 질문"]
related: ["jetstream-durable-consumer","nats-core-jetstream"]
promotedFrom: {"id":"jetstream-durable-consumer","prompt":"pull·push 흐름 제어"}
---

# JetStream의 pull과 push 소비를 비교합니다. 수신량·미확인 메시지·앱 worker 예산을 어떻게 연결하나요?

## 구두 답변

pull은 소비자가 요청 수·batch를 조절하기 쉽고 push는 서버 전달에 대한 ACK·flow control을 맞춰야 합니다. 둘 다 이미 받은 메시지가 앱 큐에 무한히 쌓이지 않게 제한해야 합니다.

MaxAckPending·worker·DB 풀·메시지 바이트를 연결합니다. ACK는 실제 내구 처리 뒤 보내고 취소·batch timeout·느린 메시지에서 재전달과 중복 효과를 검사합니다.

## 득점 포인트

- pull은 소비자가 요청 수·batch를 조절하기 쉽고 push는 서버 전달에 대한 ACK·flow control을 맞춰야 합니다. 둘 다 이미 받은 메시지가 앱 큐에 무한히 쌓이지 않게 제한해야 합니다.
- ACK는 실제 내구 처리 뒤 보내고 취소·batch timeout·느린 메시지에서 재전달과 중복 효과를 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: pull은 소비자가 요청 수·batch를 조절하기 쉽고 push는 서버 전달에 대한 ACK·flow control을 맞춰야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: 분석과 알림 서비스가 같은 JetStream 메시지를 각각 읽어야 합니다. stream과 durable consumer를 어떻게 나누고 재시작 위치를 유지하나요?](/tech-interview/questions/jetstream-durable-consumer/)

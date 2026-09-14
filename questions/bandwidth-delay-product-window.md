---
id: "bandwidth-delay-product-window"
title: "대역폭과 RTT가 모두 큰 연결에서 처리량이 낮습니다. in-flight 바이트와 창 크기는 어떤 관계가 있나요?"
difficulty: "중하"
category: "네트워크"
tags: ["TCP","흐름 제어","혼잡 제어","심화 질문"]
related: ["tcp-flow-vs-congestion-control","tcp-stream-message-framing"]
promotedFrom: {"id":"tcp-flow-vs-congestion-control","prompt":"대역폭·RTT가 큰 경로에서 윈도우와 in-flight 데이터가 중요한 이유는 무엇일까요?"}
---

# 대역폭과 RTT가 모두 큰 연결에서 처리량이 낮습니다. in-flight 바이트와 창 크기는 어떤 관계가 있나요?

## 구두 답변

대역폭×RTT만큼 충분한 데이터가 진행 중이어야 경로를 채울 수 있습니다. 송수신·혼잡 창이 작으면 ACK를 기다리며 링크가 놀 수 있습니다.

이 관계는 손실·앱 속도·window scaling·buffer 한도의 영향을 받습니다. buffer를 무작정 키우면 queueing 지연이 늘 수 있습니다. 실제 throughput·RTT·retransmit·앱 대기를 함께 비교합니다.

## 득점 포인트

- 대역폭×RTT만큼 충분한 데이터가 진행 중이어야 경로를 채울 수 있습니다. 송수신·혼잡 창이 작으면 ACK를 기다리며 링크가 놀 수 있습니다.
- 실제 throughput·RTT·retransmit·앱 대기를 함께 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 대역폭×RTT만큼 충분한 데이터가 진행 중이어야 경로를 채울 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: TCP 전송이 느려졌는데 수신 앱도 느리고 네트워크에도 손실이 보입니다. 흐름 제어와 혼잡 제어는 무엇을 각각 제한하며 어떤 지표로 원인을 구분하나요?](/tech-interview/questions/tcp-flow-vs-congestion-control/)

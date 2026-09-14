---
id: "tls-record-tcp-packet-buffering"
title: "작은 메시지가 늦게 나갑니다. 앱 write·TLS record·TCP segment·실제 NIC 전송을 어떻게 나눠 관찰하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["TCP","Nagle","지연 ACK","심화 질문"]
related: ["tcp-nagle-delayed-ack","tcp-flow-vs-congestion-control"]
promotedFrom: {"id":"tcp-nagle-delayed-ack","prompt":"TLS 레코드 버퍼링과 TCP 세그먼트화를 어떤 관측 시각으로 분리할까요?"}
---

# 작은 메시지가 늦게 나갑니다. 앱 write·TLS record·TCP segment·실제 NIC 전송을 어떻게 나눠 관찰하나요?

## 구두 답변

앱 write 호출이 TLS record 생성·flush와 같지 않고 record가 TCP segment·NIC packet과 일대일도 아닙니다. 각 계층의 시각과 buffer 설정을 분리해 관찰합니다.

Nagle·delayed ACK·TLS buffering·proxy를 하나의 원인으로 합치지 않습니다. 작은 payload·batch·TCP_NODELAY를 같은 부하로 비교하고 offload가 캡처 모양을 바꾸는 조건도 확인합니다.

## 득점 포인트

- 앱 write 호출이 TLS record 생성·flush와 같지 않고 record가 TCP segment·NIC packet과 일대일도 아닙니다. 각 계층의 시각과 buffer 설정을 분리해 관찰합니다.
- 작은 payload·batch·TCP_NODELAY를 같은 부하로 비교하고 offload가 캡처 모양을 바꾸는 조건도 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 앱 write 호출이 TLS record 생성·flush와 같지 않고 record가 TCP segment·NIC packet과 일대일도 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 작은 TCP 메시지 지연이 튈 때 Nagle과 지연 ACK를 의심하되 TCP_NODELAY를 무조건 켜면 안 되는 이유는 무엇인가요?](/tech-interview/questions/tcp-nagle-delayed-ack/)

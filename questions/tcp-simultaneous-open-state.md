---
id: "tcp-simultaneous-open-state"
title: "양쪽 TCP endpoint가 동시에 SYN을 보냅니다. 일반 연결 시작과 상태 전이는 어떻게 다른가요?"
difficulty: "중하"
category: "네트워크"
tags: ["TCP","핸드셰이크","sequence","ACK","심화 질문"]
related: ["tcp-three-way-handshake","tcp-flow-vs-congestion-control","tcp-time-wait"]
promotedFrom: {"id":"tcp-three-way-handshake","prompt":"동시 오픈과 SYN 재전송에서 TCP 상태 전이를 어떻게 그릴까요?"}
---

# 양쪽 TCP endpoint가 동시에 SYN을 보냅니다. 일반 연결 시작과 상태 전이는 어떻게 다른가요?

## 구두 답변

양쪽이 능동 SYN을 보내면 SYN-SENT에서 상대 SYN을 받아 SYN-RECEIVED 등 해당 상태 규칙을 거쳐 연결을 동기화할 수 있습니다. 일반 client-server 시작만 TCP의 유일한 경로는 아닙니다.

초기 sequence·ACK·재전송·중복 SYN의 규칙을 상태표로 확인합니다. packet 캡처 한 장면만으로 전체 연결을 확정하지 않고 양 끝 상태·timeout·정리를 대조합니다.

## 득점 포인트

- 양쪽이 능동 SYN을 보내면 SYN-SENT에서 상대 SYN을 받아 SYN-RECEIVED 등 해당 상태 규칙을 거쳐 연결을 동기화할 수 있습니다. 일반 client-server 시작만 TCP의 유일한 경로는 아닙니다.
- packet 캡처 한 장면만으로 전체 연결을 확정하지 않고 양 끝 상태·timeout·정리를 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 양쪽이 능동 SYN을 보내면 SYN-SENT에서 상대 SYN을 받아 SYN-RECEIVED 등 해당 상태 규칙을 거쳐 연결을 동기화할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: TCP 연결에서 클라이언트가 SYN+ACK을 받은 뒤 마지막 ACK을 보냅니다. 양쪽은 이 과정으로 무엇을 확인하며 마지막 ACK이 유실되면 어떻게 되나요?](/tech-interview/questions/tcp-three-way-handshake/)

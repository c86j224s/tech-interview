---
id: "send-completion-versus-business-ack"
title: "로컬 송신 완료를 받았습니다. 상대 애플리케이션이 메시지를 처리했음을 확인하려면 어떤 ACK와 상태가 필요한가요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","WSASend","순서 보장","심화 질문"]
related: ["iocp-send-order","tcp-stream-message-framing","message-ordering-scope"]
promotedFrom: {"id":"iocp-send-order","prompt":"송신 완료와 상대 애플리케이션 처리 ACK 사이의 상태를 어떻게 모델링할까요?"}
---

# 로컬 송신 완료를 받았습니다. 상대 애플리케이션이 메시지를 처리했음을 확인하려면 어떤 ACK와 상태가 필요한가요?

## 구두 답변

로컬 송신 완료는 OS가 buffer 사용을 끝낸 지점 등 전송 API의 계약이며 상대 앱의 파싱·DB commit 확인이 아닙니다. 중요 메시지에는 논리 ID와 상대 처리 ACK·결과 조회가 필요합니다.

ACK 유실이면 상대는 처리했을 수 있어 같은 ID로 재전달해 중복을 막습니다. TCP 재연결 뒤 byte stream 상태와 업무 원장은 분리합니다. 송신·수신·처리·ACK 시각을 따로 기록합니다.

## 득점 포인트

- 로컬 송신 완료는 OS가 buffer 사용을 끝낸 지점 등 전송 API의 계약이며 상대 앱의 파싱·DB commit 확인이 아닙니다. 중요 메시지에는 논리 ID와 상대 처리 ACK·결과 조회가 필요합니다.
- 송신·수신·처리·ACK 시각을 따로 기록합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 로컬 송신 완료는 OS가 buffer 사용을 끝낸 지점 등 전송 API의 계약이며 상대 앱의 파싱·DB commit 확인이 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 스레드가 같은 소켓에 메시지를 WSASend로 보냅니다. 제출 순서와 완료 순서가 다를 때 메시지와 버퍼를 어떻게 관리하나요?](/tech-interview/questions/iocp-send-order/)

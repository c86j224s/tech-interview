---
id: "wsabuf-descriptor-payload-lifetime"
title: "WSASend의 WSABUF 배열과 payload·OVERLAPPED는 같은 수명인가요? 호출 반환 뒤 무엇을 유지해야 하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","WSASend","순서 보장","심화 질문"]
related: ["iocp-send-order","tcp-stream-message-framing","message-ordering-scope"]
promotedFrom: {"id":"iocp-send-order","prompt":"scatter/gather의 WSABUF 배열과 실제 데이터 각각의 수명을 어떤 객체로 묶을까요?"}
---

# WSASend의 WSABUF 배열과 payload·OVERLAPPED는 같은 수명인가요? 호출 반환 뒤 무엇을 유지해야 하나요?

## 구두 답변

overlapped WSASend는 반환 전에 WSABUF descriptor를 포착하므로 배열 자체가 stack에 있을 수 있습니다. 실제 payload와 OVERLAPPED는 작업 완료까지 유효해야 한다는 별도 수명입니다.

함수별 문서를 확인하고 수신 API까지 같은 규칙으로 일반화하지 않습니다. payload 재사용·동시 송신·즉시 완료·취소에서 실제 사용 종료 뒤 한 번만 반환합니다.

## 득점 포인트

- overlapped WSASend는 반환 전에 WSABUF descriptor를 포착하므로 배열 자체가 stack에 있을 수 있습니다. 실제 payload와 OVERLAPPED는 작업 완료까지 유효해야 한다는 별도 수명입니다.
- payload 재사용·동시 송신·즉시 완료·취소에서 실제 사용 종료 뒤 한 번만 반환합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: overlapped WSASend는 반환 전에 WSABUF descriptor를 포착하므로 배열 자체가 stack에 있을 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 스레드가 같은 소켓에 메시지를 WSASend로 보냅니다. 제출 순서와 완료 순서가 다를 때 메시지와 버퍼를 어떻게 관리하나요?](/tech-interview/questions/iocp-send-order/)

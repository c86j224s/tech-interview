---
id: "iocp-user-packet-tagging"
title: "IOCP에 사용자 패킷을 직접 게시합니다. 커널 I/O 완료와 종료·제어 패킷을 어떤 타입 규약으로 구분하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","Windows","OVERLAPPED","심화 질문"]
related: ["iocp-completion-key-overlapped","io-readiness-vs-completion"]
promotedFrom: {"id":"iocp-completion-key-overlapped","prompt":"사용자 정의 패킷에서 OVERLAPPED null 규약과 커널 완료를 어떤 타입 정보로 분리할까요?"}
---

# IOCP에 사용자 패킷을 직접 게시합니다. 커널 I/O 완료와 종료·제어 패킷을 어떤 타입 규약으로 구분하나요?

## 구두 답변

PostQueuedCompletionStatus로 게시한 패킷도 성공 반환과 nonnull OVERLAPPED를 가질 수 있습니다. 키·태그·예약한 포인터 규약으로 커널 완료와 사용자 제어를 구분합니다.

null 포인터만으로 모든 실패·종료를 해석하지 않습니다. 제어 payload 수명을 유지하고 GQCS 반환·OVERLAPPED·오류의 조합을 표로 검사합니다.

## 득점 포인트

- PostQueuedCompletionStatus로 게시한 패킷도 성공 반환과 nonnull OVERLAPPED를 가질 수 있습니다. 키·태그·예약한 포인터 규약으로 커널 완료와 사용자 제어를 구분합니다.
- 제어 payload 수명을 유지하고 GQCS 반환·OVERLAPPED·오류의 조합을 표로 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: PostQueuedCompletionStatus로 게시한 패킷도 성공 반환과 nonnull OVERLAPPED를 가질 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 한 소켓에서 수신과 송신을 동시에 제출했습니다. IOCP 완료를 받을 때 어느 연결의 어느 작업인지 completion key와 OVERLAPPED로 어떻게 구분하나요?](/tech-interview/questions/iocp-completion-key-overlapped/)

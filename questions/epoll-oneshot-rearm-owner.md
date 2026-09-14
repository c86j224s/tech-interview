---
id: "epoll-oneshot-rearm-owner"
title: "EPOLLONESHOT으로 연결을 한 worker에게 맡깁니다. 처리·소유권 반환·재무장 순서에서 무엇을 지켜야 하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["비동기","논블로킹 I/O","이벤트 루프","epoll","IOCP","버퍼 수명","심화 질문"]
related: ["io-readiness-vs-completion","async-api-and-blocking","tcp-stream-message-framing"]
promotedFrom: {"id":"io-readiness-vs-completion","prompt":"EPOLLONESHOT으로 연결 소유권을 넘길 때 언제 재무장해야 이벤트를 놓치지 않을까요?"}
---

# EPOLLONESHOT으로 연결을 한 worker에게 맡깁니다. 처리·소유권 반환·재무장 순서에서 무엇을 지켜야 하나요?

## 구두 답변

EPOLLONESHOT은 알림 후 재무장 전까지 해당 등록의 이벤트를 비활성화하는 데 사용합니다. worker가 비블로킹 I/O·상태 갱신을 끝내고 소유권과 rearm을 일관된 규칙으로 연결해야 합니다.

readiness는 실제 read 성공 보장이 아니므로 EAGAIN·부분 처리·EOF를 처리합니다. rearm 직전 새 데이터·종료·다른 worker 접근을 시험하고 단순 플래그만으로 메모리 수명을 보장하지 않습니다.

## 득점 포인트

- EPOLLONESHOT은 알림 후 재무장 전까지 해당 등록의 이벤트를 비활성화하는 데 사용합니다. worker가 비블로킹 I/O·상태 갱신을 끝내고 소유권과 rearm을 일관된 규칙으로 연결해야 합니다.
- rearm 직전 새 데이터·종료·다른 worker 접근을 시험하고 단순 플래그만으로 메모리 수명을 보장하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: EPOLLONESHOT은 알림 후 재무장 전까지 해당 등록의 이벤트를 비활성화하는 데 사용합니다.

## 더 파고들 거리

- [기본 상황과 비교: epoll은 읽기 가능 알림을, IOCP는 제출한 읽기의 완료를 줍니다. 데이터를 읽는 시점과 버퍼 관리는 어떻게 달라지나요?](/tech-interview/questions/io-readiness-vs-completion/)

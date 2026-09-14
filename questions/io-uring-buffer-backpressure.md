---
id: "io-uring-buffer-backpressure"
title: "io_uring으로 완료 기반 I/O를 쓰면 버퍼 수명과 제출 큐·완료 큐의 backpressure는 어떻게 관리하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["비동기","논블로킹 I/O","이벤트 루프","epoll","IOCP","버퍼 수명","심화 질문"]
related: ["io-readiness-vs-completion","async-api-and-blocking","tcp-stream-message-framing"]
promotedFrom: {"id":"io-readiness-vs-completion","prompt":"io_uring에서도 남는 버퍼 수명과 백프레셔 문제는 무엇일까요?"}
---

# io_uring으로 완료 기반 I/O를 쓰면 버퍼 수명과 제출 큐·완료 큐의 backpressure는 어떻게 관리하나요?

## 구두 답변

완료 기반이어도 제출한 buffer·user_data·작업 context는 해당 연산의 실제 종료까지 유효해야 합니다. SQ·CQ의 크기와 처리 예산, overflow·제출 실패의 지원 계약을 확인합니다.

registered·provided buffer와 일반 buffer의 소유·반환 규칙이 다를 수 있습니다. cancel 요청과 원래 완료가 모두 관찰될 수 있어 개별 operation 상태로 정리합니다. 커널 버전·opcode별 계약을 IOCP와 동일시하지 않습니다.

## 득점 포인트

- 완료 기반이어도 제출한 buffer·user_data·작업 context는 해당 연산의 실제 종료까지 유효해야 합니다. SQ·CQ의 크기와 처리 예산, overflow·제출 실패의 지원 계약을 확인합니다.
- 커널 버전·opcode별 계약을 IOCP와 동일시하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 완료 기반이어도 제출한 buffer·user_data·작업 context는 해당 연산의 실제 종료까지 유효해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: epoll은 읽기 가능 알림을, IOCP는 제출한 읽기의 완료를 줍니다. 데이터를 읽는 시점과 버퍼 관리는 어떻게 달라지나요?](/tech-interview/questions/io-readiness-vs-completion/)

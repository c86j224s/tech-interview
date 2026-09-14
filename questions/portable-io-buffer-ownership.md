---
id: "portable-io-buffer-ownership"
title: "IOCP와 epoll을 같은 인터페이스로 감쌉니다. 버퍼 소유·준비·완료·취소를 어느 계층에서 표현하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","epoll","이식성","심화 질문"]
related: ["windows-epoll-porting","io-readiness-vs-completion"]
promotedFrom: {"id":"windows-epoll-porting","prompt":"공통 I/O 인터페이스의 버퍼 소유를 호출자와 OS 어댑터 중 어디에 둘까요?"}
---

# IOCP와 epoll을 같은 인터페이스로 감쌉니다. 버퍼 소유·준비·완료·취소를 어느 계층에서 표현하나요?

## 구두 답변

공통 인터페이스는 준비 알림 뒤 실제 read가 필요한지, 제출 후 OS가 buffer를 소유하는지 명시해야 합니다. 단순 read-ready와 read-complete를 같은 callback 의미로 숨기면 수명 오류가 생깁니다.

어댑터는 플랫폼별 즉시 성공·pending·취소·EOF·부분 처리를 규약에 맞춰 변환합니다. 호출자와 OS 참조의 종료 조건을 구분하고 bounded queue를 둡니다. Windows·Linux를 각각 실제 환경에서 검증해야 합니다.

## 득점 포인트

- 공통 인터페이스는 준비 알림 뒤 실제 read가 필요한지, 제출 후 OS가 buffer를 소유하는지 명시해야 합니다. 단순 read-ready와 read-complete를 같은 callback 의미로 숨기면 수명 오류가 생깁니다.
- Windows·Linux를 각각 실제 환경에서 검증해야 합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 공통 인터페이스는 준비 알림 뒤 실제 read가 필요한지, 제출 후 OS가 buffer를 소유하는지 명시해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: Windows IOCP 서버를 Linux epoll로 이식할 때 완료 통지와 준비 통지의 차이를 연결 상태 머신에 어떻게 반영하나요?](/tech-interview/questions/windows-epoll-porting/)

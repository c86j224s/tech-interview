---
id: signals-handler-safe
title: >-
  SIGTERM handler에서 printf와 malloc을 호출하려 합니다. async-signal-safe가 필요한 이유와 안전한 종료
  신호 처리 패턴은 무엇인가요?
difficulty: 하
category: 보안
tags:
  - signal
  - async-signal-safe
  - handler
  - 종료
related:
  - graceful-shutdown
---
# SIGTERM handler에서 printf와 malloc을 호출하려 합니다. async-signal-safe가 필요한 이유와 안전한 종료 신호 처리 패턴은 무엇인가요?

## 구두 답변

`printf`와 `malloc`은 일반적인 signal handler에서 호출하지 않는 것이 맞습니다. `thread-safe`는 여러 thread가 정상 호출을 동시에 수행해도 안전하다는 뜻일 수 있지만, async signal은 같은 thread가 함수 내부의 stdio lock·buffer 또는 allocator free list를 갱신하는 임의의 순간에 끼어듭니다. 그 handler가 다시 `printf`를 호출하면 자신이 보유한 내부 lock을 기다리거나 중간 buffer를 훼손할 수 있고, `malloc`도 중간 자료구조를 재진입해 불변식을 깨뜨릴 수 있습니다. POSIX portable 경로는 `signal-safety(7)`의 async-signal-safe 함수 집합으로 좁혀야 하며, `errno`를 다룬다면 진입 시 저장하고 반환 전 복구합니다.

안전한 패턴은 handler가 `volatile sig_atomic_t` flag를 세우거나 self-pipe의 write처럼 제한된 통지만 수행하고, main loop가 정상 문맥에서 accept 중단·worker drain·로그·free·join을 처리하는 구조입니다. 예를 들어 SIGTERM을 받으면 flag가 1이 되고 loop가 다음 작업 경계에서 종료 절차를 시작합니다. pipe가 가득 차 write가 `EAGAIN`이어도 flag로 요청을 보존해야 합니다. signal은 진행 중인 DB commit이나 외부 메일을 자동 rollback하지 않으므로 graceful shutdown의 순서와 취소 정책은 본문 thread가 별도로 결정합니다.

flag 패턴도 종료를 즉시 보장하는 것은 아닙니다. main loop가 긴 blocking call 안에 있으면 signal 도착 후 다음 관찰 지점까지 지연될 수 있고, `SA_RESTART` 설정에 따라 system call의 EINTR 관찰이 달라질 수 있습니다. 그래서 graceful shutdown 테스트에서는 새 요청 수락 시각, 현재 작업의 commit 경계, worker join 완료를 순서대로 검사합니다. 전용 `sigwait`를 쓰면 복잡한 정리를 정상 thread에서 할 수 있지만, 시작 전에 모든 worker가 signal을 block했는지 확인해야 합니다.


## 득점 포인트

- thread-safe와 async-signal-safe의 재진입 차이를 stdio lock과 allocator 중간 상태로 구체화합니다.
- handler에서 flag 또는 제한된 통지만 하고 복잡한 정리는 정상 실행 흐름으로 넘깁니다.
- self-pipe 포화와 `errno` 보존을 포함해 단순 flag 이상의 경계를 제시합니다.
- signal 도착이 외부 DB 변경·메일·socket 상태를 자동 rollback하지 않는다고 종료 계약을 분리합니다.

## 감점 포인트

- `printf`가 단순 출력이므로 signal 중에도 안전하다고 말합니다.
- logging mutex를 추가하면 handler 재진입 문제가 자동으로 해결된다고 설명합니다.
- handler에서 `malloc`한 메시지를 나중에 free하면 호출 자체가 안전해진다고 주장합니다.
- SIGTERM을 받는 순간 모든 worker와 외부 효과가 즉시 정리된다고 단정합니다.

## 더 파고들 거리

- self-pipe의 write가 `EAGAIN`일 때 종료 요청을 잃지 않게 flag와 event loop를 어떤 순서로 결합할까요?
- handler 대신 모든 worker가 signal을 block하고 전용 `sigwait` thread가 처리하는 방식은 어떤 관찰성과 시작 경쟁을 개선할까요?

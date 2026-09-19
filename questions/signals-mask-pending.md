---
id: signals-mask-pending
title: >-
  스레드가 SIGUSR1을 block한 동안 신호가 도착했습니다. blocked, pending, delivered 상태를 어떻게 구분하며
  mask를 언제 바꾸나요?
difficulty: 하
category: 운영체제
tags:
  - signal
  - mask
  - pending
  - thread
related:
  - process-state-suspended
---
# 스레드가 SIGUSR1을 block한 동안 신호가 도착했습니다. blocked, pending, delivered 상태를 어떻게 구분하며 mask를 언제 바꾸나요?

## 구두 답변

blocked는 특정 thread의 signal mask가 현재 delivery를 허용하지 않는 상태이고, pending은 signal이 발생했지만 아직 disposition이 실행되지 않은 상태이며, delivered는 handler 또는 default 동작으로 제어가 넘어간 상태입니다. T1이 SIGUSR1을 block한 중 `pthread_kill(T1, SIGUSR1)`을 받으면 T1 대상 pending으로 남을 수 있고, T1이 unblock한 뒤 disposition에 따라 handler가 실행됩니다. 그러나 `kill(pid, SIGUSR1)`은 process-directed이므로 T1만 보는 것이 아닙니다. T1이 block하고 T2가 허용하면 Linux에서는 적절한 허용 thread인 T2가 받을 수 있습니다.

따라서 mask를 바꾸기 전에 signal을 누가 소비할지 정해야 합니다. 전용 `sigwait` thread 패턴이라면 시작할 때 worker들이 먼저 해당 signal을 block하고 waiter가 기다리게 해야, 임의 worker의 handler가 먼저 실행되는 경쟁을 줄일 수 있습니다. block이 signal을 삭제하는 것은 아니며, 일반 signal을 여러 번 보냈다고 모든 횟수가 realtime queue처럼 보존된다고도 가정할 수 없습니다. signal 전달 규칙은 Linux `signal(7)`과 POSIX `pthread_sigmask`, `kill`, `pthread_kill`을 구분해 확인하고, handler 함수의 호출 제한은 별도로 signal-safety 문서로 판단합니다.

시간축을 더 세밀하게 쓰면 T1이 block한 시점, signal 생성 시점, pending 관찰 시점, unblock 시점, handler 진입 시점을 따로 기록할 수 있습니다. T2가 허용된 process-directed signal을 먼저 소비하면 T1의 pending을 기다리는 실험과는 다른 결과입니다. 반대로 T1 대상 signal은 T2가 대신 처리한다고 바꾸어 말할 수 없습니다. 이 차이를 테스트하려면 송신 API와 thread ID를 로그에 남기고, signal 번호만 기록하는 추상화는 피합니다.


## 득점 포인트

- blocked→pending→delivered를 같은 순간의 상태가 아니라 시간 순서와 disposition 적용 단계로 나눕니다.
- T1 block·T2 allow 상태에서 process-directed와 thread-directed signal의 결과가 달라지는 수치 없는 실행 trace를 제시합니다.
- 전용 waiter를 만들 때 worker mask 초기화 순서가 delivery 경쟁을 줄인다는 설계 이유를 설명합니다.
- standard signal의 coalescing 가능성과 async-signal-safe 함수 제한을 서로 다른 source scope로 둡니다.

## 감점 포인트

- block이 signal을 삭제하거나 pending 상태를 만들 수 없다고 설명합니다.
- process-directed signal이 항상 `kill` 호출 thread에서 handler를 실행한다고 말합니다.
- pending set을 모든 signal 발생 횟수를 보존하는 큐로 취급합니다.
- signal mask, disposition, handler safety를 하나의 process 전역 상태로 합칩니다.

## 더 파고들 거리

- T1과 T2가 모두 SIGUSR1을 block한 뒤 서로 다른 시점에 unblock하면 pending 소비 thread와 관찰 순서가 어떻게 달라질까요?
- 전용 `sigwait` thread의 시작·종료 사이에 발생한 signal이 유실되지 않도록 어떤 mask와 handoff 순서를 사용할까요?

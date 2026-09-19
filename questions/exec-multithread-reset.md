---
id: exec-multithread-reset
title: >-
  여러 스레드가 있는 프로세스가 exec에 성공했습니다. 호출 thread 외의 스레드와 그들이 잡고 있던 사용자 공간 lock은 어떻게
  되나요?
difficulty: 중하
category: 동시성
tags:
  - exec
  - 멀티스레드
  - lock
  - image replacement
related:
  - process-vs-thread
  - deadlock-prevention
---
# 여러 스레드가 있는 프로세스가 exec에 성공했습니다. 호출 thread 외의 스레드와 그들이 잡고 있던 사용자 공간 lock은 어떻게 되나요?

## 구두 답변

성공한 exec는 호출 thread만 새 코드로 바꾸고 나머지를 계속 두는 동작이 아닙니다. 현재 process image가 교체되고, 호출 thread 외의 기존 thread는 종료되며 새 image는 initial thread에서 시작합니다. T2가 전역 userspace mutex를 잡고 로그를 쓰는 동안 T1이 exec를 성공시켰다면 T2의 unlock, C++ destructor, allocator 정리가 새 image에서 뒤늦게 실행되지 않습니다. old heap·stack·thread-local 상태를 새 image가 정상적인 공유 lock 상태로 이어받는다고 가정할 수 없습니다.

반면 inherited socket, open file description, shared memory처럼 kernel 또는 외부에 남을 수 있는 자원은 별도 계약입니다. 새 image가 그 자원을 사용할 수 있다는 사실이 old userspace lock의 소유권까지 보존한다는 뜻은 아닙니다. 필요한 handoff는 exec 전에 lock 밖에서 완료하거나, journal·세대 번호·복구 표식을 남겨 새 image가 중간 상태를 감지하게 합니다. fork 후 exec의 child처럼 동작할 때는 멀티스레드 부모에서 복제된 lock이 중간 상태일 수 있으므로 fork와 exec 사이의 코드를 async-signal-safe한 제한 경로로 좁힙니다. exec가 실패하면 old image와 기존 thread들이 계속 존재하므로 실패 경로도 별도로 검증합니다.

이 경계 때문에 exec를 “정상적인 종료”로 사용하면 안 됩니다. T2의 finally 블록이나 C++ destructor가 실행된다는 기대 대신, 외부 상태를 변경하기 전에 commit marker를 남기고 새 image가 세대 번호를 확인하게 해야 합니다. listener처럼 의도적으로 상속한 kernel 자원은 새 thread가 명시적으로 소유권을 인수하고 닫을 책임을 정해야 합니다. 테스트는 T2가 lock 보유 중인 순간에 exec를 성공시키는 경우와 `execve`가 ENOENT로 실패하는 경우를 분리해, 성공에서는 T2가 없고 실패에서는 T2가 남는다는 차이를 확인합니다.


## 득점 포인트

- “호출 thread만 교체”가 아니라 성공 시 다른 thread가 종료되고 새 initial thread가 시작된다는 규칙을 설명합니다.
- T2가 mutex를 보유한 상태에서 T1이 exec하는 중간 상태와, T2의 unlock/destructor가 없다는 결과를 추적합니다.
- userspace lock과 inherited kernel resource를 분리하고 handoff·journal·복구 표식을 제시합니다.
- multithread fork 후 exec의 제한 경로와 exec 실패 시 기존 thread 보존을 함께 다룹니다.

## 감점 포인트

- exec 후 T2가 old code에서 계속 실행되어 lock을 풀어 준다고 합니다.
- 새 image가 같은 heap 주소를 보므로 userspace mutex를 자동으로 상속한다고 설명합니다.
- 성공한 exec에서 C++ destructor와 정상 shutdown callback이 모두 실행된다고 합니다.
- fork와 exec가 모두 새 process를 만드는 동일한 동작이라고 말합니다.

## 더 파고들 거리

- exec 전에 외부 DB 변경을 기록해야 한다면 새 image가 partial handoff를 식별할 commit marker와 generation을 어떻게 설계할까요?
- supervisor가 PID만 봐서는 같은 process의 재exec를 구별할 수 없을 때 readiness epoch과 startup handshake를 어떻게 둘까요?

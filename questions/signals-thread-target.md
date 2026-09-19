---
id: signals-thread-target
title: >-
  멀티스레드 프로세스에서 한 스레드의 작업을 중단하려고 signal을 보냅니다. process-directed와 thread-directed
  signal의 대상 선택은 어떻게 다른가요?
difficulty: 중하
category: 동시성
tags:
  - signal
  - thread
  - pthread_kill
  - mask
related:
  - java-interrupt-cooperation
---
# 멀티스레드 프로세스에서 한 스레드의 작업을 중단하려고 signal을 보냅니다. process-directed와 thread-directed signal의 대상 선택은 어떻게 다른가요?

## 구두 답변

`kill(pid, sig)` 같은 process-directed signal은 process를 대상으로 하므로, Linux에서는 그 signal을 block하지 않은 적절한 thread 중 하나가 받을 수 있습니다. 특정 worker T1의 작업을 겨냥하는 목적이라면 process-directed 호출만으로는 handler 실행 thread를 정확히 고정할 수 없습니다. `pthread_kill(T1, sig)`는 지정 thread에 전달을 요청하는 thread-directed 경로이며, T1이 signal을 block하고 있으면 그 thread의 pending 상태로 남을 수 있습니다. 예를 들어 T1·T2가 SIGUSR1을 block하고 T3만 허용하면 process-directed signal은 T3에서 handler를 실행할 수 있습니다. 같은 시점에 T1을 thread-directed로 지정하면 T1이 unblock할 때까지 T1 대상 delivery가 미뤄질 수 있습니다.

다만 특정 thread에 보냈다고 현재 함수를 안전하게 중단하거나 외부 효과를 rollback하는 것은 아닙니다. handler는 임의 지점에서 실행되므로 lock·파일·DB 상태를 직접 정리하면 async-signal-safety 문제가 생깁니다. handler가 제한된 flag나 통지만 남기고 T1의 정상 작업 loop가 cancellation token과 상태를 확인하게 하는 협력 모델이 안전합니다. 기록에는 signal 종류, 대상 thread ID, mask, pending, 실제 handler 실행 thread, 작업 종료 시각을 남겨 process 선택과 작업 취소를 구분합니다.

대상 선택과 취소 완료 사이에는 별도의 시간 간격이 있습니다. T1이 signal을 받더라도 handler가 flag만 기록하고 T1이 현재 item을 안전하게 끝낼 수 있으며, T1이 blocked system call이나 비가역 외부 작업 중이면 종료가 늦어질 수 있습니다. 따라서 supervisor는 “전달 성공”을 “작업 종료”로 해석하지 말고, thread-directed 요청의 반환 결과와 worker가 보낸 종료 acknowledgment를 각각 기다립니다. 강제 종료가 필요한 경우 signal handler에 정리를 추가하는 대신 process 격리나 supervisor kill 같은 더 거친 경계를 선택합니다.


## 득점 포인트

- process-directed는 허용된 thread 중 하나를 선택하고 thread-directed는 지정 thread의 mask를 따른다는 대비를 제시합니다.
- T1·T2 block, T3 allow, T1 지정 신호라는 구체 상태로 두 API의 delivery trace를 설명합니다.
- signal delivery, handler 실행, 작업 취소, 외부 rollback을 서로 다른 계약으로 분리합니다.
- 취소 요청을 정상 코드에서 소비하도록 flag·token·전용 waiter를 결합합니다.

## 감점 포인트

- process-directed signal은 항상 `kill`을 호출한 thread에서 실행된다고 말합니다.
- `pthread_kill`이 현재 함수와 모든 자원을 즉시 안전하게 중단한다고 설명합니다.
- mask가 process 전체에 하나뿐이라 worker마다 다른 수신 정책을 만들 수 없다고 합니다.
- signal 한 번으로 DB 변경·하위 작업·네트워크 효과가 자동 취소된다고 단정합니다.

## 더 파고들 거리

- 대상 worker가 SIGUSR1을 영구 block하면 signal 외에 cancellation token이나 supervisor IPC를 어떤 기준으로 추가할까요?
- 전용 signal waiter와 각 worker handler 중 어느 구조가 handler safety와 종료 순서 관찰을 더 쉽게 만드는지 비교해 보세요.

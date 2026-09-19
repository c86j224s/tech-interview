---
id: signals-disposition-exec
title: >-
  execve 뒤 설치했던 signal handler가 사라졌습니다. 어떤 disposition은 default로 돌아가고 어떤 상태는 남는지
  어떻게 확인하나요?
difficulty: 하
category: 운영체제
tags:
  - signal
  - execve
  - disposition
  - 프로세스
related: []
---
# execve 뒤 설치했던 signal handler가 사라졌습니다. 어떤 disposition은 default로 돌아가고 어떤 상태는 남는지 어떻게 확인하나요?

## 구두 답변

`execve` 성공은 새 PID를 만드는 것이 아니라 현재 process의 image를 교체하는 일입니다. 따라서 old image에 설치된 caught handler의 함수 주소는 새 image에서 사용할 수 없어 `SIG_DFL`로 재설정됩니다. Linux와 POSIX는 ignored disposition을 별도 범주로 다루며, Linux에서는 ignored signal이 유지되고 SIGCHLD 관련 예외를 확인해야 합니다. 반면 signal mask와 pending signal은 disposition처럼 reset된다고 보지 않습니다. POSIX exec 규칙에 따르면 호출 thread의 mask와 pending 상태가 새 initial thread의 시작 상태에 이어지고, XSI/Linux alternate signal stack은 폐기되는 범주입니다.

예를 들어 exec 전 SIGUSR1에는 handler, SIGPIPE에는 ignore, SIGTERM에는 block을 설정하면 성공 뒤 SIGUSR1은 default가 되고 SIGPIPE ignore는 유지되는 규칙을 적용합니다. SIGTERM은 호출 thread의 block 상태를 새 initial thread가 이어받으므로, 새 프로그램이 시작하자마자 unblock할지 명시해야 합니다. 확인 시 PID, 각 signal disposition, calling thread mask, pending set, alternate stack을 별도 항목으로 기록해야 합니다. exec가 실패하면 old image가 그대로 실행되므로 실패 반환 경로를 성공 결과와 섞으면 안 됩니다.

관찰 표에서 “pending”의 소유 범위도 명시해야 합니다. 호출 thread의 pending과 process-directed pending을 하나의 행으로 합치면 새 initial thread가 어떤 대기를 보는지 잘못 해석할 수 있습니다. 또한 새 image가 시작한 뒤 `sigaction`으로 caught handler를 다시 설치하고 `pthread_sigmask`로 inherited block을 조정하는지 startup 코드를 확인합니다. exec 실패 경로에서는 기존 handler가 그대로 남으므로, 실패를 성공 뒤의 default disposition과 비교하지 말고 반환 직후의 old image에서 확인해야 합니다.


## 득점 포인트

- caught handler reset, ignored disposition 보존, mask·pending 상속, alternate stack 폐기를 표로 분리합니다.
- SIGUSR1 handler·SIGPIPE ignore·SIGTERM block이라는 동일한 입력 상태에서 exec 전후 결과를 추적합니다.
- Linux 계약과 POSIX/XSI 범위를 나누고 SIGCHLD 예외를 무조건 생략하지 않습니다.
- exec 성공과 실패에서 PID와 관찰 가능한 image가 어떻게 다른지 검증 절차를 제시합니다.

## 감점 포인트

- exec가 새 process와 새 PID를 만든다고 설명합니다.
- 설치된 handler·ignored disposition·mask를 모두 default로 돌린다고 단정합니다.
- handler가 사라졌으므로 pending signal도 반드시 삭제된다고 추론합니다.
- Linux 구현 설명을 모든 POSIX 옵션과 alternate stack에 무조건 동일하게 적용합니다.

## 더 파고들 거리

- 새 image가 inherited mask 때문에 초기화 signal을 받지 못하는 문제를 startup assertion으로 어떻게 발견할까요?
- SIGPIPE ignore를 상속하지 않으려면 새 image가 어떤 초기화 순서로 disposition을 재설정해야 할까요?

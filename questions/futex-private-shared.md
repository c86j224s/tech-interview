---
id: futex-private-shared
title: >-
  프로세스 안에서만 쓰는 lock과 shared memory에 놓인 lock의 futex flag를 다르게 둡니다. private futex
  최적화의 전제는 무엇인가요?
difficulty: 중하
category: 동시성
tags:
  - futex
  - private
  - shared memory
  - 프로세스
related:
  - process-vs-thread
---
# 프로세스 안에서만 쓰는 lock과 shared memory에 놓인 lock의 futex flag를 다르게 둡니다. private futex 최적화의 전제는 무엇인가요?

## 구두 답변

`FUTEX_PRIVATE_FLAG`의 전제는 주소가 현재 한 프로세스에서 보인다는 것이 아니라, 실제로 이 futex를 기다리고 깨울 모든 참여자가 같은 process에 속한다는 설계 보장입니다. 같은 프로세스의 스레드만 lock word를 사용하면 private 연산으로 process-shared 대기 키를 고려하는 경로를 줄일 수 있습니다. 초기 word=1에서 같은 process의 B가 private WAIT를 하고 A가 private WAKE를 하는 경우가 이 계약에 맞습니다.

반대로 shared memory mapping에 lock을 놓고 process A와 B가 함께 기다리면 process-shared 연산을 사용해야 합니다. private로 남겨 두면 다른 process의 waiter가 동일한 대기 계약으로 매칭되지 않을 수 있습니다. `fork` 뒤 virtual address가 우연히 같아 보인다는 사실은 충분한 증거가 아닙니다. mapping이 두 프로세스에 실제로 공유되고, unmap 또는 종료 중에도 waiter가 참조하는 word와 관련 객체의 lifetime이 유효해야 합니다. 테스트가 단일 process였다는 이유로 미래의 IPC 확장을 허용하면 안 됩니다.

flag 선택은 데이터 복구와 별개입니다. process-shared futex가 owner 사망을 알려주더라도 lock 아래 데이터가 반쯤 갱신된 상태를 자동 복구하지 않습니다. robust mutex, journal, 세대 번호와 상태 정정 중 어떤 정책을 쓸지 상위 설계에 둡니다. 따라서 결정표에는 동기화 참여 process 집합, mapping lifetime, unmap 종료 순서, owner death 복구를 각각 기록합니다. raw futex의 private 최적화 주장은 Linux man-pages 범위로 한정하고, pthread의 `PTHREAD_PROCESS_SHARED` 내부 구현을 모든 libc에 일반화하지 않겠습니다.

## 득점 포인트

- private의 전제를 virtual address가 아니라 실제 동기화 참여 process 집합으로 정의합니다.
- 단일 process thread와 두 process shared mapping에서 private/process-shared 선택을 대비합니다.
- mapping lifetime과 owner death 데이터 복구를 futex key scope와 별도 설계합니다.

## 감점 포인트

- 현재 테스트가 단일 process였다는 이유로 미래 IPC lock을 private로 고정하면 안 됩니다.
- 주소가 같아 보인다는 이유로 다른 process의 private key가 자동으로 일치한다고 가정하면 안 됩니다.
- process-shared 선택이 반쯤 갱신된 데이터나 owner death를 자동 복구한다고 말하면 안 됩니다.

## 더 파고들 거리

- fork와 별도 shared mapping의 참여자·주소 수명·unmap 종료 순서를 표로 비교합니다.
- robust mutex·journal·세대 번호 중 어떤 복구 정책이 필요한지 데이터 불변식 기준으로 결정합니다.

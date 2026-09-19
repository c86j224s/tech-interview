---
id: futex-timeout-interrupt
title: futex wait가 timeout이나 signal로 돌아왔습니다. 반환 뒤 lock word를 다시 검사해야 하는 이유는 무엇인가요?
difficulty: 하
category: 동시성
tags:
  - futex
  - timeout
  - signal
  - 재시도
related:
  - deadline-cancellation-propagation
---
# futex wait가 timeout이나 signal로 돌아왔습니다. 반환 뒤 lock word를 다시 검사해야 하는 이유는 무엇인가요?

## 구두 답변

futex wait가 반환됐다는 것은 커널 대기 상태가 끝났다는 뜻이지 lock ownership을 얻었다는 뜻이 아닙니다. 정상 wake, timeout, signal에 따른 `EINTR`처럼 반환 원인이 무엇이든 현재 futex word와 상위 predicate를 다시 확인하고, 실제 성공은 CAS가 소유 상태를 만든 시점에만 판정합니다. raw futex와 libc wrapper가 timeout·signal을 어떤 errno로 매핑하는지는 사용 중인 kernel/ABI와 source를 확인해야 하므로, 이 답변은 그 정책을 확인한 뒤의 상위 lock 루프를 설명합니다.

deadline=10ms인 B가 t=0에 wait를 시작해 t=9ms에 signal을 받았다고 하겠습니다. word가 1이면 B는 남은 1ms를 기준으로 다시 기다리거나 취소를 반환해야 합니다. word가 0이면 CAS를 먼저 시도할 수 있지만, CAS 실패 뒤 다른 owner가 생기면 다시 predicate를 평가합니다. signal 때마다 새 10ms를 주면 반복 signal로 전체 대기가 무한히 늘어나므로 monotonic absolute deadline에서 `remaining=deadline-now`를 계산합니다. timeout 직후 unlock이 있었더라도 API가 timeout 우선인지 마지막 획득 기회를 허용하는지는 호출자 계약으로 고정합니다.

wake도 경쟁적입니다. B가 깨어난 사이 C가 먼저 CAS를 성공하면 B는 임계 구역에 들어가지 않고 word를 재검사합니다. 객체를 파괴할 때도 WAKE 한 번은 waiter의 syscall과 callback 완료를 보장하는 barrier가 아니므로, 새 대기를 막고 waiter 종료를 확인한 뒤 word와 관련 메모리를 해제합니다. 이 문항은 “반환=성공”이라는 오류를 교정하는 데 초점을 두며, 구체적인 EINTR/ETIMEDOUT 명칭은 Linux man-pages와 libc source를 함께 확인한 결과로만 기록하겠습니다.

## 득점 포인트

- wait 반환과 lock ownership을 분리하고 정상 wake·timeout·signal 모두에서 word와 predicate를 재검사합니다.
- deadline 10ms에서 t=9ms signal 후 남은 1ms만 사용하고 CAS 성공을 최종 조건으로 둡니다.
- raw futex errno와 libc 매핑을 구분하면서 객체 파괴 전 waiter 종료를 확인합니다.

## 감점 포인트

- wait가 반환되면 곧바로 lock을 얻었다고 하면 wake 경쟁과 CAS 실패를 놓칩니다.
- signal마다 새로운 전체 timeout을 주면 absolute deadline과 취소 의미가 깨집니다.
- timeout·EINTR 명칭을 모든 libc에 동일하다고 단정하면 API 범위를 넘습니다.

## 더 파고들 거리

- signal과 unlock이 동시에 오면 timeout 우선인지 마지막 획득 기회인지 호출자 계약으로 정합니다.
- WAKE와 waiter 종료·unmap 사이의 lifetime barrier를 설계합니다.

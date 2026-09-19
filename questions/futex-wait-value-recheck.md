---
id: futex-wait-value-recheck
title: futex 대기 직전에 다른 스레드가 lock을 풀었습니다. FUTEX_WAIT가 기대값을 함께 받는 이유와 EAGAIN 처리는 무엇인가요?
difficulty: 하
category: 동시성
tags:
  - futex
  - FUTEX_WAIT
  - 경합
  - 재검사
related:
  - condition-variable-predicate
---
# futex 대기 직전에 다른 스레드가 lock을 풀었습니다. FUTEX_WAIT가 기대값을 함께 받는 이유와 EAGAIN 처리는 무엇인가요?

## 구두 답변

`FUTEX_WAIT(address, expected)`는 주소만 보고 무조건 잠드는 호출이 아니라, 현재 word가 expected와 같을 때만 compare-and-block을 진행하는 호출입니다. B가 word=1을 읽어 expected=1을 준비한 뒤 A가 unlock하여 word=0으로 바꾸고 wake했다고 하겠습니다. B가 단순 `WAIT(address)`를 했다면 wake가 waiter 등록 전에 지나가 영원히 잠드는 경합이 생길 수 있습니다. expected 비교가 대기 진입과 연결되면 B가 커널에 들어온 시점의 word=0을 발견해 block하지 않고 불일치 경로로 돌아가므로, Linux/glibc 경로에서 흔히 `EAGAIN`으로 처리하는 재시도가 가능합니다. raw syscall의 errno 이름은 사용한 ABI와 wrapper에서 확인합니다.

시간순 trace는 `B read 1 → A store 0 → A WAKE → B WAIT(expected=1) → value mismatch/EAGAIN 경로 → B CAS(0,1)`입니다. EAGAIN은 lock 알고리즘 전체의 치명적 실패가 아니라 “기다릴 조건이 이미 사라졌다”는 재시도 신호입니다. 반대로 word가 여전히 1이면 B가 대기열에 들어갈 수 있습니다. wake 호출 수와 wait 호출 수가 일치해야 한다는 뜻도 아닙니다. wake는 상태를 저장하는 토큰이 아니라 predicate를 다시 확인할 기회입니다.

정상 wake 뒤에도 C가 먼저 CAS를 성공할 수 있으므로 B는 항상 word를 다시 읽고 CAS 또는 상위 predicate를 평가합니다. 반환 정책은 raw futex, libc wrapper, mutex 구현의 오류 매핑을 구분해야 하며, `EINTR`와 timeout까지 같은 while 루프에서 다룰 때 deadline을 유지합니다. 이 질문은 missed wakeup을 피하는 비교 계약에 초점을 두고, 사용자 공간 fast path의 비용이나 pthread 내부 레이아웃을 섞지 않겠습니다. 확인할 때는 unlock 선행, 두 waiter 동시 wake, 객체 lifetime을 각각 재현 표로 분리합니다.

## 득점 포인트

- expected 비교와 block 진입을 연결해 unlock 선행 경합을 value mismatch/EAGAIN 재시도로 처리합니다.
- `B read 1 → A store 0 → WAKE → WAIT(1) → 재시도 → CAS(0,1)`의 중간 상태를 순서대로 말합니다.
- wake 반환과 ownership을 분리하고 libc·ABI별 errno 매핑을 확인합니다.

## 감점 포인트

- wake 횟수와 wait 횟수가 같아야 한다고 하면 wake를 토큰 저장소로 오해한 것입니다.
- EAGAIN을 치명적 오류로 버리면 이미 열린 lock을 놓치는 재시도 경계를 제거합니다.
- WAIT가 반환되는 즉시 임계 구역에 들어가면 다른 waiter의 CAS 경쟁을 무시합니다.

## 더 파고들 거리

- 두 waiter가 동시에 깨어나 한 명만 CAS 성공하는 상태 전이를 적습니다.
- 조건 변수의 while predicate와 futex expected 비교가 같은 missed-wakeup 위험을 어떻게 줄이는지 비교합니다.

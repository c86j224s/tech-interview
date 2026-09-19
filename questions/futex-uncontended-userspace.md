---
id: futex-uncontended-userspace
title: 뮤텍스 획득 경쟁이 없을 때 Linux futex가 매번 커널에 들어가지 않는 이유는 무엇인가요?
difficulty: 하
category: 동시성
tags:
  - futex
  - fast path
  - 원자 연산
  - Linux
related:
  - condition-variable-predicate
---
# 뮤텍스 획득 경쟁이 없을 때 Linux futex가 매번 커널에 들어가지 않는 이유는 무엇인가요?

## 구두 답변

Linux futex가 매번 커널에 들어가지 않는 이유는 futex가 lock 객체 전체를 커널에 맡기는 API가 아니라, 사용자 공간의 원자 상태와 커널의 조건부 대기를 결합하는 인터페이스이기 때문입니다. 초기 lock word가 0이고 A가 `CAS(word, 0, 1)`을 성공시키면 상태는 `0→1`이 되고 A는 syscall 없이 임계 구역에 들어갑니다. 커널은 대기자가 없는 경쟁 없는 획득에 개입할 이유가 없으므로 system-call 왕복, kernel queueing, 스케줄링 비용을 피할 수 있습니다.

B가 도착했을 때 word가 1이면 CAS가 실패합니다. 그러나 실패 즉시 잠들면 안 됩니다. B가 word=1을 읽은 뒤 A가 unlock하여 0으로 바꾸고 wake했을 수 있기 때문입니다. B는 현재 word와 expected를 다시 읽고, 값이 계속 잠금 상태일 때만 `FUTEX_WAIT(address, expected)`라는 slow path를 사용합니다. wait가 반환돼도 소유권을 얻은 것이 아니므로 CAS를 다시 성공시켜야 합니다. 이 fast/slow 경계가 질문의 핵심이며, futex word가 원자라는 사실만으로 보호 데이터의 수명이나 C++ memory order가 자동 해결되지는 않습니다.

구현 선택에서는 unlock의 release와 다음 acquire, waiter 힌트의 정확성, 같은 cache line의 false sharing을 함께 봅니다. 짧은 임계 구역의 경합이 길면 spin-then-futex가 syscall을 줄일 수 있지만 CPU 점유와 전력·oversubscription 비용을 키울 수 있습니다. pthread mutex의 word layout, robust owner death, priority inheritance는 libc와 kernel 구현 계약이므로 raw futex와 동일시하지 않습니다. 이 답변은 Linux man-pages의 uncontended 설명과 expected 비교를 근거로 하며, 실제 syscall 횟수와 p99는 target libc/kernel에서 별도 측정합니다.

## 득점 포인트

- word 0에서 CAS 0→1이 성공하는 fast path와 syscall 왕복을 피하는 이유를 상태로 보여 줍니다.
- CAS 실패 뒤 무조건 sleep하지 않고 현재 word·expected를 재검사해 FUTEX_WAIT로 가는 경계를 설명합니다.
- futex 원자 word와 보호 데이터의 memory order·lifetime·pthread 정책을 분리합니다.

## 감점 포인트

- futex가 항상 커널에서 lock을 획득해 준다고 하면 fast path의 핵심을 거꾸로 설명한 것입니다.
- CAS 실패 즉시 잠들면 unlock과 wait 등록 사이의 missed wakeup을 놓칩니다.
- raw futex가 pthread mutex의 robust·PI·layout 정책을 전부 정한다고 단정하면 범위를 넘습니다.

## 더 파고들 거리

- spin-then-futex를 임계 구역 길이·oversubscription·전력·p99 기준으로 선택합니다.
- futex word와 보호 데이터의 false sharing 및 syscall 횟수와 tail latency를 함께 측정합니다.

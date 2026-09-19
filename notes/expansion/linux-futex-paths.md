---
id: linux-futex-paths
title: Linux futex의 빠른 경로와 느린 경로
topic: 시스템
tags:
  - Linux
  - futex
  - atomic
  - FUTEX_WAIT
  - FUTEX_WAKE
summary: 경합이 없을 때 사용자 공간 원자 연산으로 끝내고 경합 시 값 검증과 커널 대기를 결합하는 futex 계약을 설명합니다.
questionIds: []
prerequisites:
  - condition-variables
  - atomic-publication
related:
  - condition-variables
  - deadlock
reviewedAt: '2026-09-19'
---
# Linux futex의 빠른 경로와 느린 경로

futex는 잠금 그 자체라기보다 사용자 공간의 원자 상태와 커널의 대기·깨우기 기능을 연결하는 Linux 인터페이스입니다. 경쟁이 없을 때 매번 시스템 호출하지 않고 원자 연산만으로 진행하는 것이 빠른 경로이고, 소유자가 이미 점유한 상태라면 futex word를 다시 확인한 뒤 커널 대기열에 들어가는 것이 느린 경로입니다. 이 둘을 섞어 설명하면 “wake가 호출됐으니 다음 waiter가 반드시 그 이벤트를 받는다”거나 “wait가 반환됐으니 lock을 얻었다”는 잘못된 구현을 만들게 됩니다.

man-pages의 futex(2)는 uncontended path가 사용자 공간에 머물 수 있다는 점, `FUTEX_WAIT`가 기대값과 현재 word가 같을 때만 조건부로 block한다는 점, `FUTEX_WAKE`가 waiter를 재개한다는 점, `FUTEX_PRIVATE_FLAG`가 같은 프로세스 전용 최적화라는 점을 설명합니다. pthread mutex의 상위 정책·robustness·priority inheritance는 구현별이므로 이 장의 raw futex 계약과 동일하다고 단정하지 않습니다.

## Futex word와 사용자 공간 상태

futex word는 보통 정렬된 32비트 정수로 두고, 그 값에 잠금 상태·대기자 힌트·세대 정보를 표현합니다. Linux futex 구현은 주소 또는 공유 메모리 위치를 대기 키로 해 `WAIT`와 `WAKE`를 연결하지만, 빠른 경로에서 lock 소유권을 매번 커널 구조체에 기록해 주지는 않습니다. 사용자 공간 코드가 원자 CAS로 free에서 owned로 바꾸면 경쟁 없는 획득은 완료됩니다.

간단한 상태 모델은 다음과 같습니다.

| word | 의미 예시 | 다음 행동 |
| --- | --- | --- |
| 0 | 잠금 없음 | CAS 0→1 시도 |
| 1 | 소유 중, 대기자 정보 없음 | CAS 실패 후 재검사 |
| 2 | 소유 중, waiter 가능 | 기대값 2로 WAIT |
| 0으로 전환 | unlock 완료 | WAKE로 waiter 기회 제공 |

숫자 1과 2의 의미는 애플리케이션 구현이 정하는 것이며 futex syscall이 pthread mutex의 상태 레이아웃을 보장하는 것은 아닙니다. 중요한 것은 상태를 원자적으로 읽고 바꾸며, WAIT 전에 기대값을 정확히 계산하는 것입니다. 비원자 word에 futex를 얹으면 사용자 공간의 경쟁 자체가 깨집니다.

## Uncontended 빠른 경로

락이 비어 있는 상황에서 스레드 A가 `compare_exchange(0, 1)`을 수행하고 성공하면 커널 진입이 필요 없습니다. A는 임계 구역을 실행하고, unlock에서 word를 0으로 바꿉니다. 대기자가 없다는 힌트를 함께 관리한다면 불필요한 `FUTEX_WAKE`도 줄일 수 있습니다.

중간 상태를 숫자로 추적해 보겠습니다. 초기 word가 0이고 A가 먼저 도착한 경우 `0 --CAS(A, 0→1)--> 1`입니다. A의 임계 구역 결과가 7이라면 결과 보호는 word의 소유권과 별개로 A가 lock 아래에서 수행해야 합니다. B가 이후 도착해 0을 기대하고 CAS했지만 현재 1을 읽으면 실패하고, 이때 B는 곧바로 “잠들어야 한다”고 결정하면 안 됩니다. unlock이 이미 일어났을 수 있기 때문입니다.

빠른 경로는 “syscall을 생략한다”는 성능 선택이지 동기화 의미를 생략한다는 뜻이 아닙니다. CAS의 memory order, 보호하는 데이터의 수명, unlock의 release와 다음 acquire를 함께 정해야 합니다. futex가 원자 대기 장치라는 이유로 일반 데이터의 공개 관계가 자동으로 생기지 않습니다.

```diagram
{"title":"경합 없는 futex 획득","caption":"free word를 사용자 공간 CAS로 소유 상태로 바꾸면 kernel wait 없이 임계 구역에 들어갑니다.","rows":[[{"id":"free","label":"futex word = 0","detail":["대기 없음"]}],[{"id":"cas","label":"사용자 공간 CAS","detail":["0 → 1","성공"]}],[{"id":"critical","label":"임계 구역","detail":["syscall 없음"]}]],"edges":[{"from":"free","to":"cas","label":"소유 시도"},{"from":"cas","to":"critical","label":"원자 교환 성공"}]}
```

## FUTEX_WAIT의 Compare-and-Block

B가 word=1을 읽고 잠들 준비를 하는 사이 A가 unlock해 word를 0으로 바꿀 수 있습니다. B가 단순히 `WAIT(address)`를 호출하면 A의 wake가 wait 등록 전에 지나가 대기자가 영원히 잠드는 missed wakeup이 생길 수 있습니다. `FUTEX_WAIT(address, expected)`는 커널이 현재 word를 expected와 비교해 같을 때만 대기 상태로 들어가도록 하므로 이 틈을 줄입니다.

순서를 구체적으로 쓰면 다음과 같습니다.

1. B가 현재 word 1을 읽고 expected=1을 준비합니다.
2. A가 unlock해 word를 0으로 바꾸고 `WAKE`를 호출합니다.
3. B가 `WAIT(expected=1)`로 커널에 들어갑니다.
4. Linux의 compare-and-block 경로는 word가 더 이상 1이 아님을 보고 block하지 않고 불일치 오류 경로로 돌아갑니다. glibc/raw syscall에서 이 경로를 `EAGAIN`으로 매핑하는지는 사용한 ABI와 wrapper를 확인해야 합니다.
5. B는 word를 다시 읽고 CAS를 재시도합니다.

이 비교와 대기 진입이 커널 계약 안에서 연결되므로 unlock과 등록 사이의 경쟁에서 “이미 상태가 바뀌었다”는 정보를 잃지 않습니다. 다만 이 호출이 lock을 획득해 주는 것은 아닙니다. 값 불일치, wake, signal, timeout처럼 어떤 이유로 돌아왔든 현재 word를 다시 보고 소유권을 시도해야 합니다. 이 글의 `EAGAIN` 표기는 Linux/glibc에서 흔히 쓰는 불일치 경로 이름이며, raw syscall 반환을 다른 libc에 그대로 이식하지 않습니다.

## Wake와 Predicate 재검사

`FUTEX_WAKE`는 지정한 대기 키의 waiter를 재개할 기회를 주는 동작입니다. wake 호출 수를 이벤트 저장소처럼 세지 않습니다. waiter가 아직 등록되지 않았거나, 다른 waiter가 먼저 깨어났거나, predicate가 이미 다른 스레드에 의해 소비됐을 수 있습니다. 이 점은 조건 변수에서 notify 자체가 작업을 저장하지 않는다는 설명과 같은 구조를 갖지만, futex는 word 비교와 커널 대기라는 더 낮은 계층의 계약을 직접 노출합니다.

예를 들어 A가 unlock 직후 wake를 하고 B가 깨어났지만 C가 먼저 CAS를 성공했다면 B의 wait 반환은 lock 소유를 뜻하지 않습니다. B가 `return success`로 임계 구역에 들어가면 상호 배제가 깨집니다. 올바른 루프는 대략 다음 의미를 갖습니다.

```text
lock:
    while true:
        if CAS(word, 0, 1) succeeds:
            return acquired
        expected = word.load()
        if expected == 0:
            continue
        result = FUTEX_WAIT(&word, expected)
        if result == value_mismatch or result == EINTR or result == timeout:
            continue_or_return_deadline()
        # wake여도 predicate를 다시 검사
```

이 의사 코드는 설명용이며 실제 메모리 순서, waiter 힌트, 오류 코드 변환, 취소 정책은 구현에 넣어야 합니다. 실행 여부를 검증한 코드는 아닙니다. 특히 timeout 뒤 남은 deadline을 새로 전체 대기 시간으로 재설정하지 않아야 합니다.

## Private와 Process-shared 범위

같은 프로세스 안의 스레드만 futex word를 사용한다면 `FUTEX_PRIVATE_FLAG` 또는 이에 해당하는 private 연산을 선택해 process-shared 대기 키를 고려하는 비용을 줄일 수 있습니다. man-pages는 이 플래그를 같은 프로세스의 스레드 사이에서만 사용되는 futex를 위한 최적화로 설명합니다. 최적화의 전제는 주소가 우연히 같은 프로세스에서 보이는지가 아니라, 실제 동기화 참여자가 다른 프로세스에 걸쳐 있지 않다는 것입니다.

공유 메모리 mapping에 둔 lock을 다른 프로세스가 열 수 있으면 private를 쓰면 안 됩니다. `fork` 이후의 주소가 같아 보이거나 상속된 포인터가 남아 있다는 사실만으로 모든 수명이 private가 되는 것도 아닙니다. 설계 표를 다음처럼 적습니다.

| 공유 범위 | 선택 | 깨지는 전제 |
| --- | --- | --- |
| 한 프로세스의 스레드 | private futex 가능 | 다른 프로세스가 word를 기다리지 않음 |
| 프로세스 간 shared mapping | process-shared 연산 | mapping과 lifetime이 모두 유효 |
| mapping 해제 중 | 어느 쪽도 안전하지 않음 | waiter보다 주소를 먼저 파괴 |

process-shared는 주소가 유효한 동안의 대기 키 문제를 해결할 뿐, 프로세스가 죽은 뒤 보호하던 데이터가 일관된다는 보장은 아닙니다. owner-death 복구, robust mutex, journal 또는 상태 정정 규칙은 상위 설계입니다.

## Timeout·Signal과 소유권

`FUTEX_WAIT`는 timeout이나 signal에 의해 반환될 수 있습니다. 반환 이유가 `wake`인지 `EINTR`인지 timeout인지와 lock 소유권을 구분해야 합니다. timeout이 10ms인 요청에서 B가 9ms 잠들었다가 signal로 돌아오면, word가 0인지 다른 owner인지 확인하고 남은 deadline을 계산합니다. 이미 기한을 넘었으면 새 10ms를 주지 않고 timeout을 반환해야 합니다.

signal로 깨어난 뒤 word가 1이고 다른 스레드가 소유 중이라면 B는 다시 기다리거나 호출자에게 취소를 보고합니다. word가 0이면 CAS를 먼저 재시도할 수 있습니다. 어떤 반환값을 성공으로 매핑할지는 higher-level API의 계약이며, raw futex return을 lock acquired로 번역하면 안 됩니다.

대기 중인 thread를 취소할 때도 waiter 등록과 주소 수명을 분리합니다. 객체를 free하기 전에 대기자를 깨우고, 더 이상 접근하지 않는 것을 확인해야 합니다. `WAKE` 한 번이 모든 waiter의 종료를 확인하는 barrier가 아니며, 큐 객체의 destructor가 진행 중인 syscall의 주소를 안전하게 없애 주지도 않습니다.

## 선택·수명·성능 비용

경합 없는 짧은 lock이 많을 때 사용자 공간 fast path는 syscall과 kernel queueing 비용을 피할 수 있습니다. 그러나 경합이 많아지면 CAS 재시도, cacheline bouncing, 커널 대기·깨우기, 스케줄링 지연이 누적됩니다. 무조건 spin을 늘리는 것이 해답은 아닙니다. 임계 구역 길이, CPU oversubscription, 전력, 우선순위, timeout 요구를 기준으로 spin-then-futex 같은 전략을 별도로 선택합니다.

futex word를 보호 데이터와 같은 cache line에 두면 waiter와 owner의 원자 접근이 다른 필드의 false sharing을 만들 수 있습니다. 반대로 과도한 padding은 메모리를 늘립니다. 측정에서는 uncontended 획득, 짧은 경합, 긴 경합, timeout, 프로세스 간 공유를 나눕니다. 시스템 호출 횟수만 줄고 p99가 나빠졌다면 재시도와 wake storm을 조사합니다.

데이터 불변식은 futex가 자동으로 보존하지 않습니다. lock 아래에서 `balance`와 `count`를 함께 변경했다면 unlock의 공개 관계와 다음 acquire를 통해 두 필드의 상태를 보호해야 합니다. lock을 풀기 전에 포인터를 다른 스레드에 공개했다면 객체 수명과 refcount를 함께 확인합니다. atomic word가 유효하더라도 주소가 먼저 해제되면 wait와 wake 모두 use-after-free가 됩니다.

## 실패 진단과 확인 절차

첫 번째 실패는 CAS 실패 후 무조건 `FUTEX_WAIT`에 들어가는 구현입니다. unlock이 이미 word를 바꾼 경우 expected 비교가 `EAGAIN`을 반환해야 하며, 이를 무시하고 오래 잠들면 진행이 멈춥니다. 두 번째는 wait 반환을 lock 획득으로 처리하는 것입니다. predicate를 다시 검사하고 CAS를 성공시킨 경우에만 소유권을 얻었다고 말합니다.

세 번째는 wake 수를 작업 수와 일치시켜야 한다고 믿는 것입니다. wake는 상태 변경 후 재검사 기회를 주는 알림이고, 작업이나 토큰을 보존하지 않습니다. 네 번째는 같은 process에서 테스트가 됐다는 이유로 shared mapping에서도 private를 유지하는 것입니다. 참여 프로세스 집합과 mapping lifetime을 설계 문서에 고정합니다.

검증 순서는 (1) waiter가 WAIT 직전인 지점, (2) unlock이 먼저 완료된 지점, (3) 두 waiter가 동시에 깨어난 지점, (4) timeout·signal 반환, (5) 객체 파괴 경쟁입니다. Linux futex syscall을 이 작성 환경에서 실행하지 않았으므로 표의 전이는 설명용 상태 추적입니다. 실제 시스템에서는 strace나 tracepoint를 사용할 때도 syscall 관측만으로 메모리 순서와 상위 mutex 정책을 확정하지 않습니다.

## 참고자료와 범위

- Linux man-pages, `futex(2)`, version `6.19`, 2026-02-14. uncontended 사용자 공간 경로, `FUTEX_WAIT`의 expected 비교, `FUTEX_WAKE`, `FUTEX_PRIVATE_FLAG`의 같은 프로세스 최적화를 확인했습니다.
- glibc futex 내부 구현 문서와 Linux kernel futex wait/wake source를 비교 대상으로 삼았지만, 이 배치에서 Linux 런타임을 실행하지 않았습니다. 따라서 `EAGAIN`, `EINTR`, timeout의 구체 errno 매핑은 사용하는 libc/kernel ABI의 source와 man-page를 함께 확인해야 합니다.
- 저장소의 `notes/concurrency/condition-variables.md`. predicate·notify·대기 등록 사이의 missed wakeup과 종료 수명 설명을 낮은 계층 futex 흐름과 대조했습니다.
- 저장소의 `notes/concurrency/atomic-publication.md`. atomic 상태와 일반 데이터 공개·객체 수명을 자동으로 동일시하지 않는 원칙을 연결했습니다.

raw futex 연산의 의미와 pthread mutex의 내부 구현은 구분해야 합니다. 우선순위 상속, robust owner death, 취소점, 특정 C 라이브러리의 word 레이아웃은 이 문서에서 확정하지 않으며 대상 libc와 커널 문서를 추가로 확인해야 합니다.

### 참고 경로

- [https://man7.org/linux/man-pages/man2/futex.2.html](https://man7.org/linux/man-pages/man2/futex.2.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.

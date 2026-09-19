---
id: priority-inversion-inheritance
title: 우선순위 역전과 우선순위 상속
topic: 동시성
summary: 낮은 우선순위 보유자가 중간 우선순위 작업에 선점되어 높은 우선순위 작업을 막는 상황과 PI 전파·해제를 설명합니다.
questionIds: []
prerequisites:
  - cpu-scheduling
  - deadlock
related:
  - condition-variables
  - async-execution
reviewedAt: '2026-09-19'
---
# 우선순위 역전과 우선순위 상속

높은 우선순위라는 속성은 작업이 **실행 가능한 상태**일 때의 선택 기준이지, 이미 다른 작업이 가진 mutex를 빼앗을 권리를 뜻하지 않습니다. 낮은 우선순위 작업 L이 mutex X를 보유한 직후 높은 작업 H가 X를 요청하면 H는 runnable 큐에서 빠져 blocked가 됩니다. 그때 X와 관계없는 중간 작업 M이 runnable이면, 기본 우선순위만 보는 스케줄러는 L보다 M을 선택합니다. H를 진행시키려면 H를 직접 실행하는 것이 아니라 L이 X를 해제할 CPU 시간을 확보해야 하므로, 이 경로가 priority inversion입니다.

## 상태 모델

분석할 때 작업의 base priority, 현재 effective priority, 실행 가능성, lock ownership을 분리합니다. H의 base가 10이어도 X를 기다리는 동안 CPU를 사용할 수 없고, L의 base가 1이어도 X의 owner라는 사실은 계속 남습니다. M의 base가 5이면 M은 H보다 낮지만 L보다 높으므로 H의 간접 blocker가 됩니다. 이 현상에는 대기 cycle이 없어도 됩니다. L이 언젠가 실행되어 unlock할 수 있으면 deadlock은 아니지만, M의 도착과 실행이 계속되면 H의 대기시간 상한이 사라집니다.

실제 조사에서는 “우선순위가 높은데 왜 안 돌았나”를 runnable 목록만으로 답하지 않습니다. H가 어느 mutex의 어느 owner를 기다렸는지, 그 기간에 L이 runnable이었는지, M이 CPU를 얼마나 소비했는지, lock 대기와 scheduler 대기를 나누어 기록합니다.

## 실행 추적

단일 CPU에서 L의 임계 구역이 2ms라고 하겠습니다. L이 t=0에 X를 얻고, t=1에 H가 X를 요청하면 H는 blocked가 됩니다. t=1 이후 M이 5ms씩 세 번 도착한다면 다음과 같은 설명용 trace가 가능합니다.

| 시각 | 실행 작업 | H 상태 | X owner |
| --- | --- | --- | --- |
| 0–1ms | L | runnable | L |
| 1ms | H가 X 요청 | blocked | L |
| 1–6ms | M | blocked | L |
| 6–11ms | M | blocked | L |
| 11–16ms | M | blocked | L |
| 16–17ms | L가 남은 임계 구역 수행 | blocked | L |
| 17ms 이후 | H | ready/running | 없음 또는 H |

L의 실제 CPU 작업량이 2ms여도 H는 M 때문에 16ms 이상을 기다릴 수 있습니다. M이 계속 유입되면 priority queue의 정렬만으로는 “언제 L이 실행되어 X를 풀지”를 보장하지 못합니다. 멀티코어에서는 완화될 수 있지만, L이 실행되는 CPU와 lock 보호 상태의 메모리·스케줄 정책을 별도로 분석해야 하므로 단순히 코어 수만큼 상한이 생긴다고 단정하지 않습니다.

```diagram
{"title":"Lock ownership가 만드는 역전","caption":"H는 가장 높은 priority지만 X를 가진 L이 실행되지 않으면 진행할 수 없습니다. PI는 대기 의존성을 L의 유효 priority에 반영합니다.","rows":[[{"id":"h","label":"H · waiter","detail":["X 대기","blocked"]},{"id":"m","label":"M · 중간","detail":["X 불필요","L 선점"]},{"id":"l","label":"L · owner","detail":["X 보유","실행 지연"]}],[{"id":"pi","label":"PI 적용","detail":["H priority 반영","L이 먼저 unlock"]}]],"edges":[{"from":"h","to":"l","label":"ownership 의존성"},{"from":"m","to":"l","label":"기본 priority 선점"},{"from":"l","to":"pi","label":"waiter priority 상속"},{"from":"pi","to":"h","label":"X 해제 후 진행"}]}
```

## Priority inheritance

Priority inheritance(PI)는 blocked waiter의 priority를 owner의 effective priority 계산에 포함하는 동적 프로토콜입니다. H가 X를 기다리면 L의 effective priority가 `max(base(L), highest live waiter on X)`로 계산되어 H 수준까지 올라갑니다. 그러면 M보다 L이 먼저 실행될 가능성이 커지고, L이 짧은 임계 구역을 끝낸 뒤 H가 X를 획득할 수 있습니다. 이것은 H의 작업을 L이 대신 실행한다는 뜻이 아니라, H의 진행을 막는 owner에게 스케줄링 우선권을 잠시 빌려주는 뜻입니다.

구현에서 구분해야 할 상태는 다음과 같습니다.

- `base_priority`: 외부 스케줄 정책이 작업에 부여한 원래 등급
- `effective_priority`: base와 현재 유효 donor를 합친 실행 등급
- `waiter`: 특정 mutex에서 owner를 기다리는 작업
- `pi_waiter`: owner의 유효 등급에 영향을 주는 ownership 관계

PI는 FIFO 공정성, 재귀 mutex, 비-PI mutex와의 혼용을 자동으로 정의하지 않습니다. Linux `rt_mutex` 설계 문서는 waiter와 owner의 관계를 priority-sorted 구조로 관리하고, owner가 다른 mutex를 기다리는 경우 전파가 ownership chain을 따라갈 수 있다고 설명합니다. 하지만 그 문서만으로 모든 RTOS의 chain depth, 동순위 tie-break, 일반 mutex 의미까지 보장해서는 안 됩니다.

## Ownership chain

한 단계만 donation하면 blocker가 남는 경우가 있습니다. H가 A를 기다리고 A의 owner L1은 B를 기다리며, B의 owner L2는 M에게 선점되고 있다고 하겠습니다. H가 진행하려면 L2가 B를 풀고, 그 뒤 L1이 A를 풀어야 합니다. 따라서 전파 방향은 `H → A owner L1 → B owner L2`가 됩니다.

예를 들어 `base(L1)=2`, `base(L2)=1`, `priority(H)=10`, `priority(M)=5`이면 다음 중간 상태를 추적할 수 있습니다.

1. H가 A를 기다리면 `effective(L1)=max(2,10)=10`입니다.
2. L1이 B를 기다리는 순간 L1의 유효 priority 10이 B owner L2의 계산에 들어갑니다.
3. `effective(L2)=max(1,10)=10`이므로 M보다 L2가 먼저 B를 끝낼 기회를 얻습니다.
4. L2가 B를 해제하면 L1이 A를 해제하고, 그때 H가 진행합니다.

이 관계는 priority propagation이지 deadlock 해결이 아닙니다. A owner가 B를 기다리고 B owner가 다시 A를 기다리면 cycle이 생기며, PI는 자원을 빼앗거나 cycle을 제거하지 않습니다. lock order, timeout, 별도의 deadlock 검출을 함께 설계해야 합니다.

## Boost 재계산

owner가 여러 mutex를 보유하면 donor를 하나의 숫자로 저장했다가 마지막에 지우는 방식이 위험합니다. L이 A와 B를 보유하고 A의 최고 live waiter가 9, B의 최고 live waiter가 6, base가 2라면 effective는 9입니다. A의 waiter가 timeout으로 실제 대기 집합에서 제거된 뒤에는 `max(2, 6)=6`이어야 합니다. B의 waiter도 사라졌을 때만 2로 돌아갑니다. A에 priority 9인 다른 waiter가 남아 있으면 취소 하나로 priority를 낮추지 않습니다.

개념적인 재계산은 다음과 같습니다.

```text
recompute(owner):
    p = owner.base_priority
    for mutex in owner.owned_mutexes:
        p = max(p, highest_live_waiter_priority(mutex))
    owner.effective_priority = p
```

실제 구현은 waiter timeout, signal 취소, unlock, lock 획득이 같은 시점에 경합하는 선형화 지점을 정해야 합니다. timeout 반환만 보고 donor를 먼저 지우면 아직 lock을 얻은 waiter를 놓칠 수 있고, 반대로 자료구조에서 제거된 waiter를 남기면 불필요한 높은 priority가 유지됩니다. Linux 설계의 자료구조 이름을 일반 mutex API의 portable 계약으로 확대하지 말고, 사용하는 구현의 취소·unlock 순서를 확인합니다.

## 프로토콜 선택

PI는 실제 blocked waiter에 맞춰 동작하므로 동적으로 변하는 작업 집합에 적합합니다. 대신 ownership graph, donor 갱신, chain 전파와 취소 비용이 필요합니다. priority ceiling 계열은 자원별 ceiling을 미리 정해 분석 가능성을 높입니다. POSIX `PTHREAD_PRIO_PROTECT`는 configured ceiling을 사용해 mutex를 보유한 thread의 실행 priority를 올리는 규칙이며, 일반적인 ceiling admission 거부까지 자동으로 의미하지는 않습니다. PCP나 SRP처럼 접근 거부 규칙을 포함하는 protocol을 말하려면 그 표준·RTOS의 정확한 규칙을 별도로 밝혀야 합니다.

선택 전에 임계 구역 최대 길이, lock 순서, 외부 I/O 여부, priority 등록의 완전성, timeout 의미를 고정합니다. PI를 켜도 holder가 디스크·RPC·페이지 폴트를 기다리면 H의 지연은 남습니다. 따라서 lock 안에서 외부 호출을 제거하고, 긴 작업을 lock 밖으로 옮기는 것이 프로토콜 선택보다 먼저입니다.

## 실패 검증

재현은 L이 X를 잡은 직후 H를 대기시키고 M이 반복해서 CPU를 소비하도록 구성합니다. PI 전후에 H의 mutex wait, L의 effective priority, M의 실행량, unlock 시각을 수집합니다. timeout 경로에서는 최고 donor 취소 전후의 남은 waiter 집합을 함께 기록해야 합니다. cycle이 없는데 M의 누적 실행량만큼 H가 지연되면 inversion이고, cycle이 발견되면 deadlock 분석으로 분기합니다.

이 글의 2ms·5ms trace는 설명용 계산이며 특정 커널의 실측 결과가 아닙니다. 실측 시 CPU affinity, scheduler 정책, interrupt, 코어 수, lock 구현을 고정하고 PI가 켜졌다는 로그 하나가 아니라 대기 그래프와 시간순서를 대조합니다.

## 비용과 한계

PI는 단순 mutex보다 waiter와 owner bookkeeping이 많고, chain이 길어질수록 priority 재계산 경로가 복잡해집니다. 잘못된 취소 처리는 boost가 영구히 남거나 너무 빨리 사라지게 할 수 있습니다. 반대로 ceiling은 자원 목록과 최고 priority를 빠짐없이 등록하지 않으면 분석 결과가 틀립니다. 어느 방식도 긴 임계 구역, 비선점 구간, 메모리 압박, 원격 지연을 없애지 않습니다.

## 참고 자료

- Linux Kernel Documentation, `RT-mutex implementation design`: https://docs.kernel.org/locking/rt-mutex-design.html — unbounded inversion, waiter-to-owner inheritance, ownership-chain propagation의 구현 설계를 확인했습니다. 문서 헤더와 본문 대상 버전은 서로 다르므로 최신 커널의 모든 세부 규칙으로 일반화하지 않습니다.
- The Open Group, `pthread_mutexattr_setprotocol`: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutexattr_setprotocol.html — `PTHREAD_PRIO_INHERIT`와 `PTHREAD_PRIO_PROTECT`의 구분을 확인하는 표준 근거입니다.
- 저장소의 CPU scheduling·deadlock 관련 장 — runnable 선택과 cycle 분석을 전제로 삼되, 이 글은 lock ownership에 따른 간접 blocking을 별도로 다룹니다.

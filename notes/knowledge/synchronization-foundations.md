---
id: synchronization-foundations
title: 동기화 기초와 도구 선택
topic: 동시성
summary: mutex·condition variable·semaphore·read/write lock의 상태 계약을 비교하고 공유 큐와 종료 흐름에서 올바른 선택을 설명합니다.
questionIds: []
prerequisites: [computer-science-foundations]
related: [semaphore, deadlock, cancellation, safe-reclamation]
reviewedAt: '2026-09-17'
---

# 동기화 기초와 도구 선택

## 공유 상태와 실행 순서

동시성 오류는 두 스레드가 같은 메모리를 만진다는 사실보다, 어떤 상태 변화가 어떤 순서로 관찰되어야 하는지가 빠진 데서 시작합니다. 먼저 공유 상태와 그 상태가 지켜야 할 불변식을 문장으로 적고, 그다음에 동기화 도구를 고릅니다.

예를 들어 큐의 불변식은 `size`가 실제 항목 수와 같고, 닫힌 큐에는 새 항목을 넣지 않으며, 꺼낸 항목은 한 소비자만 처리한다는 것입니다. mutex는 이 상태를 한 번에 한 실행 흐름만 검사·변경하게 만들 수 있고, condition variable은 상태가 바뀌기를 기다리는 흐름을 잠재웁니다.

반면 semaphore는 동시에 사용할 수 있는 허가 수를 세고, read/write lock은 읽기와 쓰기의 동시성을 나눕니다. 각각의 도구가 보호하는 것은 다르므로 하나를 다른 것의 이름으로 바꾸면 소유권과 종료 규칙이 사라집니다.

## Mutex와 보호 불변식

뮤텍스(mutex)는 한 시점에 하나의 실행 흐름만 임계 구역에 들어가도록 하는 상호 배제 도구입니다. POSIX 계약에서는 lock에 성공한 호출 스레드가 owner가 되고, unlock은 mutex object를 release합니다. 따라서 owner가 아닌 스레드의 unlock을 정상 해제로 가정해서는 안 됩니다.

실무에서는 mutex를 잡은 동안 상태를 검사하고 바꾸되, 외부 호출·긴 I/O·사용자 callback은 잠금 밖으로 옮깁니다. 잠금 안에서 callback을 호출하면 callback이 같은 객체로 재진입하거나 다른 잠금을 기다려 교착 상태를 만들 수 있습니다.

재귀 mutex, 오류 검출 mutex, robust mutex는 서로 다른 계약입니다. 재귀가 허용된다고 잠금 순서 문제가 해결되는 것은 아니고, robust 변형이 있다고 복구한 공유 상태가 자동으로 일관된 것도 아닙니다. 사용 중인 API의 owner·오류·복구 문장을 직접 확인합니다.

| 질문 | mutex가 답하는 것 | 별도 설계가 필요한 것 |
| --- | --- | --- |
| 누가 지금 상태를 바꾸는가 | 하나의 owner와 배타 구간 | owner 아닌 해제 처리 |
| 어떤 필드가 함께 바뀌는가 | 같은 잠금 아래의 불변식 | 잠금 밖 별칭과 callback |
| 언제 대기하는가 | lock 획득 시점 | 기한·취소·공정성 |
| 언제 파괴하는가 | 잠금 아래 마지막 상태 변경 | waiter·등록자·외부 호출 종료 |

## Condition Variable과 Predicate

조건 변수(condition variable)는 이벤트를 저장하는 우편함이 아닙니다. 잠든 실행 흐름에게 공유 상태를 다시 확인할 기회를 주는 도구입니다. 큐와 `stopping` 같은 predicate, 즉 “계속 기다려도 되는지 판정하는 상태식”은 mutex가 보호해야 합니다.

생산자가 항목을 넣고 알림을 보내기 전에 소비자가 검사와 대기 등록을 원자적으로 연결하지 않으면 알림을 놓칠 수 있습니다. `wait`는 mutex를 놓고 대기에 들어가는 과정을 연결하고, 깨어난 뒤 mutex를 다시 얻은 상태로 반환하는 계약을 사용합니다. 허위 깨움도 허용될 수 있으므로 `if`가 아니라 `while`로 predicate를 재검사합니다.

```diagram
{"title":"조건 변수의 재검사 흐름","caption":"알림은 상태가 참이라는 약속이 아니라 재검사 기회입니다. 소비자는 mutex를 다시 얻은 뒤 큐와 종료 상태를 확인합니다.","rows":[[{"id":"state","label":"공유 상태","detail":["queue","stopping"]}],[{"id":"check","label":"predicate 검사","detail":["큐가 비었고 종료 전인가"]}],[{"id":"wait","label":"mutex 해제와 대기"}],[{"id":"wake","label":"깨움 후 mutex 재획득"}]],"edges":[{"from":"state","to":"check","label":"mutex 아래 읽기"},{"from":"check","to":"wait","label":"계속 기다림"},{"from":"wait","to":"wake","label":"notify 또는 허위 깨움"},{"from":"wake","to":"check","label":"while 재검사"}]}
```

알림을 받은 A가 mutex를 다시 얻기 전에 B가 먼저 항목을 꺼낼 수 있습니다. 그러므로 A가 깨어났다는 사실은 큐가 비어 있지 않다는 사실과 다릅니다. `while queue.empty() && !stopping`의 조건을 다시 판정하고, 종료 상태에서 큐가 비었으면 `closed`를 반환합니다.

## Semaphore와 허가 수

세마포어(semaphore)는 공유 상태의 owner가 아니라 사용 가능한 허가의 수를 표현합니다. DB 연결을 동시에 10개만 쓰게 하려면 초기 허가 10개를 두고, 작업이 실제로 종료될 때 하나를 돌려놓습니다. 허가를 얻은 작업들이 같은 목록을 안전하게 수정한다는 뜻은 아니므로 목록에는 별도 mutex가 필요할 수 있습니다.

허가의 생명은 대기, 획득 성공, 실제 작업, 반환으로 나눕니다. 획득 전에 취소되면 반환할 허가가 없고, 획득 직후 취소되면 성공 결과를 받은 주체가 정확히 한 번 반환해야 합니다. 사용자 응답이 먼저 끝나더라도 실제 I/O가 남아 있으면 제한 대상인 작업이나 그 작업의 책임자가 허가를 계속 보유합니다.

POSIX의 `sem_wait` 페이지에서 signal에 의한 중단은 확인할 수 있지만, 그 사실을 곧바로 thread cancellation 계약으로 확대하지 않습니다. `sem_post`는 값 증가나 대기 중인 하나의 `sem_wait` 완료를 설명하며 최대값 초과는 `EOVERFLOW`로 실패할 수 있으므로, 오류 시 허가 소유자가 누구인지 API별로 정합니다.

| 상태 | 허가 수의 의미 | 반환 책임 |
| --- | --- | --- |
| 대기 중 | 아직 사용 가능 수를 줄이지 않음 | 없음 |
| 획득 성공 | 작업 하나가 예산을 점유 | 성공 결과 수신자 |
| timeout 응답 | 실제 작업이 남았을 수 있음 | 작업 소유자 유지 |
| 실제 종료 | 더는 제한 자원을 쓰지 않음 | 공통 종결 경로에서 한 번 |

## read/write lock과 공정성

read/write lock은 여러 reader의 동시 진입을 허용하면서 writer와의 동시 진입을 막는 도구입니다. writer가 보유한 동안 reader가 획득할 수 없고, reader 또는 writer가 보유한 동안 writer는 대기합니다. 읽기 작업이 실제로 겹칠 수 있고 쓰기 구간이 짧다는 측정 결과가 있을 때만 선택할 이유가 생깁니다.

공식 POSIX 페이지는 구현의 queue discipline이 FIFO인지, 기다리는 writer를 reader보다 우선하는지, starvation freedom을 보장하는지 일반적으로 약속하지 않습니다. 따라서 “reader가 많으니 writer가 언젠가는 된다”거나 “writer가 기다리면 새 reader가 막힌다”는 가정을 API 문장 없이 넣지 않습니다.

read lock을 재귀적으로 얻을 수 있는지, read에서 write로 승격할 수 있는지, try-lock이 즉시 실패할 때의 결과가 무엇인지도 별도 질문입니다. 승격을 지원하지 않는 환경에서 read lock을 쥔 채 write lock을 기다리면 자신이 writer를 막는 대기 고리가 생길 수 있습니다.

## 용량 제한 큐의 작동 순서

이제 큐, 종료 상태, DB 허가를 한 서비스 안에 둡니다. 큐의 `items`와 `stopping`은 mutex로 보호하고, 소비자는 condition variable로 기다립니다. DB 호출의 동시 개수는 semaphore가 제한하며, 작업 결과를 사용자에게 전달하는 callback은 잠금 밖에서 실행합니다.

```text
의사코드입니다. 실제 언어 API의 오류 처리와 소유권 계약을 구현에 맞게 채워야 합니다.
push(job):
    lock(queue_mutex)
    if stopping or queue.size >= capacity:
        unlock(queue_mutex)
        return rejected
    queue.push(job)
    notify_one(queue_condition)
    unlock(queue_mutex)
    return accepted

take(deadline):
    lock(queue_mutex)
    while queue.empty() and not stopping:
        wait_until(queue_condition, queue_mutex, deadline)
        if deadline_passed():
            unlock(queue_mutex)
            return timed_out
    if queue.empty():
        unlock(queue_mutex)
        return closed
    job = queue.pop()
    unlock(queue_mutex)
    return job
```

생산자가 작업 X를 삽입하고 A를 깨운 뒤, A가 mutex를 얻기 전에 B가 X를 꺼내는 순서를 적어 봅니다. A는 다시 빈 큐를 보고 잠들어야 합니다. 생산자가 먼저 삽입을 끝낸 뒤 소비자가 도착하는 순서에서는 소비자가 predicate를 보고 바로 진행해야 하며, 과거 알림을 기다릴 필요가 없습니다.

종료는 `stopping=true`를 mutex 아래 기록하고 모든 소비자를 깨우는 동작입니다. 이것만으로 consumer가 끝났거나 condition variable을 파괴해도 된다는 뜻은 아닙니다. drain 정책이면 큐가 빌 때까지 처리하고, discard 정책이면 남은 작업을 별도 목록으로 분리해 취소·재전달 책임을 수행한 뒤 종료합니다.

## 도구 선택의 판단 기준

공유 자료구조의 복합 불변식을 보호할 때는 mutex가 기본입니다. “어떤 상태가 될 때까지 기다린다”가 필요하면 predicate와 condition variable을 붙입니다. 동시에 사용할 수 있는 수량을 제한할 때는 semaphore를 쓰고, 측정된 읽기 병렬성이 이득을 보일 때만 read/write lock을 고려합니다.

도구를 고른 뒤에는 대기 그래프를 그립니다. 역순으로 두 mutex를 잡는 고리, 부모 작업이 자식 작업을 기다리면서 executor를 점유하는 고갈, callback이 잠금 밖에서 다시 큐에 들어오는 재진입을 별도로 표시합니다. lock-free를 택해도 allocator·회수·로그·callback이 막히면 전체 함수는 blocking일 수 있습니다.

운영 지표는 알림 수가 아니라 결과 불변식이어야 합니다. 수락한 작업이 정책에 따라 한 번 처리·취소되는지, active permit이 상한을 넘지 않는지, 큐 바이트와 waiter 수가 상한 안에 있는지, 가장 오래 기다린 reader와 writer가 얼마인지 기록합니다.

## 검증 순서와 경계

검증에서는 소비자 두 명을 두고 하나의 항목을 A가 깨었지만 B가 먼저 가져가는 순서를 고정합니다. 생산자 선행, 허위 깨움, 종료 직전 빈 큐, 종료 직전 남은 큐를 나누어 검사합니다. semaphore는 획득 전 취소와 획득 직후 취소, 중복 반환을 따로 주입합니다.

read/write lock은 reader가 계속 들어오는 부하와 writer가 기다리는 부하를 분리하고, 최장 writer 대기와 처리량을 함께 봅니다. 특정 구현에서 공정해 보였다는 관찰을 표준 보장으로 기록하지 않습니다. owner 아닌 unlock, 역순 다중 lock, callback 재진입도 실패 시나리오로 남깁니다.

조건 변수·mutex·semaphore 객체는 새 호출과 waiter 등록이 끝난 뒤에만 파괴합니다. 알림은 기다리는 사람에게 재검사 기회를 줄 뿐이고, 종료의 완료 증명이 아닙니다. 이 수명 경계를 확인하지 못한 채 timeout 후 즉시 메모리를 해제하면 동기화 도구 자체를 use-after-free로 만들 수 있습니다.

## 참고 자료와 검증 범위

- POSIX `pthread_mutex_lock`, <https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html>, IEEE Std 1003.1-2024 / POSIX.1-2024 Issue 8, 2026-09-17 확인. owner와 unlock 계약을 사용했습니다. 제공된 확인 범위만으로 상세한 unlock→next lock memory-order 문장을 확정하지 않았습니다.
- POSIX `pthread_cond_wait`, <https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_wait.html>, IEEE Std 1003.1-2024 / POSIX.1-2024 Issue 8, 2026-09-17 확인. mutex 해제와 대기 진입, 재획득, predicate 재검사, waiter 수명 제약을 사용했습니다.
- POSIX `pthread_cond_signal`, <https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_signal.html>, IEEE Std 1003.1-2024 / POSIX.1-2024 Issue 8, 2026-09-17 확인. signal·broadcast의 waiter set 처리와 대기자가 없을 때 알림이 저장되지 않는다는 계약을 사용했습니다.
- POSIX `sem_wait`·`sem_post`, <https://pubs.opengroup.org/onlinepubs/9799919799/functions/sem_wait.html>, <https://pubs.opengroup.org/onlinepubs/9799919799/functions/sem_post.html>, IEEE Std 1003.1-2024 / POSIX.1-2024 Issue 8, 2026-09-17 확인. signal 중단, 허가 증가·대기자 깨움·`EOVERFLOW`를 사용했으며 cancellation-point 전체 계약은 확정하지 않았습니다.
- POSIX `pthread_rwlock_rdlock`·`pthread_rwlock_wrlock`, <https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_rwlock_rdlock.html>, <https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_rwlock_wrlock.html>, IEEE Std 1003.1-2024 / POSIX.1-2024 Issue 8, 2026-09-17 확인. reader/writer 배제와 일반적인 FIFO·starvation freedom 부재를 사용했습니다.
- C++ Working Draft `thread.condition.condvar`·`thread.sema`, <https://eel.is/c++draft/thread.condition.condvar>, <https://eel.is/c++draft/thread.sema>, 2026-09-17 확인. fetch가 식별한 snapshot은 `c7015b485cc3db8efaa9dfb9ff0809c5394a4ed1`이며 발행 판본·최신성은 확인하지 않았습니다.
- 이 장은 교육용 의사코드와 상태 시퀀스로 작성했으며 서비스 구현이나 동시성 부하 시험은 실행하지 않았습니다. 도구별 공정성·취소·메모리 순서는 대상 플랫폼의 문서와 실제 구현을 추가 확인해야 합니다.

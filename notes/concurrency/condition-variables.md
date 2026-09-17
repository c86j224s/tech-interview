---
id: condition-variables
title: 조건 변수와 공유 큐
topic: 동시성
summary: 알림을 받고도 큐가 비는 실행 순서에서 출발해 조건식·잠금·대기 진입·종료 수명을 하나의 규칙으로 연결합니다.
questionIds: [condition-variable-predicate, condition-notify-lock-lifetime, queue-shutdown-drain-discard, monitor-synchronization, hoare-mesa-monitor-signal, java-wait-notify-monitor-owner]
---

# 조건 변수와 공유 큐

## 깨웠다는 말은 작업을 맡겼다는 말이 아닙니다

작업이 없는 소비자 A는 잠들고, 생산자는 작업 하나를 넣은 뒤 A를 깨웁니다. 그런데 A가 실행되기 전에 소비자 B가 그 작업을 가져갈 수 있습니다. A는 분명 알림을 받았지만 꺼낼 작업은 없습니다. 알림을 받았다는 사실과 현재 큐에 작업이 있다는 사실은 다릅니다.

**조건 변수**(condition variable)는 공유 상태가 바뀌었을 때 잠든 실행 흐름에 다시 확인할 기회를 주는 도구입니다. 작업을 저장하는 곳은 큐이고, 큐를 안전하게 읽고 바꾸는 도구는 뮤텍스입니다. 조건 변수 자체가 작업이나 과거 알림을 보관하지는 않습니다.

## 큐의 진실은 같은 잠금 아래에서 읽습니다

아래 그림의 세 요소를 하나의 객체가 관리하면 누가 어떤 규칙을 지켜야 하는지 분명해집니다. 이런 식으로 공유 상태·상호 배제·조건 대기를 묶는 구조를 모니터라고 설명합니다.

```diagram
{"kind":"class","title":"공유 큐의 세 가지 책임","caption":"화살표는 객체가 소유하는 구성요소입니다. 모든 생산자와 소비자는 같은 mutex를 통해 queue와 stopping을 검사·변경합니다.","rows":[[{"id":"monitor","label":"BlockingQueue","detail":["push(job)","takeUntil(deadline)","closeAndDrain()"]}],[{"id":"state","label":"공유 상태","detail":["queue: 대기 작업","stopping: 새 입력 차단"]},{"id":"sync","label":"동기화 도구","detail":["mutex: 상태 보호","condition: 재검사 알림"]}]],"edges":[{"from":"monitor","to":"state","label":"소유"},{"from":"monitor","to":"sync","label":"소유"}]}
```

기다려도 되는지를 판단하는 식은 `queue.empty() and not stopping`입니다. 이 식을 검사한 뒤 직접 잠금을 풀고 나중에 잠들면, 그 틈에 생산자가 삽입과 알림을 모두 끝낼 수 있습니다. 소비자는 작업이 있는데도 더 이상 오지 않을 알림을 기다립니다. **조건 검사와 대기 등록 사이의 알림 유실**을 막으려면, 잠금 해제와 대기 진입을 연결하는 조건 변수의 `wait` 계약을 사용해야 합니다.

## 네 단계의 경쟁을 따라갑니다

| 순서 | A | 생산자 또는 B | 큐 |
| --- | --- | --- | --- |
| 1 | 잠금 획득, 빈 큐 확인, wait | | 비어 있음 |
| 2 | 잠든 상태 | 생산자가 작업 X 삽입 후 notify | X |
| 3 | 깨었지만 잠금 획득 대기 | B가 먼저 잠금을 얻어 X 제거 | 비어 있음 |
| 4 | 잠금을 다시 얻고 wait 반환 | | 비어 있음 |

A가 `if empty: wait` 다음 곧바로 `pop`하면 네 번째 단계에서 잘못됩니다. `while empty: wait`라면 조건을 다시 검사해 기다립니다. 이 경쟁은 허위 깨움이 한 번도 없어도 생깁니다. 실제 알림 없이 대기 함수가 반환하는 **허위 깨움**(spurious wakeup)도 반복 검사로 함께 처리합니다.

일반적인 Mesa식 의미에서는 알림을 받은 스레드가 나중에 잠금을 두고 경쟁합니다. Hoare식 모니터처럼 신호 순간 실행권을 넘기는 의미와 혼동하면 안 됩니다. 사용하는 언어 API가 어떤 계약을 제공하는지 확인하되, C++·Java 등 흔한 조건 대기에서는 깨어난 뒤 상태를 다시 검사하는 구조를 사용합니다.

## 종료와 기한까지 포함한 슈도코드

다음은 **종료 후 새 삽입은 거절하고, 이미 큐에 있는 작업은 모두 처리하는** 정책입니다. `wait_until`은 잠금을 놓고 대기에 들어간 뒤 반환 전에 다시 획득합니다. 시간은 벽시계가 아니라 단조 시계의 절대 기한을 사용합니다.

```text
push(job):
    lock(mutex)
    if stopping:
        unlock(mutex)
        return rejected
    queue.push_back(job)
    condition.notify_one()
    unlock(mutex)
    return accepted

takeUntil(deadline):
    lock(mutex)
    while queue.empty() and not stopping:
        if monotonicNow() >= deadline:
            unlock(mutex)
            return timed_out
        condition.wait_until(mutex, deadline)
    if queue.empty():                    # stopping이며 더 처리할 작업 없음
        unlock(mutex)
        return closed
    job = queue.pop_front()
    unlock(mutex)
    return job                           # 긴 실행은 잠금 밖에서

closeAndDrain():
    lock(mutex)
    stopping = true
    condition.notify_all()
    unlock(mutex)
```

`closeAndDrain`은 이 호출 안에서 큐를 직접 비우는 함수가 아니라 `stopping=true`를 표시하고 소비자를 깨우는 종료 신호입니다. 소비자는 깨어난 뒤 큐가 비었는지 다시 보고, 작업이 남아 있으면 먼저 꺼내 처리하다가 `stopping`과 빈 큐가 함께 될 때 `closed`를 반환합니다. 기한과 작업 도착을 동시에 관찰했을 때 이미 큐에 있는 작업을 반환하는 정책이며, 절대 기한 이후에는 시작하면 안 되는 API라면 `pop` 직전에도 기한을 검사해야 합니다. 매번 깰 때마다 새로 5초를 주면 전체 대기가 무한히 늘 수 있으므로 처음 정한 기한을 유지합니다.

예외를 허용하는 실제 언어에서는 잠금 해제를 RAII·`finally` 등으로 보장하고, 삽입 실패 뒤 성공 알림을 보내지 않습니다. 이 노트는 대기 정확성에 집중하며 큐 용량 제한은 별도입니다. 무한 큐 대신 상한이 필요하면 생산자 측에도 공간 조건과 거절 정책을 추가해야 합니다.

### Java 객체 monitor의 대기

Java의 `obj.wait()`·`obj.notify()`·`obj.notifyAll()`은 해당 obj의 monitor를 소유한 상태에서 호출해야 합니다. `synchronized(other)` 안에 있다는 이유로 obj의 소유 조건을 만족하지 않습니다. wait는 obj monitor를 놓고 대기한 뒤 다시 획득해 반환하지만, 같은 스레드가 가진 다른 객체의 잠금까지 모두 놓지는 않습니다. 다른 잠금을 가진 채 기다리면 생산자가 그 잠금을 필요로 하는 대기 고리가 생길 수 있습니다.

조건은 같은 monitor 아래 while로 재검사하고 interrupt·timeout·종료를 명시적으로 처리합니다. notify가 어느 대기자를 선택할지에 특정 작업 배정을 의존하지 않습니다. 모니터가 내부 상태를 보호해도 그 컬렉션의 가변 참조를 외부로 반환하면 잠금 밖 수정이 가능하므로 snapshot이나 제어된 연산 API로 접근을 제한해야 합니다.

## notify 위치와 객체 수명을 함께 봅니다

위 코드는 잠금 안에서 알립니다. 생산자가 잠금을 풀기 전 깨운 소비자가 같은 잠금을 기다릴 수 있지만, 코드의 수명 관계는 읽기 쉽습니다. 잠금 밖으로 notify를 옮길 수도 있습니다. 그때도 상태 변경은 같은 잠금으로 보호하고, 알림 호출이 끝날 때까지 조건 변수 객체가 살아 있어야 합니다.

`stopping=true` 뒤 마지막 소비자가 끝났다는 이유만으로 조건 변수를 파괴하면, 잠금을 막 놓고 notify하려는 생산자가 죽은 객체에 접근할 수 있습니다. 새 호출을 차단한 뒤 생산자·소비자·알림 수행자가 모두 끝났음을 확인하고 파괴해야 합니다. `notify_all`은 종료를 요청하는 동작이지 모든 스레드가 종료됐다는 확인이 아닙니다.

## 처리하고 끝내기와 버리고 끝내기는 다릅니다

| 정책 | 종료 뒤 대기 작업 | 대기자의 종료 조건 | 별도 책임 |
| --- | --- | --- | --- |
| Drain | 순서대로 꺼내 처리 | stopping이며 큐가 비었음 | 실행 중 작업 완료 확인 |
| Discard | 취소·재전달 대상으로 분리 | stopping이면 종료 | 버린 요청에 결과 통지, 원본에서 재처리 |

Discard로 바꾼다면 남은 항목을 잠금 아래에서 별도 목록으로 떼어낸 뒤, 사용자 콜백은 잠금 밖에서 실행합니다. 콜백이 큐로 재진입할 수 있기 때문입니다. 메시지 소비라면 큐를 비웠다고 ACK나 offset을 먼저 확정해서는 안 됩니다.

## 순서를 통제해 확인합니다

작업 한 개와 소비자 두 개를 두고, A가 깨었지만 잠금을 얻기 전에 B가 작업을 가져가도록 테스트 장벽을 놓습니다. A는 빈 큐에서 꺼내지 않고 다시 기다려야 합니다. 생산자가 먼저 삽입·알림을 끝낸 경우에는 나중 소비자가 상태를 보고 곧바로 진행해야 합니다.

반복 허위 깨움, 종료 시 빈 큐, 종료 시 남은 큐, 마지막 notify와 파괴의 경쟁을 따로 검사합니다. 기대 결과는 “알림 수와 처리 수가 같다”가 아니라, **수락한 각 작업이 정책에 맞게 한 번 처리·취소되고 아무도 영원히 잠들지 않는 것**입니다.

---
id: java-synchronized-volatile
title: "공유 카운터에 volatile을 붙였는데도 최종 값이 작습니다. synchronized와 volatile은 가시성과 복합 연산을 어떻게 다르게 보장하나요?"
answerMinutes: 5
followups: [{"id":"java-threadlocal-pool","prompt":"ThreadLocal로 상태를 분리해도 같은 요청의 여러 스레드가 공유하면 어떤 동기화가 남나요?"},{"id":"atomics-memory-order","prompt":"volatile 준비 플래그와 C++ release/acquire 공개 패턴은 복합 상태에서 어떤 공통 한계를 가지나요?"},{"id":"immutable-data-sharing","prompt":"쓰기 대신 불변 스냅샷을 교체해 락을 줄일 때 새 참조 공개는 어떻게 안전하게 할까요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["Java","synchronized","volatile","가시성","원자성"]
related: ["java-threadlocal-pool"]
---

# 공유 카운터에 volatile을 붙였는데도 최종 값이 작습니다. synchronized와 volatile은 가시성과 복합 연산을 어떻게 다르게 보장하나요?

## 구두 답변

`volatile`은 해당 필드의 읽기와 쓰기 사이의 가시성과 순서를 보장하지만, 여러 단계로 이루어진 복합 연산을 하나로 묶지 않습니다. `count++`는 현재 값을 읽고 1을 더한 뒤 다시 쓰는 세 단계이므로 두 스레드가 같은 값을 읽으면 한 번의 증가가 덮어써질 수 있습니다. 반면 `synchronized`는 같은 모니터를 기준으로 한 번에 한 스레드만 임계 구역에 들어가게 하며, 모니터 unlock 뒤 같은 모니터를 lock한 스레드가 앞선 쓰기를 볼 수 있게 합니다.

### 보이는 것과 함께 바꾸는 것

아래는 설명용 코드 조각입니다. 타입·메서드 선언과 실행문을 나누어 배치하고, 실행문은 `main` 등 메서드 안에서 실행합니다. 예제 실행 메서드는 대기 중 발생할 수 있는 예외를 처리하거나 `throws Exception`으로 선언해야 합니다.

```java
final class Counter {
    private int value;
    synchronized void increment() { value++; }
    synchronized int get() { return value; }
}

Counter counter = new Counter();
Thread t1 = new Thread(() -> { for (int i = 0; i < 100_000; i++) counter.increment(); });
Thread t2 = new Thread(() -> { for (int i = 0; i < 100_000; i++) counter.increment(); });
t1.start(); t2.start();
t1.join(); t2.join();
System.out.println(counter.get()); // 200000
```

여기서 정확한 결과가 나오는 이유는 증가와 읽기를 같은 모니터로 보호했기 때문입니다. `volatile int value`만 붙이고 `value++`를 그대로 두면 읽기와 쓰기 사이에 다른 스레드가 끼어들 수 있어 최종 값이 200000보다 작아질 수 있습니다. `volatile`은 한 스레드가 `ready = true`로 게시한 뒤 다른 스레드가 그 값을 읽었을 때, 게시 전에 수행한 일반 필드 쓰기도 관찰하게 하는 데 유용합니다. 그러나 상호 배제나 복합 상태의 원자적 갱신을 제공하지 않습니다.

### 모니터·원자 연산·불변식

따라서 단순한 중단 플래그처럼 한 번 쓰고 읽는 상태에는 volatile을 고려하고, 증가·검사 후 변경·여러 필드의 불변식처럼 원자성이 필요한 경우에는 synchronized, `AtomicInteger`의 원자 연산, 또는 더 높은 수준의 동시성 자료구조를 선택하겠습니다. 어떤 락을 쓰는지와 실제 공유 상태의 불변식을 함께 봐야 하며, 서로 다른 객체를 잠그면 synchronized의 가시성 관계도 연결되지 않습니다.

### 선택 기준과 검증

`volatile` 플래그로 종료를 알릴 수 있어도 플래그를 읽은 뒤 공유 자원을 사용하는 구간의 수명과 복합 불변식은 별도 문제입니다. `AtomicInteger`의 compare-and-set은 단일 상태 전환에 적합하지만 잔액과 상태를 함께 바꾸지는 않습니다. 같은 모니터를 쓰는 범위를 코드로 고정하고, 안전성 테스트와 경합 성능 측정을 분리하겠습니다.

AtomicInteger의 get과 set을 따로 호출해 증가시키는 것은 incrementAndGet 같은 원자적 복합 연산과 다릅니다. 원자 변수라도 읽기와 쓰기 사이에서 다른 요청이 값을 바꿀 수 있으므로 API 단위가 보호할 연산과 일치해야 합니다. CAS를 반복할 때 갱신 함수가 재실행될 수 있다면 외부 API 호출 같은 부수 효과를 그 안에 넣지 않아야 합니다.

synchronized 인스턴스 메서드는 해당 객체를, static synchronized 메서드는 클래스 객체를 잠급니다. 서로 다른 인스턴스에 같은 코드가 있어도 같은 모니터가 아니므로 보호하는 데이터가 static 공유 상태라면 잠금 범위가 맞는지 봐야 합니다. 락은 재진입을 지원하지만 다른 락을 역순으로 획득하는 교착은 여전히 가능합니다. 정확한 카운터가 필요한지 고경합 통계 집계가 필요한지에 따라 AtomicInteger·LongAdder·락을 비교하고, 집계 읽기의 일관성 차이도 확인하겠습니다.

## 득점 포인트

- volatile의 가시성과 복합 연산 원자성을 구분한다.
- 같은 모니터의 happens-before와 불변식을 연결한다.
- Atomic·락·불변 스냅샷의 선택 조건을 비교한다.

## 감점 포인트

- volatile만으로 count++가 원자적이라고 말한다.
- 서로 다른 모니터를 잡고도 같은 happens-before가 생긴다고 가정한다.
- AtomicInteger 하나로 여러 필드 불변식까지 자동 보호된다고 설명한다.

## 더 파고들 거리

- AtomicInteger와 synchronized는 복합 불변식에서 어떤 표현력 차이가 있나요?
- volatile 게시에서 일반 필드가 보이는 happens-before 경로를 어떻게 증명할까요?
- 락을 줄이고 일관된 읽기를 유지할 때 어떤 불변 자료구조를 검토할까요?

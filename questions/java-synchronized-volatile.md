---
id: java-synchronized-volatile
title: "공유 카운터에 volatile을 붙였는데도 최종 값이 작습니다. synchronized와 volatile은 가시성과 복합 연산을 어떻게 다르게 보장하나요?"
difficulty: 중하
category: 언어·런타임
tags: ["Java","synchronized","volatile","가시성","원자성"]
related: ["java-threadlocal-pool"]
---

# 공유 카운터에 volatile을 붙였는데도 최종 값이 작습니다. synchronized와 volatile은 가시성과 복합 연산을 어떻게 다르게 보장하나요?

## 구두 답변

`volatile`은 해당 필드의 읽기와 쓰기 사이의 가시성과 순서를 보장하지만, 여러 단계로 이루어진 복합 연산을 하나로 묶지 않습니다. `count++`는 현재 값을 읽고 1을 더한 뒤 다시 쓰는 세 단계이므로 두 스레드가 같은 값을 읽으면 한 번의 증가가 덮어써질 수 있습니다. 반면 `synchronized`는 같은 모니터를 기준으로 한 번에 한 스레드만 임계 구역에 들어가게 하며, 모니터 unlock 뒤 같은 모니터를 lock한 스레드가 앞선 쓰기를 볼 수 있게 합니다.

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

따라서 단순한 중단 플래그처럼 한 번 쓰고 읽는 상태에는 volatile을 고려하고, 증가·검사 후 변경·여러 필드의 불변식처럼 원자성이 필요한 경우에는 synchronized, `AtomicInteger`의 원자 연산, 또는 더 높은 수준의 동시성 자료구조를 선택하겠습니다. 어떤 락을 쓰는지와 실제 공유 상태의 불변식을 함께 봐야 하며, 서로 다른 객체를 잠그면 synchronized의 가시성 관계도 연결되지 않습니다.

## 득점 포인트

- volatile의 가시성·순서 보장과 synchronized의 상호 배제를 분리해 설명한다.
- count++가 읽기-수정-쓰기 복합 연산이라 volatile만으로 안전하지 않음을 제시한다.
- 단순 플래그와 원자적 증가·불변식 보호에 따른 선택 기준을 완결한다.

## 감점 포인트

- volatile을 붙이면 모든 복합 연산이 원자적으로 실행된다고 말한다.
- synchronized가 어떤 모니터를 사용하든 모든 공유 변수의 가시성을 보장한다고 가정한다.
- 경합으로 잃은 증가를 CPU 캐시만의 문제로 설명하고 연산 분할을 놓친다.

## 더 파고들 거리

- AtomicInteger와 synchronized의 원자성·경합 비용·복합 불변식 지원을 비교해 보세요.
- volatile 게시 패턴에서 일반 필드가 읽히는 happens-before 경로를 설명해 보세요.
- 락을 줄이면서도 읽기 일관성을 유지해야 할 때 어떤 자료구조와 설계를 검토하나요?

---
id: java-shared-state
title: Java Volatile 공개와 복합 연산의 원자 경계
topic: 언어·런타임
summary: count++의 유실·volatile happens-before·동일 monitor·복수 atomic·ConcurrentHashMap의 check-then-act와 가변 value를 설명합니다.
questionIds: [java-synchronized-volatile, java-volatile-happens-before, atomic-integer-multi-field-invariant, java-concurrenthashmap-compound]
---

# Java Volatile 공개와 복합 연산의 원자 경계

Java 동시성에서 가시성, 원자성, 일관성은 서로 다른 계약입니다. 이 노트는 한 필드의 공개부터 여러 필드와 map 내부 객체의 복합 변경까지 상태가 어떻게 관찰되는지 추적하여, volatile이나 concurrent라는 표지만으로 해결되지 않는 경쟁을 구분합니다.

## volatile 가시성과 count++ 경쟁

volatile count가 0일 때 A와 B가 각각 0을 읽고 1을 계산해 저장하면 마지막 값은 1입니다. 읽기와 쓰기 각각의 가시성을 확보해도 두 단계 사이의 경쟁은 남습니다. `count++`는 읽기·계산·쓰기를 하나로 묶는 별도 원자 연산이 아닙니다.

| 순서 | A | B | count |
| --- | --- | --- | --- |
| 1 | 0 읽기 | | 0 |
| 2 | | 0 읽기 | 0 |
| 3 | 1 쓰기 | | 1 |
| 4 | | 1 쓰기 | 1 |

AtomicInteger라도 `get()`으로 읽은 뒤 `set()`하는 두 호출을 따로 두면 `count++`와 같은 경쟁이 남습니다. 값을 읽고 새 값을 계산해 쓰는 read-modify-write 전체를 `incrementAndGet()` 같은 원자 연산으로 수행하거나, 같은 monitor 안에서 읽기·증가·쓰기를 묶어야 합니다. `LongAdder`는 경합이 큰 통계 집계에서 유리할 수 있지만, 여러 작업이 진행되는 동안 읽은 합계가 즉시 일관되어야 하는지에 따라 적합성이 달라집니다.

## Volatile 쓰기·읽기와 happens-before 순서

```java
int data;
volatile boolean ready;
// 생산자: data = 42; ready = true;
// 소비자: if (ready) use(data);
```

한 번 게시하고 `data`를 다시 바꾸지 않는 전제에서 생산자는 먼저 `data = 42`를 쓰고 같은 스레드에서 `ready = true`를 씁니다. 소비자가 그 `ready`의 volatile 쓰기를 관찰한 뒤 `data`를 읽으면, 그 ready 경계보다 앞선 data 쓰기를 볼 수 있다는 순서가 생깁니다.

그러나 다른 flag를 읽거나 `ready == false`인 상태에서 data를 사용하면 이 연결을 얻지 못합니다. ready를 다시 false/true로 재사용하면서 data도 계속 바꾼다면, 이전 소비자와 다음 생산자의 경쟁을 별도로 설계해야 합니다.

```diagram
{"title":"같은 Volatile 필드의 게시 경로를 따릅니다","caption":"화살표는 순서와 동기화 관계입니다. 한 번 게시 뒤 data를 바꾸지 않는 모형이며 volatile 변수가 있다는 사실만으로 모든 필드 읽기가 보호되는 것은 아닙니다.","rows":[[{"id":"data","label":"생산자 data=42"}],[{"id":"publish","label":"ready=true volatile 쓰기"}],[{"id":"observe","label":"소비자 ready 게시 읽기"}],[{"id":"use","label":"소비자 data 사용"}]],"edges":[{"from":"data","to":"publish","label":"프로그램 순서"},{"from":"publish","to":"observe","label":"동기화"},{"from":"observe","to":"use","label":"프로그램 순서"}]}
```

`synchronized` 블록이나 메서드는 같은 monitor, 즉 같은 잠금 대상을 잡은 스레드가 겹치지 않게 실행되도록 하고, 한 스레드가 그 monitor를 unlock한 뒤 다른 스레드가 같은 monitor를 lock하면 happens-before 관계가 생깁니다. 인스턴스 메서드의 `synchronized`는 그 인스턴스를, `static synchronized`는 해당 클래스 객체를 monitor로 사용합니다.

따라서 static 데이터를 보호하면서 서로 다른 인스턴스를 잠그면 두 스레드가 같은 monitor를 잡지 않아 하나의 보호 경계가 되지 않습니다.

## 복수 Atomic 값과 일관된 합계 snapshot
자료구조 선택은 한 값의 증가인지 여러 필드의 불변식인지부터 나눕니다. 단일 카운터에는 원자 증가가 맞을 수 있지만, 잔액 두 개의 합계와 일관된 snapshot이 필요하면 같은 monitor 또는 한 객체를 CAS로 교체해야 하며, 외부 side effect는 성공 상태 이후의 별도 전달 계약으로 분리합니다.

A잔액 감소와 B잔액 증가를 각각 atomic으로 수행해도 독자가 그 사이를 읽으면 합계가 달라질 수 있습니다. 같은 잠금으로 두 변경과 필요한 읽기를 묶거나, 두 값을 가진 불변 상태 하나를 AtomicReference CAS로 교체하는 방식이 필요합니다. 독자도 같은 묶음 루트를 한 번 읽어야 합니다.

CAS 갱신 함수는 충돌로 재실행될 수 있으므로 외부 결제·알림 같은 부수 효과를 넣지 않습니다. 성공한 상태 변경 이후의 외부 효과는 별도 멱등·outbox 등의 계약으로 연결합니다. atomic이라는 이름이 DB 거래나 외부 효과의 원자성을 제공하지 않습니다.

## ConcurrentHashMap 연산 원자성과 외부 부수 효과

두 스레드가 `get`으로 같은 키의 부재를 본 뒤 각각 객체를 만들고 `put`하면, map 자료구조는 깨지지 않아도 생성 작업은 두 번 실행됩니다. `putIfAbsent`는 이미 만들어진 값 중 저장할 승자를 원자적으로 정하지만, 메서드 인자로 넘길 객체를 만드는 부수 효과까지 취소하지는 않습니다.

`computeIfAbsent`는 해당 map의 계산·저장을 원자적으로 다루는 계약을 제공하지만, mapping 함수가 null을 반환하거나 예외를 던지면 값이 남지 않아 다음 호출이 다시 계산할 수 있습니다. 값이 삭제된 뒤에는 같은 키가 다시 생성될 수도 있습니다.

mapping 함수는 짧고 부수 효과가 적게 유지하고 긴 외부 I/O·재진입·연쇄 map 갱신을 피합니다. 특정 구현의 잠금 범위를 추측해 다른 키 작업은 절대 영향 없다고 단정하지 않습니다. 긴 조회 합치기는 별도의 singleflight 수명·대기 상한이 더 명확할 수 있습니다.

map에 담은 가변 DTO의 필드를 여러 스레드가 수정하는 것은 map 자체 보호와 다릅니다. 원자 value·불변 값 교체·객체 잠금 등을 사용합니다. ConcurrentHashMap의 null 비허용·weakly consistent 순회는 일반 HashMap·전체 snapshot과 같은 계약이 아닙니다. 여러 키 불변식은 더 넓은 경계를 요구합니다.

## 가시성·논리 경쟁·외부 효과별 시험
실패를 진단할 때는 “값이 보이지 않았다”, “값은 보였지만 두 단계가 겹쳤다”, “map은 안전했지만 value가 변했다”를 구분합니다. 각각 volatile 게시, 원자 read-modify-write 또는 monitor, 불변 value·객체 잠금의 시험으로 연결해야 한 가지 통과 결과를 다른 보장으로 과장하지 않습니다.

장벽으로 두 읽기가 같은 값을 얻도록 만든 뒤 증가 유실을 보여 주고, 같은 monitor 또는 원자 증가로 바꿔 기대 합계를 확인합니다. 두 필드 snapshot·compute 실패 후 재호출·삭제 재생성·가변 value도 각각 시험합니다. 정상 반복 테스트 통과만으로 Java 메모리 모델의 모든 실행을 증명하지 않습니다.

Homebrew OpenJDK 21.0.12.1의 `scripts/VerifyJavaStudy.java`로 4개 작업의 synchronized 증가 4,000회가 보존되는 예제를 확인했습니다. volatile 공개·다중 필드·ConcurrentHashMap의 전체 경쟁은 이 실행에서 검증하지 않았으며 작은 카운터 통과를 Java 메모리 모델의 증명으로 확대하지 않습니다.

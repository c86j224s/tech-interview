---
id: java-shared-state
title: Java Volatile 공개와 복합 연산의 원자 경계
topic: 언어·런타임
summary: count++의 유실·volatile happens-before·동일 monitor·복수 atomic·ConcurrentHashMap의 check-then-act와 가변 value를 설명합니다.
questionIds: [java-synchronized-volatile, java-volatile-happens-before, atomic-integer-multi-field-invariant, java-concurrenthashmap-compound]
---

# Java Volatile 공개와 복합 연산의 원자 경계

## 값이 보여도 증가 두 번이 보존되지는 않습니다

volatile count가 0일 때 A와 B가 각각 0을 읽고 1을 계산해 저장하면 마지막 값은 1입니다. 읽기와 쓰기 각각의 가시성을 확보해도 두 단계 사이의 경쟁은 남습니다. `count++`는 읽기·계산·쓰기를 하나로 묶는 별도 원자 연산이 아닙니다.

| 순서 | A | B | count |
| --- | --- | --- | --- |
| 1 | 0 읽기 | | 0 |
| 2 | | 0 읽기 | 0 |
| 3 | 1 쓰기 | | 1 |
| 4 | | 1 쓰기 | 1 |

AtomicInteger의 get과 set을 따로 써도 같은 문제가 생깁니다. incrementAndGet 같은 원자 read-modify-write 또는 같은 monitor 안의 증가가 필요합니다. LongAdder 같은 통계 도구는 경합 특성이 좋을 수 있지만 동시에 읽는 합계의 일관성 요구와 맞는지 확인합니다.

## Volatile은 연결되는 쓰기와 읽기 사이의 순서를 만듭니다

```java
int data;
volatile boolean ready;
// 생산자: data = 42; ready = true;
// 소비자: if (ready) use(data);
```

한 번 게시하고 data를 다시 바꾸지 않는 예제에서, 생산자의 data 쓰기 다음 ready volatile 쓰기와 그 게시 이후의 소비자 ready 읽기가 동기화되어 이전 data 쓰기를 볼 근거가 됩니다. 다른 flag를 읽거나 ready=false인데 data를 사용하면 같은 근거가 아닙니다. ready를 재사용하며 data를 계속 바꾸면 이전 소비자와 다음 쓰기의 별도 경쟁을 해결해야 합니다.

```diagram
{"title":"같은 Volatile 필드의 게시 경로를 따릅니다","caption":"화살표는 순서와 동기화 관계입니다. 한 번 게시 뒤 data를 바꾸지 않는 모형이며 volatile 변수가 있다는 사실만으로 모든 필드 읽기가 보호되는 것은 아닙니다.","rows":[[{"id":"data","label":"생산자 data=42"}],[{"id":"publish","label":"ready=true volatile 쓰기"}],[{"id":"observe","label":"소비자 ready 게시 읽기"}],[{"id":"use","label":"소비자 data 사용"}]],"edges":[{"from":"data","to":"publish","label":"프로그램 순서"},{"from":"publish","to":"observe","label":"동기화"},{"from":"observe","to":"use","label":"프로그램 순서"}]}
```

synchronized는 같은 monitor의 상호 배제와 unlock→이후 lock의 happens-before를 제공합니다. 인스턴스 synchronized는 해당 객체, static synchronized는 클래스 객체의 monitor를 사용합니다. 서로 다른 인스턴스의 잠금으로 같은 static 데이터를 보호하면 한 경계가 되지 않습니다.

## 두 Atomic의 합계는 한 번에 읽히지 않습니다

A잔액 감소와 B잔액 증가를 각각 atomic으로 수행해도 독자가 그 사이를 읽으면 합계가 달라질 수 있습니다. 같은 잠금으로 두 변경과 필요한 읽기를 묶거나, 두 값을 가진 불변 상태 하나를 AtomicReference CAS로 교체하는 방식이 필요합니다. 독자도 같은 묶음 루트를 한 번 읽어야 합니다.

CAS 갱신 함수는 충돌로 재실행될 수 있으므로 외부 결제·알림 같은 부수 효과를 넣지 않습니다. 성공한 상태 변경 이후의 외부 효과는 별도 멱등·outbox 등의 계약으로 연결합니다. atomic이라는 이름이 DB 거래나 외부 효과의 원자성을 제공하지 않습니다.

## ConcurrentHashMap은 내부 연산 단위를 보호합니다

두 스레드가 get에서 없음으로 보고 각각 생성·put하면 map은 손상되지 않아도 중복 생성이 생깁니다. putIfAbsent는 저장 승자를 원자적으로 정하지만 메서드 인자로 만들기 전에 두 번 실행한 생성 부수 효과까지 없애지는 못합니다. computeIfAbsent는 해당 map의 원자 계산 계약을 제공하지만 mapping 함수가 null을 반환하거나 예외를 던지면 값이 남지 않아 나중 호출에서 다시 계산할 수 있습니다. 삭제 뒤 재생성도 가능합니다.

mapping 함수는 짧고 부수 효과가 적게 유지하고 긴 외부 I/O·재진입·연쇄 map 갱신을 피합니다. 특정 구현의 잠금 범위를 추측해 다른 키 작업은 절대 영향 없다고 단정하지 않습니다. 긴 조회 합치기는 별도의 singleflight 수명·대기 상한이 더 명확할 수 있습니다.

map에 담은 가변 DTO의 필드를 여러 스레드가 수정하는 것은 map 자체 보호와 다릅니다. 원자 value·불변 값 교체·객체 잠금 등을 사용합니다. ConcurrentHashMap의 null 비허용·weakly consistent 순회는 일반 HashMap·전체 snapshot과 같은 계약이 아닙니다. 여러 키 불변식은 더 넓은 경계를 요구합니다.

## 가시성·논리 경쟁·외부 효과를 나눠 시험합니다

장벽으로 두 읽기가 같은 값을 얻도록 만든 뒤 증가 유실을 보여 주고, 같은 monitor 또는 원자 증가로 바꿔 기대 합계를 확인합니다. 두 필드 snapshot·compute 실패 후 재호출·삭제 재생성·가변 value도 각각 시험합니다. 정상 반복 테스트 통과만으로 Java 메모리 모델의 모든 실행을 증명하지 않습니다.

Homebrew OpenJDK 21.0.12.1의 `scripts/VerifyJavaStudy.java`로 4개 작업의 synchronized 증가 4,000회가 보존되는 예제를 확인했습니다. volatile 공개·다중 필드·ConcurrentHashMap의 전체 경쟁은 이 실행에서 검증하지 않았으며 작은 카운터 통과를 Java 메모리 모델의 증명으로 확대하지 않습니다.

---
id: java-collections
title: Java 컬렉션과 자료구조 선택
topic: 언어·런타임
summary: Java 컬렉션의 의미와 구현 비용을 작업 부하·순서·변경·동시성 계약으로 연결해 선택하고 운영하는 방법을 설명합니다.
questionIds: []
prerequisites: [programming-language-foundations]
related: [sequence-containers, stack-queue, hash-table, java-equality-immutability, java-shared-state]
reviewedAt: '2026-09-17'
---

# Java 컬렉션과 자료구조 선택

## 계층과 의미

Java 컬렉션은 여러 원소를 묶어 다루는 인터페이스와 구현체의 계층입니다. `Collection<E>`는 원소 집합을 나타내는 뿌리 인터페이스이지만, 중복 허용 여부나 순서를 하나로 정하지 않습니다. `List`는 위치와 중복을 다루고, `Set`은 동등하다고 판단되는 원소의 중복을 허용하지 않으며, `Queue`와 `Deque`는 인출 방향을 표현합니다. `Map<K,V>`는 `Collection`의 하위 타입이 아니라 키와 값을 연결하는 별도 계층입니다.

이 구분은 변수 선언의 문법 취향이 아니라 호출자가 의존해도 되는 의미를 정하는 일입니다. 시간순 화면이 결과의 일부라면 순서를 가진 `List`가 필요하고, 구성원 중복이 오류라면 `Set`이 필요합니다. 단순히 출력 중복을 줄이려고 `Set`으로 바꾸면 같은 식별자를 가진 두 기록 중 하나를 잃을 수 있으므로, 중복 제거가 정말 업무 규칙인지 먼저 확인합니다.

구현체는 인터페이스 계약을 좁히거나 보완합니다. `HashMap`의 순회 결과를 현재 실행에서 우연히 안정적으로 보았다고 해서 순서 계약이 생기지는 않습니다. 호출자는 선택한 타입이 약속하는 순서·`null`·변경·동시성 의미를 기준으로 코드를 작성해야 합니다.

## 작업 부하와 선택 기준

선택은 “삽입이 빠른가”라는 한 문장보다 한 요청의 실제 연산 순서에서 시작합니다. 원소 수와 최대 크기, 인덱스 조회 비율, 중간 삽입 위치, 전체 순회 횟수, 키 조회 비율, 원소의 크기, 동시 접근 범위를 함께 적습니다. 같은 `List`라도 인덱스로 자주 읽는 목록과 이미 가진 노드 주변을 편집하는 목록은 다른 비용을 가집니다.

| 작업 부하 | 먼저 확인할 계약 | 시작점과 경계 |
| --- | --- | --- |
| 인덱스 조회와 순차 순회 | 위치 접근과 순회 비용 | `ArrayList`; 중간 삽입은 이동 비용 포함 |
| 양끝 삽입·삭제 | 앞뒤 인출 방향과 `null` 정책 | `ArrayDeque`; 공유 접근은 별도 보호 |
| 키 조회와 갱신 | 키 동등성·해시·순서 | `HashMap`; 순서는 보장하지 않음 |
| 키 조회와 만남 순서 | 삽입 또는 접근 순서 | `LinkedHashMap`; `get`도 순서를 바꿀 수 있음 |
| 중복 없는 구성원 | 동등성·변경 가능한 키 여부 | `HashSet` 또는 순서 있는 집합 |
| 알려진 연결 위치 편집 | 위치 탐색 비용과 노드 수명 | `LinkedList`를 제한적으로 검토 |

이 표의 “시작점”은 측정 전의 가설입니다. 예를 들어 20개짜리 목록에서 구조 선택보다 잘못된 동등성 구현이 더 큰 결함일 수 있습니다. 대표 입력으로 최종 지연, 힙 사용량, 할당, 순회 비용을 측정하고, 결과가 달라진 이유를 작업 비율로 설명합니다. 배열과 연결 목록의 위치 탐색·변경 분리는 [배열·리스트의 위치 탐색과 변경 비용](/tech-interview/notes/sequence-containers/)에서 더 깊게 다룹니다.

## 배열 목록과 연결 목록

`ArrayList`는 크기가 늘어나는 배열에 원소 참조를 보관합니다. 인덱스 `get`은 위치 계산으로 접근하고, 용량이 남아 있는 끝 삽입은 대부분 일정한 비용으로 끝납니다. 용량 확장이 일어나는 순간에는 더 큰 배열을 만들고 기존 참조를 옮기므로, 끝 삽입의 장기 비용은 상각된 일정 시간으로 설명합니다. 중간 삽입은 뒤 원소를 오른쪽으로 이동합니다.

`LinkedList`는 양쪽 링크를 가진 노드로 `List`와 `Deque`를 구현합니다. 인덱스 접근은 가까운 끝에서 노드를 따라가므로 위치를 찾는 비용이 있습니다. 이미 삽입 위치의 노드나 반복자를 가지고 있다면 링크 몇 개를 바꾸는 비용은 작지만, 그 위치를 찾는 순회와 노드 할당, 분산된 메모리 접근을 제외해서는 안 됩니다.

`[A, B, C, D]`의 인덱스 1에 `X`를 넣는 과정을 비교해 보겠습니다. 배열 목록은 `B, C, D` 참조를 오른쪽으로 이동한 뒤 `X`를 넣어 `[A, X, B, C, D]`를 만듭니다. 연결 목록은 `A`와 `B` 노드를 이미 알고 있다면 `A.next`, `X.prev`, `X.next`, `B.prev`를 함께 갱신합니다. 그러나 인덱스 1을 얻기 위해 앞에서 두 번째 노드까지 이동했다면 그 탐색 비용은 그대로 남습니다.

원소가 큰 객체일 때 배열이 객체 자체가 아니라 참조를 옮긴다는 점도 구분합니다. 참조 이동 바이트가 작아도 대상 객체를 따라가는 간접 접근과 흩어진 노드의 캐시 손실이 생길 수 있습니다. 이 효과의 크기는 JVM, 객체 크기, 입력 분포에 따라 달라지므로 일반적인 숫자로 단정하지 않습니다.

## 양끝 인출과 실행 순서

`Deque`는 양끝에서 넣고 빼는 인터페이스입니다. 뒤에 넣고 앞에서 빼면 먼저 들어온 것을 먼저 처리하는 FIFO 큐가 되고, 앞에 넣고 앞에서 빼면 마지막 입력을 먼저 처리하는 LIFO 스택이 됩니다. Java의 `ArrayDeque`는 크기가 늘어나는 배열 구현이며 기본 양끝 연산은 상각된 일정 시간으로 설명됩니다.

`ArrayDeque`는 `null` 원소를 허용하지 않습니다. 이 제약 덕분에 비어 있을 때 `poll`·`peek`가 반환하는 부재 값과 실제 원소를 구별하기 쉽습니다. 비어 있으면 예외를 내는 `remove`·`pop`과 부재를 반환하는 `poll`·`peek` 중 어떤 실패 의미를 외부 API에 노출할지도 정합니다.

```java
Deque<Job> jobs = new ArrayDeque<>();
jobs.offerLast(jobA);       // 접수 순서의 뒤
jobs.offerLast(jobB);
Job next = jobs.pollFirst(); // jobA

Deque<Edit> undo = new ArrayDeque<>();
undo.push(editC);           // 최근 변경을 앞에 저장
Edit latest = undo.pop();   // editC
```

이 코드는 인출 순서만 보여 줍니다. `jobA`를 워커 1에, `jobB`를 워커 2에 배정하면 `jobB`가 먼저 끝날 수 있습니다. 접수 순서대로 외부 효과를 적용해야 한다면 키별 직렬화, 완료 재정렬, 저장소 버전 조건 중 별도 계약이 필요합니다. undo와 redo의 분기 상태는 [스택·원형 큐와 실행 순서의 경계](/tech-interview/notes/stack-queue/)의 상태 전이를 함께 참고합니다.

```diagram
{"title":"작업 의미에서 구현 선택으로","caption":"먼저 원소 순서와 중복·키·접근 방향을 결정하고, 그 계약을 만족하는 구현을 대표 부하로 검증합니다.","rows":[[{"id":"workload","label":"작업 부하 기록","detail":["조회 · 삽입 · 순회"]}],[{"id":"contract","label":"컬렉션 계약","detail":["순서 · 중복 · 키"]}],[{"id":"implementation","label":"구현체 선택","detail":["배열 · 해시 · 양끝"]}],[{"id":"operation","label":"운영 검증","detail":["지연 · 메모리 · 동시성"]}]],"edges":[{"from":"workload","to":"contract","label":"요구 분리"},{"from":"contract","to":"implementation","label":"계약에 맞춤"},{"from":"implementation","to":"operation","label":"대표 부하 확인"}]}
```

## 키와 집합의 동등성

`HashMap`과 `HashSet`은 키 또는 원소의 `equals`와 `hashCode` 계약에 의존합니다. 동등한 두 객체는 같은 해시 값을 가져야 하며, 해시 테이블에 들어간 뒤 비교에 쓰는 필드를 바꾸면 다른 버킷을 찾게 될 수 있습니다. 그러면 맵에 항목이 남아 있어도 조회가 실패하는 것처럼 보입니다. 키는 가능한 한 불변 값으로 만듭니다.

`HashMap`의 평균적인 일정 시간 조회는 해시가 적절히 분산된다는 조건 아래의 설명입니다. `HashMap`은 `null` 키와 값을 허용하지만, `get(key)`의 `null`은 키 부재와 명시적인 `null` 매핑을 모두 나타낼 수 있습니다. 두 상태를 구별하려면 `containsKey`를 사용하거나 저장 값에서 `null`을 금지합니다. 순회 순서가 필요하면 순서를 계약으로 가진 구현을 선택합니다.

`LinkedHashMap`은 해시 기반 조회와 연결 구조를 결합합니다. 기본은 삽입 순서이고, 접근 순서 모드에서는 `get` 같은 접근이 최근 사용 순서를 바꿀 수 있습니다. 따라서 접근 순서 기반 캐시에서 읽기는 관찰만 하는 연산이 아니라 구조를 바꾸는 연산이 될 수 있습니다. `HashSet`에 이미 동등한 문자열이 있을 때 새 값을 넣으면 `add`는 `false`를 반환하고 집합의 구성은 바뀌지 않습니다.

## 뷰와 스냅샷

읽기 전용 접근과 불변 스냅샷은 다릅니다. `Collections.unmodifiableList(backing)`은 그 참조를 통한 구조 변경을 막는 뷰일 뿐입니다. 다른 참조가 `backing`에 원소를 추가하면 뷰에서도 그 변경이 보입니다. 원소가 가변 객체라면 목록 구조를 바꾸지 못해도 원소의 필드 변경은 관찰될 수 있습니다.

`List.copyOf(backing)`은 입력의 반복 순서를 보존하는 변경 불가 목록을 반환하고 이후 `backing`의 구조 변경을 반영하지 않습니다. 입력 컬렉션이나 원소가 `null`이면 거절됩니다. 다만 원소 객체까지 깊게 복사하지는 않으므로 `Order`가 가변이면 스냅샷 안의 같은 `Order`를 통해 내부 상태가 바뀔 수 있습니다.

```java
List<Order> backing = new ArrayList<>();
backing.add(orderA);
List<Order> view = Collections.unmodifiableList(backing);
List<Order> snapshot = List.copyOf(backing);

backing.add(orderB);
// view에는 orderB가 보이고, snapshot에는 보이지 않는다.
// orderA 자체가 가변이면 두 목록에서 그 내부 변경이 보일 수 있다.
```

호출 시점의 구성만 고정하면 스냅샷이 맞고, 최신 backing 상태를 읽되 호출자의 구조 변경만 막으면 뷰가 맞습니다. 원소 내부 변경까지 막아야 한다면 원소를 불변 값으로 만들거나 원소별 복사 정책을 추가해야 합니다. 이 차이는 [Java 값 동등성·불변 키·방어적 복사](/tech-interview/notes/java-equality-immutability/)의 불변성 계약과 연결됩니다.

## 동시 접근과 복합 연산

`ArrayList`, `HashMap`, `ArrayDeque`는 일반적으로 동기화된 자료구조가 아닙니다. 여러 스레드가 구조를 바꾼다면 외부 잠금이나 동시성 전용 자료구조가 필요합니다. 반복자가 `ConcurrentModificationException`을 던질 수 있어도 그것은 최선의 노력에 의한 변경 감지일 뿐, 데이터 정확성이나 예외 발생을 보장하는 동기화 수단이 아닙니다.

`ConcurrentHashMap`의 조회는 대체로 갱신과 겹칠 수 있고, `computeIfAbsent` 같은 복합 메서드는 전체 호출을 원자적 경계로 수행합니다. 그러나 매핑 함수가 오래 걸리면 다른 갱신이 막힐 수 있고, 매핑 함수 안에서 같은 맵을 재귀적으로 수정하는 설계는 피해야 합니다. 맵의 원자성이 값 객체 내부의 여러 필드 변경까지 보호하지도 않습니다.

```java
ConcurrentHashMap<String, Session> sessions = new ConcurrentHashMap<>();
Session session = sessions.computeIfAbsent(userId, id -> createSession(id));
```

`createSession`이 외부 결제나 네트워크 호출을 수행한다면 맵 연산의 원자성과 외부 효과의 원자성을 혼동하게 됩니다. 맵에는 짧고 결정적인 상태를 저장하고, 오래 걸리는 작업은 작업 상태·멱등 키·재시도 경계를 별도로 둡니다. 공유 상태의 가시성과 복합 원자성은 [Java Volatile 공개와 복합 연산의 원자 경계](/tech-interview/notes/java-shared-state/)에서 더 깊게 다룹니다.

## 주문 화면의 선택 추적

주문 처리 화면에서 최근 주문 50개를 시간순으로 표시하고 주문 번호로 현재 상태를 찾으며 같은 알림의 중복 발송을 막는다고 하겠습니다. 화면 목록은 순서와 순차 순회가 중요하므로 `ArrayList`를 시작점으로 둡니다. 주문 번호 조회는 `HashMap<String,Order>`로 분리하고, 만남 순서를 재현해야 한다면 `LinkedHashMap`을 검토합니다. 알림 식별자는 `HashSet`에 넣되 식별자 필드를 변경하지 않습니다.

처리 상태를 숫자로 따라가면, 데이터베이스에서 A·B·C 세 주문을 읽을 때 `orders=[A,B,C]`, `byId={A→A,B→B,C→C}`, `seen=[]`이 됩니다. B의 알림 ID가 `n7`이면 발송 전에 `seen.add(n7)`의 결과가 `true`인지 확인합니다. 같은 `n7`이 다시 오면 결과는 `false`이고 외부 발송을 생략합니다. 단, 이 세 메모리 구조를 저장소·외부 발송과 한 거래로 착각하면 안 됩니다.

메모리 스냅샷을 만들던 중 프로세스가 중단되거나 외부 발송 뒤 `seen` 저장이 실패하면 재발송 가능성이 생깁니다. 이 경우 자료구조 선택만으로 중복을 없앨 수 없고, 외부 효과에 요청 ID를 부여하거나 발송 원장과 소비자 중복 제거를 별도로 설계해야 합니다. 자료구조의 의미와 분산 효과의 의미를 같은 보장으로 말하지 않습니다.

## 운영과 진단

구현 전에 원소 수와 최대 크기, `null`의 의미, 순서의 필요성, 변경 주체, 동시 접근 범위를 타입 계약이나 설계 기록에 남깁니다. `Map.get`의 `null`처럼 정상 부재와 저장 값이 충돌하면 `containsKey`, 별도 결과 타입, `null` 금지 중 하나를 선택합니다.

운영에서는 평균 시간보다 순회 p95·p99, 힙 사용량, 할당 횟수, 재해시 시점, 큐 길이와 가장 오래된 항목, 동시 접근 오류를 함께 봅니다. `ArrayList`가 느리다면 인덱스 접근인지 중간 이동인지 원소 생성인지 분해합니다. `HashMap`이 느리다면 해시 분포, 용량, 키 길이, 순회 비용을 분리합니다. 이 글에서는 Java 컴파일·실행과 성능 측정을 수행하지 않았으므로 아래 숫자는 문서의 비용 모형이 아니라 계약 설명입니다.

진단 입력에는 빈 컬렉션, `null`, 중복 키, 순서가 다른 입력, 큰 중간 삽입, `ArrayDeque`의 여러 번 순환, 변경 가능한 키, backing 변경을 반영하는 뷰, `computeIfAbsent`의 재진입을 넣습니다. 기대하는 최종 원소·순서·예외·최대 지연을 기준 구현과 비교해야 현재 JVM에서 우연히 나온 순회 순서에 의존하지 않습니다.

## 참고 자료와 검증 범위

- [Java SE 25 `Collection` API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collection.html) — Java SE 25/JDK 25. 컬렉션 계층, 중복·순서, 수정 불가 뷰와 원소 가변성의 경계를 확인했습니다.
- [Java SE 25 `List` API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html) — Java SE 25/JDK 25. `List.copyOf`의 반복 순서, `null` 거부, 원본 구조 변경 비반영, 가변 원소의 경계를 확인했습니다.
- [Java SE 25 `ArrayList` API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayList.html) — Java SE 25/JDK 25. 배열 기반 접근·용량·비동기화 계약을 확인했습니다.
- [Java SE 25 `ArrayDeque` API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html) — Java SE 25/JDK 25. 양끝 연산, `null` 금지, 상각 비용과 동기화 경계를 확인했습니다.
- [Java SE 25 `HashMap` API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html) — Java SE 25/JDK 25. `null`, 순서 비보장, 해시 기반 조회와 용량 계약을 확인했습니다.
- [Java SE 25 `LinkedHashMap` API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/LinkedHashMap.html) — Java SE 25/JDK 25. 삽입 순서와 접근 순서의 차이를 확인했습니다.
- [Java SE 25 `ConcurrentHashMap` API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) — Java SE 25/JDK 25. 조회 겹침, `computeIfAbsent` 원자성, 매핑 함수의 길이·수정 경계를 확인했습니다.

API 의미는 확인일인 2026-09-17의 Java SE 25/JDK 25 문서에 한정합니다. 연결 목록·배열의 세부 비용은 구현과 작업 부하에 따라 달라지며 이 문서의 작성 과정에서 Java 코드 컴파일·실행이나 성능 측정을 하지 않았습니다. 따라서 코드와 수치 추적은 교육용 계약 설명이고, 특정 JVM의 벤치마크 결과가 아닙니다.

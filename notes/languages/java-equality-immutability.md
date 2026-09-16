---
id: java-equality-immutability
title: Java 값 동등성·불변 키·방어적 복사
topic: 언어·런타임
summary: equals·hashCode와 상속의 대칭성·추이성을 설명하고 final·수정 불가 view·copyOf·원소 가변성·초기화 공개를 구분합니다.
questionIds: [java-equals-hashcode, hashmap-key-value-mutation, java-equals-inheritance-symmetry, java-final-immutability, java-list-copyof-element-mutation, java-final-field-safe-publication]
---

# Java 값 동등성·불변 키·방어적 복사

## 저장한 키를 바꾸면 조회가 다른 후보 위치를 찾습니다

`HashSet`에 비교 필드가 "a"인 키 객체를 넣으면, 삽입 시 계산한 해시로 저장 후보 위치를 정합니다. 그 필드를 "b"로 바꾼 뒤 `contains`나 `remove`를 호출하면 새 해시로 다른 후보 위치를 찾을 수 있어, 같은 객체가 내부에 남아 있어도 발견하지 못할 수 있습니다. 특정 실패 출력이 모든 `Set`에서 보장되는 것은 아니며, 저장 중 동등성에 영향을 주는 값을 바꾸면 컬렉션 계약을 신뢰할 수 없다는 점이 핵심입니다.

HashMap의 value 내부 변경은 일반적으로 key의 hash 위치를 바꾸지 않습니다. 그러나 key와 value가 같은 가변 객체를 공유하거나 value 변경이 key의 비교 필드를 간접 수정하면 같은 문제가 생깁니다. map 자체의 동시성도 별도입니다.

## Equals와 HashCode는 한 방향의 계약입니다

| 성질 | 의미 | 반례의 결과 |
| --- | --- | --- |
| 반사성 | a.equals(a) | 자기 조회 불안정 |
| 대칭성 | a=b이면 b=a | 삽입·조회 방향 의존 |
| 추이성 | a=b, b=c이면 a=c | 집합의 동등류 불명확 |
| 일관성 | 비교 상태가 같으면 결과 유지 | 캐시·집합 의미 붕괴 |
| hash 방향 | equals이면 같은 hashCode | 같은 값이 다른 후보 위치 |

같은 hashCode가 같은 객체나 같은 값을 뜻하지는 않습니다. 충돌은 정상 가능성이며 후보를 찾은 뒤 equals로 구분합니다. 모든 객체가 같은 해시를 내도 방향 계약은 만족할 수 있지만 성능이 나빠집니다. Object의 기본 equals는 참조 동일성이므로 내용 기반 equals를 정의하면 같은 기준의 hashCode도 함께 정의합니다.

키는 안정된 불변 ID나 최종 값 타입으로 만드는 것이 단순합니다. 변경이 꼭 필요하면 변경 **전에** 컬렉션에서 제거하고 바꾼 뒤 다시 삽입합니다. 동시 조회가 있으면 세 단계를 같은 보호 경계에 둡니다. 이미 바꾼 뒤 remove를 호출하는 것은 늦을 수 있습니다.

## 상속으로 동등성 필드를 늘리면 관계가 깨질 수 있습니다

Point가 x·y만 비교하고 ColoredPoint는 색상까지 비교한다고 합시다. Point가 자식도 같은 좌표면 같다고 하지만 자식은 색상을 요구하면 `point.equals(colored)`와 반대 방향 결과가 다릅니다. 대칭성을 맞추려고 자식이 부모와 비교할 때 색상을 무시하면 빨강 점·부모 점·파랑 점 사이 추이성이 깨질 수 있습니다.

동등성의 타입 경계를 명시적으로 정합니다. getClass 기반 비교, final 값 타입, 좌표와 색상을 조합한 별도 타입 등 선택은 사용 모델에 달렸습니다. 모든 상속에 같은 만능 equals 패턴을 붙이지 않습니다. 부모·자식·세 번째 객체의 양방향과 삼각 비교를 검사합니다.

## Final은 참조를 고정하고 객체 그래프를 얼리지 않습니다

```java
final var names = new java.util.ArrayList<String>();
names.add("Java"); // 가능
var view = java.util.Collections.unmodifiableList(names);
var snapshot = java.util.List.copyOf(names);
names.add("JVM");
// view는 [Java, JVM], snapshot은 [Java]
```

이 실행문은 `main` 등에 두고 순서대로 실행합니다. `final`은 `names` 변수가 다른 리스트를 가리키지 못하게 할 뿐, 가변 리스트의 `add`까지 막지는 않습니다.

`Collections.unmodifiableList(names)`는 그 view를 통해 수정하는 것만 막으므로 `names.add("JVM")` 뒤에는 view에도 `JVM`이 보이지만, `List.copyOf(names)`는 복사 시점의 구조를 보존해 이후 원본의 추가·삭제를 반영하지 않는 수정 불가 목록을 줍니다. `copyOf`가 항상 새 객체 정체성을 만든다고 보장하지 않으며, null 원소는 거절하는 조건도 있습니다.

```diagram
{"title":"목록 구조와 원소 객체의 불변성은 다릅니다","caption":"화살표는 원소 참조입니다. List.copyOf가 목록의 추가·삭제를 막아도 가변 원소를 깊게 복제하지 않으므로 다른 별칭의 필드 수정은 보일 수 있습니다.","rows":[[{"id":"original","label":"원본 List"},{"id":"copy","label":"copyOf List"}],[{"id":"element","label":"같은 가변 DTO 원소"}]],"edges":[{"from":"original","to":"element","label":"원소 참조"},{"from":"copy","to":"element","label":"참조 복사"}]}
```

`List.copyOf`는 목록 구조를 고정할 뿐이므로, 원소가 배열·DTO·중첩 컬렉션처럼 가변이면 다른 별칭의 필드 변경이 복사 목록에서도 관찰될 수 있습니다. 생성자에서 입력 목록만 복사해도 getter가 내부 배열을 그대로 반환하면 호출자가 다시 내부 상태를 바꿀 수 있습니다. 따라서 필요한 깊이에서 방어 복사를 하거나 불변 값으로 변환해야 하며, record도 참조 구성요소의 깊은 불변과 배열의 업무상 내용 동등성을 자동으로 제공하지 않습니다.

## Final 필드 초기화 보장과 이후 공개를 나눕니다

Java 메모리 모델은 생성자가 규칙대로 끝난 객체를 다른 스레드가 볼 때 `final` 필드의 초기화 값을 특별히 보장합니다. 이 보장은 생성 중인 `this`가 listener 등록·thread 시작·전역 저장을 통해 다른 스레드로 탈출하지 않았다는 전제에서 이해해야 합니다. 생성자에서 덜 초기화된 객체를 먼저 노출하면 그 전제를 깨뜨릴 수 있습니다.

final 참조가 가리키는 생성 시점 상태의 가시성과 그 대상의 이후 가변 수정은 다릅니다. 최신 snapshot 루트를 계속 교체하는 경우에는 volatile·잠금 같은 안전한 공개 경로를 사용합니다. 불변 객체라도 여러 writer가 같은 옛 버전에서 새 값을 계산하면 lost update가 생길 수 있어 변경 원자 경계가 필요합니다.

## 동등성·별칭·공개를 각각 검사합니다

동등한 두 값의 해시, 다른 값의 충돌 허용, null, 상속 조합을 검사합니다. 입력 목록·원소를 바꾸거나 getter 결과를 바꿨을 때 불변 객체의 관찰 결과가 유지되는지 확인합니다. 키 변경 시험의 실패 출력을 보편 명세로 쓰지 말고 금지된 사용의 원인을 보여 주는 예로 한정합니다.

Homebrew OpenJDK 21.0.12.1의 `scripts/VerifyJavaStudy.java` 실행에서 unmodifiable view와 copyOf의 구조 차이·가변 원소 공유를 확인했습니다. equals 상속의 모든 조합·키 변경·this escape는 이 실행 범위에 포함하지 않았습니다. 공개의 메모리 모델 보장은 실행 한 번이 아니라 언어 계약과 별도 동시성 검증으로 판단해야 합니다.

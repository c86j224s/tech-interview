---
id: java-final-immutability
title: "final List를 선언했는데도 원소가 바뀝니다. final 변수, 참조 대상 객체의 변경, 진짜 불변 객체를 어떻게 구분하나요?"
difficulty: 하
category: 언어·런타임
tags: ["Java","final","참조","불변성","방어적 복사"]
related: ["java-equals-hashcode"]
---

# final List를 선언했는데도 원소가 바뀝니다. final 변수, 참조 대상 객체의 변경, 진짜 불변 객체를 어떻게 구분하나요?

## 구두 답변

`final`은 변수가 보관한 값을 다시 대입하지 못하게 하는 한정자입니다. 변수 타입이 참조 타입이면 고정되는 것은 참조 자체이지, 그 참조가 가리키는 객체의 내부 상태가 아닙니다. 따라서 `final List<String>`에 다른 리스트를 대입할 수는 없지만, 리스트가 가변 구현체라면 `add`나 `remove`로 상태를 바꿀 수 있습니다. 배열도 객체이므로 `final` 배열의 요소는 변경할 수 있습니다.

아래는 `main` 등 메서드 안에서 실행하는 설명용 코드 조각입니다.

```java
final java.util.List<String> names = new java.util.ArrayList<>();
names.add("Java");                 // 가능
System.out.println(names);         // [Java]
// names = new java.util.ArrayList<>(); // 컴파일 오류

java.util.List<String> view = java.util.Collections.unmodifiableList(names);
names.add("JVM");                  // 원본 변경은 가능
System.out.println(view);           // [Java, JVM]
```

`unmodifiableList`는 해당 뷰를 통한 변경을 막지만 원본이 바뀌면 뷰에서도 변화가 보일 수 있습니다. 입력 시점의 복사본을 독립적으로 보관하려면 `List.copyOf(names)`로 원본 리스트의 이후 구조 변경이 반영되지 않는 수정 불가 리스트를 얻을 수 있습니다. 이는 원본을 계속 바라보는 뷰와 다릅니다. 다만 리스트 원소 자체가 가변 객체라면 리스트 구조만 고정될 뿐 원소 내부의 변경까지 막지는 않습니다.

객체를 불변으로 설계하려면 상태를 생성 시 확정하고 변경 메서드를 제공하지 않으며, 내부 가변 컬렉션을 외부에 그대로 반환하지 않아야 합니다. 생성자에서도 호출자가 가진 가변 객체를 그대로 저장하지 말고 필요한 경우 방어적 복사를 하겠습니다. `final`은 재할당 규칙이고 불변성은 객체 설계의 결과이므로, 둘을 같은 뜻으로 사용하면 공유 상태 변경을 놓치게 됩니다.

## 득점 포인트

- final 참조가 재대입만 막고 참조 대상의 변경은 막지 않는다는 핵심을 설명한다.
- unmodifiable 뷰와 원본 변경, 복사본의 차이를 실제 코드 결과로 구분한다.
- 생성자 복사·변경 메서드 제한·내부 컬렉션 비노출을 불변 설계 조건으로 제시한다.

## 감점 포인트

- final List는 어떤 경로로도 원소를 변경할 수 없다고 말한다.
- unmodifiableList를 원본 데이터까지 복제하는 불변 컬렉션으로 설명한다.
- final 키워드만 붙이면 내부 가변 객체와 원소의 변경도 차단된다고 가정한다.

## 더 파고들 거리

- List.copyOf와 방어적 복사의 차이는 원소의 깊은 복사 문제와 어떻게 연결되나요?
- 불변 객체의 equals·hashCode가 해시 키로 사용될 때 어떤 장점이 있나요?
- final 필드와 생성자 안전 공개가 멀티스레드 가시성에 주는 효과는 무엇인가요?

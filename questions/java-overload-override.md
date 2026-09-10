---
id: java-overload-override
title: "선언 타입은 A지만 실제 객체는 B일 때, 오버로딩과 오버라이딩은 메서드를 각각 언제 결정하나요?"
answerMinutes: 5
followups: [{"id":"java-generics-erasure","prompt":"제네릭 상속으로 소거 시그니처가 달라질 때 bridge method가 동적 디스패치에 어떤 역할을 할까요?"},{"id":"java-annotation-retention","prompt":"@Override가 컴파일러에 제공하는 검사는 런타임 reflection 어노테이션과 어떤 층이 다른가요?"},{"id":"java-boxing-null","prompt":"null 리터럴과 래퍼 overload가 섞이면 가장 구체적인 메서드 선택이 왜 모호해질까요?"}]
difficulty: 하
category: 언어·런타임
tags: ["Java","오버로딩","오버라이딩","컴파일 타임","동적 디스패치"]
related: ["java-annotation-retention"]
---

# 선언 타입은 A지만 실제 객체는 B일 때, 오버로딩과 오버라이딩은 메서드를 각각 언제 결정하나요?

## 구두 답변

오버로딩(overloading)은 같은 이름에 다른 매개변수 시그니처를 제공하는 것이고, 컴파일 시점에 수신 표현식의 선언 타입과 인수의 컴파일 타입을 기준으로 선택됩니다. 오버라이딩(overriding)은 하위 클래스의 인스턴스 메서드가 상위 메서드의 구현을 재정의하는 것이며, 컴파일 시 선택된 메서드 시그니처에 대해 실행 시 실제 객체의 구현이 결정됩니다. 즉, 인수의 실제 객체 타입을 보고 런타임에 오버로드를 다시 고르는 것은 아닙니다.

### 시그니처를 고르는 시점

아래는 설명용 코드 조각입니다. 타입·메서드 선언과 실행문을 나누어 배치하고, 실행문은 `main` 등 메서드 안에서 실행합니다.

```java
class A {
    void f(Object x) { System.out.println("A.f(Object)"); }
}
class B extends A {
    @Override void f(Object x) { System.out.println("B.f(Object)"); }
    void f(String x) { System.out.println("B.f(String)"); }
}

A a = new B();
a.f("hello");       // B.f(Object)
((B) a).f("hello"); // B.f(String)
```

첫 호출에서 컴파일러는 `a`의 선언 타입인 `A`에서 `f(Object)`를 찾습니다. `B`에만 있는 `f(String)`은 그 단계의 후보가 아닙니다. 실행 시 실제 객체가 `B`임을 반영해 선택된 `f(Object)`의 재정의 구현인 `B.f(Object)`가 실행됩니다. 두 번째 호출은 캐스팅으로 수신 표현식의 컴파일 타입을 `B`로 만들었기 때문에 컴파일 시 `f(String)` 오버로드가 선택됩니다. 결과는 각각 `B.f(Object)`, `B.f(String)`입니다.

### 동적 디스패치의 예외

반환 타입만 바꾸어 오버로딩할 수는 없고, `static` 메서드는 인스턴스 메서드처럼 오버라이딩되지 않고 hiding 규칙을 따릅니다. 따라서 API를 설계할 때 호출 지점의 선언 타입과 인수 타입을 먼저 보고, 상속으로 구현을 바꿀 지점에는 `@Override`를 붙여 컴파일러 검사를 받겠습니다.

### 선택 기준과 검증

`null`은 여러 참조형 overload에 적용될 수 있어 가장 구체적인 후보가 하나가 아니면 컴파일 단계에서 모호성이 됩니다. `static` 메서드와 필드는 동적 디스패치가 아니라 선언 타입·클래스에 따른 hiding/binding이므로 클래스 이름으로 호출해 의도를 드러내겠습니다. 브리지 메서드가 필요한 제네릭 상속은 소거와 override 연결을 확인할 별도 사례로 분리하겠습니다.

오버로딩에는 참조형의 구체성뿐 아니라 기본형 확장, boxing, 가변 인자 변환의 적용 단계도 영향을 줍니다. int 인수를 받는 long 오버로드와 Integer 오버로드가 함께 있으면 '가까워 보이는 이름' 대신 컴파일러의 적용 규칙으로 판단해야 합니다. API에 비슷한 오버로드가 너무 많으면 호출자가 null이나 래퍼를 넘길 때 모호성이 생기므로 의도가 다른 연산은 이름을 분리하는 편이 낫습니다.

제네릭 상위 타입의 메서드를 구체 타입으로 override하면 소거 뒤 호출을 연결하기 위해 컴파일러가 bridge method를 생성할 수 있습니다. 이는 실행 중 실제 인수 타입으로 새로운 오버로드를 고르는 것이 아니라 이미 정한 override 관계를 유지하는 장치입니다. javap 출력에서 bridge를 확인하고, 부모 참조·자식 참조·캐스트된 참조로 호출해 같은 시그니처의 동적 선택과 서로 다른 시그니처의 정적 선택을 대조하겠습니다.

## 득점 포인트

- overload와 override의 결정 시점을 예제로 분리한다.
- 선언 타입·인수 타입·실제 객체 타입의 역할을 정확히 말한다.
- static·필드·null 모호성의 예외를 놓치지 않는다.

## 감점 포인트

- 실제 인수 객체 타입으로 런타임 overload를 다시 고른다고 말한다.
- 선언 타입에 없는 하위 클래스 overload가 자동 후보라고 설명한다.
- static 메서드와 필드도 인스턴스 override처럼 동적 선택된다고 말한다.

## 더 파고들 거리

- null 리터럴에서 가장 구체적인 overload가 하나가 아닐 때 컴파일러는 어떻게 거절하나요?
- 필드 접근과 인스턴스 메서드 호출의 바인딩이 다른 이유는 무엇인가요?
- 제네릭 override에 bridge method가 생기는 조건은 무엇인가요?

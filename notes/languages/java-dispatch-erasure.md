---
id: java-dispatch-erasure
title: Java 호출 선택과 제네릭 타입 소거
topic: 언어·런타임
summary: 정적 overload·동적 override·필드 hiding을 예제로 추적하고 erased signature·bridge·reifiable 배열·외부 원소 검증을 설명합니다.
questionIds: [java-overload-override, java-field-hiding-dispatch, java-null-overload-ambiguity, java-generics-erasure, java-bridge-method-erasure, java-generic-array-reifiability]
---

# Java 호출 선택과 제네릭 타입 소거

Java 호출을 설명할 때는 컴파일 시 receiver의 정적 타입으로 고르는 overload와 실행 시 객체의 override 구현으로 연결하는 dispatch를 두 단계로 나눕니다. 제네릭은 컴파일 검사 뒤 타입 인자를 소거하므로, bridge·cast·배열의 런타임 검사가 어디에서 계약을 지키는지 같은 순서로 추적해야 합니다.

## 정적 시그니처 선택과 동적 구현 호출 단계

```java
class A {
    String label = "A";
    String f(Object value) { return "A:Object"; }
}
class B extends A {
    String label = "B";
    @Override String f(Object value) { return "B:Object"; }
    String f(String value) { return "B:String"; }
}
```

main에서 `A a = new B();`를 만든 뒤 `a.f("hi")`는 B:Object를 기대합니다. 컴파일러는 receiver의 정적 타입 A에 있는 f(Object)를 선택하고, 실행 때 실제 객체 B의 그 시그니처 구현을 호출합니다. `((B)a).f("hi")`는 정적 타입이 B라 f(String)을 선택합니다. 인수의 실제 런타임 타입으로 overload를 매번 다시 고르는 것이 아닙니다.

| 표현 | 선택 근거 | 위 예제 기대값 |
| --- | --- | --- |
| a.f("hi") | A에서 overload, B에서 override | B:Object |
| ((B)a).f("hi") | B에서 더 구체적인 overload | B:String |
| a.label | receiver 정적 타입의 필드 | A |
| ((B)a).label | cast된 정적 타입의 필드 | B |

필드는 override되지 않고 숨겨질 수 있습니다. static 메서드도 일반 인스턴스의 동적 override와 다르므로 클래스 이름으로 호출해 의도를 드러냅니다. private 메서드와 생성자도 같은 다형적 override 규칙으로 설명하지 않습니다.

## Null·변환 단계와 Overload 모호성

f(String)과 f(Integer)가 있고 `f(null)`을 호출하면 둘 다 적용 가능하지만 서로 더 구체적인 하나가 없어 컴파일 오류가 됩니다. cast로 의도를 드러낼 수 있지만 너무 많은 유사 overload가 API 사용성을 해치는지 검토합니다.

`primitive widening`·boxing·varargs는 컴파일러가 적용하는 단계가 서로 다릅니다. 예를 들어 `int` 인수에 `f(long)`과 `f(Integer)`가 모두 있으면 `int→long` widening이 `int→Integer` boxing보다 먼저 적용될 수 있으므로, 이름이 비슷한 래퍼 메서드가 자동으로 선택되는 것은 아닙니다. 반환 타입만 다른 overload는 만들 수 없고, 선택은 실행 중 객체를 보고 고르는 휴리스틱이 아니라 컴파일 단계의 규칙으로 결정됩니다.

## 제네릭 컴파일 검사와 런타임 타입 소거

일반적인 `ArrayList<String>`과 `ArrayList<Integer>`는 타입 인자마다 별도 런타임 클래스가 생기지 않고 같은 `ArrayList` 클래스의 객체입니다. 컴파일할 때 타입 변수는 소거되어 `Object` 또는 경계 타입으로 바뀌고, 예를 들어 `strings.get(0)`의 결과를 `String`으로 쓰는 지점에는 필요한 cast가 삽입됩니다.

필드·메서드 선언의 generic signature 메타데이터는 class 파일과 reflection에 남을 수 있지만, 그 선언 정보가 실제로 들어오는 모든 원소의 타입을 런타임에 검사해 주는 것은 아닙니다.

```java
java.util.List<String> strings = new java.util.ArrayList<>();
java.util.List raw = strings;
raw.add(1); // unchecked 경고, String 계약 훼손
// String s = strings.get(0); // 삽입된 cast에서 ClassCastException
```

raw 경고를 suppress한다고 런타임 검사나 안전성이 생기지 않습니다. 외부 경계에서는 List<?>의 실제 원소를 검사하고 검증된 새 컬렉션으로 옮겨 가변 별칭이 나중 잘못된 원소를 넣지 못하게 합니다.

## Bridge를 통한 소거된 부모 호출의 자식 구현 연결

```java
class Box<T> {
    void put(T value) {}
}
class TextBox extends Box<String> {
    @Override void put(String value) {}
}
```

부모 Box.put의 erased signature는 put(Object)인데 자식의 작성된 메서드는 put(String)입니다. 컴파일러는 필요한 경우 Object를 String으로 cast해 실제 구현을 호출하는 synthetic bridge를 만들어 override 관계를 유지합니다.

```diagram
{"title":"Bridge는 새 overload 추론이 아니라 기존 override 연결입니다","caption":"화살표는 소거된 부모 시그니처 호출의 경로입니다. raw 타입으로 잘못된 Object를 보내면 bridge의 cast가 실패할 수 있습니다.","rows":[[{"id":"parent","label":"Box.put(Object) 호출"}],[{"id":"bridge","label":"TextBox의 bridge","detail":["Object를 String으로 cast"]}],[{"id":"implementation","label":"TextBox.put(String) 구현"}]],"edges":[{"from":"parent","to":"bridge","label":"동적 dispatch"},{"from":"bridge","to":"implementation","label":"시그니처 연결"}]}
```

javap의 bridge·synthetic 표시와 reflection의 isBridge를 통해 작성한 overload와 구분할 수 있습니다. 메서드 스캐너가 bridge를 중복 업무 메서드로 등록하지 않는지도 확인합니다. List<String>과 List<Integer>만 다른 매개변수 overload는 둘 다 List로 소거되어 충돌할 수 있습니다.

## 배열의 Runtime 원소 타입 검사

배열의 공변성과 제네릭의 기본 불공변성을 구분합니다. `Object[] a = new String[1]`은 가능하지만 Integer를 저장하면 ArrayStoreException입니다. 배열은 실제 component type을 알아야 하므로 일반적인 `new List<String>[10]`은 허용되지 않습니다. List<String>의 구체 타입 인자는 런타임 검사에 충분히 남지 않기 때문입니다.

`new List<?>[10]`은 배열 원소가 어떤 `List`인지만 표현하고 그 안의 타입 인자는 특정하지 않는 reifiable 타입이므로 허용됩니다. `Object` 변수에 대해 `instanceof List<?>`로 List 여부는 검사할 수 있지만, `instanceof List<String>`으로는 원소 전체가 String인지 판별할 수 없어 허용되지 않습니다.

unchecked cast로 배열을 강제하면 실제 원소와 선언한 제네릭 타입이 어긋나는 heap pollution이 발생할 수 있으며, 그 cast만으로 안전성이 자동으로 복구되지는 않습니다.

List<Integer>를 List<Number>로 대입할 수 없는 이유는 Number 목록을 통해 Double을 넣으면 원래 Integer 계약이 깨지기 때문입니다. 읽기에는 `? extends Number`, Integer 쓰기에는 `? super Integer`처럼 허용 연산을 좁힐 수 있습니다. wildcard가 모든 값을 안전하게 넣는 통로는 아닙니다.

## 컴파일 거절과 실행 Cast 실패의 분리 검사

예상 결과를 구분해 기록합니다. `A a = new B(); a.f("hi")`는 `B:Object`, `((B)a).f("hi")`는 `B:String`이어야 하며, `f(null)`의 두 형제 overload는 실행 전 컴파일 오류여야 합니다. 반면 raw 목록에 넣은 `Integer`는 삽입 시점이 아니라 `String`으로 꺼내는 cast 지점에서 실패할 수 있습니다.

부모·자식 참조와 cast, null 모호성, widening·boxing·varargs를 작은 소스로 컴파일해 선택을 확인합니다. bridge는 bytecode를 검사하고 raw 입력의 실패 위치와 정상 제네릭 호출을 대조합니다. 타입 토큰을 쓰는 직렬화기도 실제 원소를 검증하는지 별도로 시험합니다.

기본 PATH의 javac는 설치 안내를 반환했지만 이후 Homebrew OpenJDK 21.0.12.1로 `scripts/VerifyJavaStudy.java`를 실행했습니다. 부모·자식 overload/override·필드 hiding·bridge 존재·raw 목록의 ClassCastException을 확인했습니다. null 모호성·generic 배열의 컴파일 거절과 javap 세부 검사는 아직 실행하지 않았습니다.

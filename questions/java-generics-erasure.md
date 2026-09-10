---
id: java-generics-erasure
title: "List<String>의 원소 타입을 실행 중에도 검사할 수 있나요? Java 제네릭의 컴파일 검사와 타입 소거가 만드는 한계를 설명해 보세요."
answerMinutes: 5
followups: [{"id":"java-annotation-retention","prompt":"reflection으로 필드의 generic signature를 읽는 것과 List 객체의 원소 타입을 검사하는 것은 왜 다른가요?"},{"id":"java-boxing-null","prompt":"raw List에서 꺼낸 null을 기본형으로 대입할 때 소거와 unboxing이 어떤 순서로 문제를 만들까요?"},{"id":"python-duck-typing","prompt":"Java의 컴파일 제네릭 계약과 Python Protocol의 구조적 계약은 외부 입력에서 어떻게 보완해야 할까요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["Java","제네릭","타입 소거","reifiable type","ClassCastException"]
related: []
---

# List<String>의 원소 타입을 실행 중에도 검사할 수 있나요? Java 제네릭의 컴파일 검사와 타입 소거가 만드는 한계를 설명해 보세요.

## 구두 답변

제네릭은 주로 컴파일 시점에 타입을 검사해 잘못된 삽입과 불필요한 형변환을 줄이는 기능입니다. 하지만 Java 제네릭은 기존 코드와의 호환성을 위해 타입 소거(type erasure)를 사용하므로 일반적인 리스트 객체 자체의 실행 타입만으로는 `List<String>`과 `List<Integer>`의 타입 인자를 구별할 수 없습니다. 다만 필드·메서드 선언의 제네릭 서명 등 일부 메타데이터는 class 파일과 reflection에 남을 수 있습니다. `List<String>`과 `List<Integer>`만 매개변수로 삼는 오버로드도 소거 뒤 둘 다 `List`가 되어 허용되지 않습니다.

### 컴파일 시 타입과 실행 시 타입

아래는 `main` 등 메서드 안에서 실행하는 설명용 코드 조각입니다.

```java
Object value = new java.util.ArrayList<String>();
System.out.println(value instanceof java.util.List<?>); // true
// value instanceof java.util.List<String>;             // 컴파일 오류

java.util.List<String> strings = new java.util.ArrayList<>();
java.util.List raw = strings;       // raw type: 경고
raw.add(1);                         // 컴파일은 되지만 타입 안전성 훼손
String s = strings.get(0);          // ClassCastException
```

실행 중 확인할 수 있는 것은 첫 번째 예처럼 `List`라는 원시 타입의 객체인지 정도입니다. `List<?>`는 특정 원소 타입을 주장하지 않는 reifiable type(실체화 가능한 타입)이어서 `instanceof`에 사용할 수 있습니다. 반면 `List<String>`은 런타임에 `String`이라는 타입 인자를 보존하지 않으므로 같은 방식의 검사가 불가능합니다. 제한된 경계가 있는 타입 변수는 소거 후 그 경계가 사용될 수 있지만, 구체적인 타입 인자가 그대로 남는다는 뜻은 아닙니다.

### 경계에서 복구하는 정보

따라서 외부 입력이나 raw 타입과의 경계에서는 가능한 한 `List<?>`로 받은 뒤 원소를 검증하고, unchecked 캐스트를 하더라도 검증한 한 지점에 격리하겠습니다. 배열처럼 `new List<String>[10]`을 직접 만들 수 없는 이유도 같은 타입 정보 불일치와 관련됩니다. `@SuppressWarnings("unchecked")`는 검사를 수행해 안전함을 증명한 뒤 범위를 좁혀 쓰는 것이지, 런타임 검사를 만들어 주는 기능이 아닙니다.

### 선택 기준과 검증

실행 시 원소 타입이 필요하면 `Class<T>`나 별도 타입 토큰을 API에 함께 전달하고, 외부 입력은 검증 후 새 컬렉션으로 격리하겠습니다. `List<?>`는 안전하게 읽되 원소를 원하는 타입으로 자동 확정하지 않습니다. raw 타입 경고를 한 곳에서 억제하는 것보다 그 경계에서 실제 원소를 검사하는 것이 heap pollution 범위를 줄입니다.

제네릭은 기본적으로 불변이므로 List<Integer>를 List<Number>에 그대로 대입할 수 없습니다. 이를 허용하면 Number 목록에 Double을 넣어 원래 Integer 목록의 계약을 깨뜨릴 수 있기 때문입니다. 읽기 위주의 입력은 ? extends Number처럼 상한을, Integer를 넣어야 하는 출력은 ? super Integer처럼 하한을 표현할 수 있습니다. 와일드카드도 아무 타입이나 안전하게 넣는 통로가 아니라 허용 연산을 제한하는 도구입니다.

Class<String>은 단일 런타임 클래스를 표현할 수 있지만 Class<List<String>> 형태의 구체 리터럴은 제공되지 않습니다. 중첩 제네릭 구조가 필요한 직렬화기는 선언의 Type이나 타입 토큰을 이용할 수 있고, 이 정보가 실제 수신 원소를 검증해 주는지는 라이브러리 계약에 달려 있습니다. 검증 후에도 원본 목록의 가변 별칭이 남으면 잘못된 값이 나중에 들어올 수 있으므로 독립된 검증 결과로 복사하는 경계를 검토하겠습니다.

## 득점 포인트

- 컴파일 타입 안전성과 런타임 소거를 구분한다.
- reifiable type·raw type·unchecked 경고의 범위를 설명한다.
- 외부 경계에서 검증한 cast를 좁게 격리한다.

## 감점 포인트

- 제네릭 타입 인자가 객체 런타임 타입에 항상 남는다고 말한다.
- List<?>가 원소가 String인지 자동 검증한다고 설명한다.
- unchecked 경고 억제가 heap pollution을 검사해 준다고 가정한다.

## 더 파고들 거리

- 제네릭 배열 생성이 금지되고 `List<?>[]` 일부가 허용되는 이유는 무엇인가요?
- 브리지 메서드는 소거된 시그니처와 override를 어떻게 연결하나요?
- 외부 직렬화 경계에서 타입 토큰과 원소 검증을 어떻게 조합할까요?

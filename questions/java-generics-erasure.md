---
id: java-generics-erasure
title: "List<String>의 원소 타입을 실행 중에도 검사할 수 있나요? Java 제네릭의 컴파일 검사와 타입 소거가 만드는 한계를 설명해 보세요."
difficulty: 중하
category: 언어·런타임
tags: ["Java","제네릭","타입 소거","reifiable type","ClassCastException"]
related: []
---

# List<String>의 원소 타입을 실행 중에도 검사할 수 있나요? Java 제네릭의 컴파일 검사와 타입 소거가 만드는 한계를 설명해 보세요.

## 구두 답변

제네릭은 주로 컴파일 시점에 타입을 검사해 잘못된 삽입과 불필요한 형변환을 줄이는 기능입니다. 하지만 Java 제네릭은 기존 코드와의 호환성을 위해 타입 소거(type erasure)를 사용하므로 일반적인 리스트 객체 자체의 실행 타입만으로는 `List<String>`과 `List<Integer>`의 타입 인자를 구별할 수 없습니다. 다만 필드·메서드 선언의 제네릭 서명 등 일부 메타데이터는 class 파일과 reflection에 남을 수 있습니다. `List<String>`과 `List<Integer>`만 매개변수로 삼는 오버로드도 소거 뒤 둘 다 `List`가 되어 허용되지 않습니다.

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

따라서 외부 입력이나 raw 타입과의 경계에서는 가능한 한 `List<?>`로 받은 뒤 원소를 검증하고, unchecked 캐스트를 하더라도 검증한 한 지점에 격리하겠습니다. 배열처럼 `new List<String>[10]`을 직접 만들 수 없는 이유도 같은 타입 정보 불일치와 관련됩니다. `@SuppressWarnings("unchecked")`는 검사를 수행해 안전함을 증명한 뒤 범위를 좁혀 쓰는 것이지, 런타임 검사를 만들어 주는 기능이 아닙니다.

## 득점 포인트

- 제네릭의 컴파일 타입 안전성과 런타임 타입 인자 소거를 구분한다.
- reifiable type인 List<?>와 검사할 수 없는 List<String>의 차이를 코드로 설명한다.
- raw type이나 unchecked cast가 나중의 원소 읽기에서 ClassCastException을 만들 수 있음을 제시한다.

## 감점 포인트

- 제네릭 타입 인자가 항상 class 파일과 런타임 객체에 그대로 저장된다고 말한다.
- List<?>도 List<String>의 원소가 String인지 실행 중 확인해 준다고 설명한다.
- unchecked 경고를 억제하면 잘못된 원소 삽입 자체가 검증된다고 가정한다.

## 더 파고들 거리

- 제네릭 배열 생성이 금지되고 List<?>[] 일부가 허용되는 이유를 설명해 보세요.
- 제네릭 메서드의 타입 추론과 소거 후 브리지 메서드는 어떤 관계인가요?
- 외부 API 경계에서 와일드카드·검증·복사로 heap pollution을 어떻게 차단하나요?

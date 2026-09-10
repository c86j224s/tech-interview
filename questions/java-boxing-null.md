---
id: java-boxing-null
title: "Integer 비교가 작은 수에서는 맞아 보이는데 null에서는 예외가 납니다. boxing·unboxing과 ==의 비교 대상을 구분해 보세요."
difficulty: 하
category: 언어·런타임
tags: ["Java","autoboxing","unboxing","Integer","null"]
related: ["java-equals-hashcode"]
---

# Integer 비교가 작은 수에서는 맞아 보이는데 null에서는 예외가 납니다. boxing·unboxing과 ==의 비교 대상을 구분해 보세요.

## 구두 답변

autoboxing은 `int` 같은 기본형 값을 `Integer` 같은 래퍼 객체로 자동 변환하는 것이고, unboxing은 그 반대입니다. `Integer`와 `Integer`를 `==`로 비교하면 숫자 값이 아니라 두 참조의 동일성을 비교합니다. 다만 상수 표현식으로 boxing된 일부 값은 Java 언어 명세가 같은 참조를 보장하므로 작은 수에서 값 비교처럼 보일 수 있습니다. 이는 모든 정수와 모든 실행 상황에 대한 일반적인 숫자 비교 규칙이 아닙니다.

아래는 `main` 등 메서드 안에서 실행하는 설명용 코드 조각입니다.

```java
Integer a = 127;
Integer b = 127;
System.out.println(a == b);       // true: 이 상수 표현식 값은 동일 참조가 보장됨

Integer n = null;
System.out.println(n == null);     // true: 참조 비교
System.out.println(n == 0);        // NullPointerException: n을 int로 unboxing
```

`n == 0`에서는 한쪽이 `int`이므로 컴파일러가 `n`을 `int`로 바꾸려 합니다. null 참조에는 꺼낼 기본값이 없기 때문에 실행 중 `NullPointerException`이 발생합니다. 반대로 `Integer`끼리 `==`를 사용하면 캐시나 구현이 우연히 같은 참조를 돌려주는지에 따라 결과가 달라질 수 있으므로, 숫자 값의 동등성은 `a.equals(b)`를 쓰고 null 가능성이 있으면 `Objects.equals(a, b)`를 사용하겠습니다. 기본형 비교가 가능하면 애초에 기본형을 쓰는 것도 불필요한 boxing을 줄이는 선택입니다.

래퍼 타입은 컬렉션의 타입 인자나 ‘값이 없음’을 표현해야 할 때 필요하지만, 산술식에 섞이면 자동 변환과 예외 지점을 숨길 수 있습니다. 특히 `Integer`를 Map 값이나 요청 입력으로 받을 때 null 정책을 먼저 정하고, 기본값으로 대체할지 입력 오류로 거절할지 명시해야 합니다. ‘-128부터 127은 항상 객체 캐시라서 모든 경우 안전하다’ 또는 ‘128 이상은 반드시 다른 객체다’라는 식의 설명은 피해야 합니다.

## 득점 포인트

- Integer 간 ==는 참조 비교이고 Integer와 int의 ==는 unboxing 뒤 값 비교라는 차이를 설명한다.
- 상수 boxing의 제한된 동일성 보장과 일반적인 equals 사용 원칙을 구분한다.
- null unboxing이 NullPointerException을 일으키는 정확한 변환 경로를 제시한다.

## 감점 포인트

- Integer끼리 ==가 항상 숫자 값을 비교한다고 말한다.
- 모든 실행 환경에서 127 이하만 캐시되고 그 밖의 값은 반드시 새 객체라고 단정한다.
- null을 0으로 자동 변환해 비교한다고 설명한다.

## 더 파고들 거리

- 컴파일러의 이항 숫자 승격과 boxing 변환 순서가 복합식에서 어떻게 작동하나요?
- Optional과 nullable 래퍼, 기본값 대체 중 어떤 표현이 API 의미를 더 정확히 전달하나요?
- 성능 측정에서 반복 boxing이 할당과 GC에 미치는 영향을 어떻게 확인하나요?

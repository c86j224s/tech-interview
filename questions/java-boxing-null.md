---
id: java-boxing-null
title: "Integer 비교가 작은 수에서는 맞아 보이는데 null에서는 예외가 납니다. boxing·unboxing과 ==의 비교 대상을 구분해 보세요."
answerMinutes: 5
followups: [{"id":"java-equals-hashcode","prompt":"Integer를 HashMap 키로 쓸 때 ==가 아니라 equals·hashCode 계약이 적용되는 이유는 무엇인가요?"},{"id":"java-generics-erasure","prompt":"List<Integer>에서 null 원소를 읽어 unboxing하는 시점에 어떤 예외 경로가 생길까요?"},{"id":"java-final-immutability","prompt":"래퍼 객체와 불변 객체를 공유할 때 final이 값 변경을 막는 범위를 어떻게 설명할까요?"}]
difficulty: 하
category: 언어·런타임
tags: ["Java","autoboxing","unboxing","Integer","null"]
related: ["java-equals-hashcode"]
---

# Integer 비교가 작은 수에서는 맞아 보이는데 null에서는 예외가 납니다. boxing·unboxing과 ==의 비교 대상을 구분해 보세요.

## 구두 답변

autoboxing은 `int` 같은 기본형 값을 `Integer` 같은 래퍼 객체로 자동 변환하는 것이고, unboxing은 그 반대입니다. `Integer`와 `Integer`를 `==`로 비교하면 숫자 값이 아니라 두 참조의 동일성을 비교합니다. 다만 상수 표현식으로 boxing된 일부 값은 Java 언어 명세가 같은 참조를 보장하므로 작은 수에서 값 비교처럼 보일 수 있습니다. 이는 모든 정수와 모든 실행 상황에 대한 일반적인 숫자 비교 규칙이 아닙니다.

### 비교식에 숨어 있는 변환

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

### null과 값 정책

래퍼 타입은 컬렉션의 타입 인자나 ‘값이 없음’을 표현해야 할 때 필요하지만, 산술식에 섞이면 자동 변환과 예외 지점을 숨길 수 있습니다. 특히 `Integer`를 Map 값이나 요청 입력으로 받을 때 null 정책을 먼저 정하고, 기본값으로 대체할지 입력 오류로 거절할지 명시해야 합니다. ‘-128부터 127은 항상 객체 캐시라서 모든 경우 안전하다’ 또는 ‘128 이상은 반드시 다른 객체다’라는 식의 설명은 피해야 합니다.

### 선택 기준과 검증

메서드 인자와 산술식을 섞으면 변환 지점이 더 숨습니다. `map.get(key) + 1`은 반환된 `Integer`가 null인지 확인하기 전에 unboxing될 수 있으므로, 먼저 부재 정책을 적용한 뒤 기본형으로 옮기겠습니다. `Objects.equals`는 null 안전 비교일 뿐 기본값·범위·문자열 파싱을 정하지 않으며, 특정 JVM의 캐시 범위도 API 계약으로 사용하지 않겠습니다.

서로 다른 숫자 래퍼의 equals는 수학적 값만 비교하는 범용 연산이 아닙니다. Integer.valueOf(1)과 Long.valueOf(1)의 equals는 false이므로 입력 타입을 정규화하지 않고 Objects.equals만 적용해도 원하던 숫자 비교가 되지 않을 수 있습니다. null 안전성, 참조 동일성, 숫자 타입 통일을 각각 처리해야 합니다.

조건 연산자와 오버로딩에도 boxing·unboxing이 관여할 수 있습니다. 한 분기는 Integer, 다른 분기는 int인 식에서 null이 예상치 못하게 unboxing되는지 컴파일 타입을 확인하겠습니다. 값이 없음을 허용하지 않는 카운터는 기본형으로 두고, 입력 부재는 nullable 래퍼나 별도 결과 타입으로 표현하는 편이 명확합니다. 성능에서는 반복 합산을 래퍼 변수로 하면 객체 생성과 참조 교체가 생길 수 있으므로 실제 할당 프로파일로 비교하겠습니다.

## 득점 포인트

- 래퍼 간 참조 비교와 기본형 unboxing을 구분한다.
- null·캐시·equals를 입력 검증 정책과 연결한다.
- 언어 보장과 특정 JVM 캐시 구현을 분리한다.

## 감점 포인트

- Integer 간 ==가 항상 숫자 값 비교라고 말한다.
- 모든 JVM에서 캐시 범위를 고정된 구현 계약으로 사용한다.
- null이 비교 때 0으로 자동 대체된다고 설명한다.

## 더 파고들 거리

- 복합 산술식의 binary numeric promotion과 unboxing 순서를 어떻게 추적할까요?
- Optional·nullable 래퍼·기본값 중 부재 의미를 가장 잘 표현하는 것은 무엇인가요?
- 반복 boxing이 할당과 GC에 미치는 비용을 어떤 benchmark로 측정할까요?

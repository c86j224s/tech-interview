---
id: java-annotation-retention
title: "어노테이션을 붙였는데 런타임 reflection에서 보이지 않습니다. SOURCE·CLASS·RUNTIME 보존과 실제 처리자의 차이는 무엇인가요?"
answerMinutes: 5
followups: [{"id":"java-generics-erasure","prompt":"필드 선언의 generic signature를 reflection으로 읽는 것과 List 객체의 원소 타입을 검사하는 것은 왜 다른가요?"},{"id":"java-overload-override","prompt":"annotation processor가 생성한 메서드의 overload와 런타임 override를 검증할 때 어느 단계의 타입을 보나요?"},{"id":"jvm-bytecode-jit","prompt":"reflection 기반 어노테이션 스캔과 생성 코드 방식의 시작 비용을 JVM 예열과 함께 어떻게 측정할까요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["Java","어노테이션","Retention","reflection","annotation processor"]
related: ["java-overload-override"]
---

# 어노테이션을 붙였는데 런타임 reflection에서 보이지 않습니다. SOURCE·CLASS·RUNTIME 보존과 실제 처리자의 차이는 무엇인가요?

## 구두 답변

어노테이션은 코드에 의미를 덧붙이는 메타데이터이고, `@Retention`은 그 메타데이터를 어디까지 보존할지를 정합니다. `SOURCE`는 소스에서만 존재하고 class 파일에 보존되지 않으며, `CLASS`는 바이너리에 남지만 런타임 reflection으로 제공된다는 보장이 없습니다. `RUNTIME`은 바이너리에 보존되고 Java reflection API가 실행 중 읽을 수 있도록 해야 합니다. `@Retention`을 생략하면 기본 정책은 `CLASS`입니다. `@Target`은 어디에 붙일 수 있는지를 정하고 Retention과는 별개의 설정입니다.

### 어디까지 보존할 것인가

아래는 설명용 코드 조각입니다. import와 타입 선언은 파일 수준에 두고, 출력문은 `main` 등 메서드 안에서 실행합니다.

```java
import java.lang.annotation.*;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@interface Marker {}

@Marker
class Service {}

System.out.println(
    Service.class.isAnnotationPresent(Marker.class)
); // true
```

반대로 `SOURCE` 어노테이션을 선언해도 컴파일러가 자동으로 특정 기능을 실행하는 것은 아닙니다. annotation processor는 컴파일 과정에서 소스 요소를 읽어 진단이나 코드 생성을 수행하는 별도 처리자이며, `SOURCE` 메타데이터도 처리할 수 있습니다. 런타임 reflection은 실행 중 class 파일에 남은 `RUNTIME` 어노테이션을 읽는 소비자입니다. 같은 어노테이션을 processor와 reflection이 각각 사용하려면 보존 정책과 처리 등록, 실행 시점의 계약을 따로 설계해야 합니다.

### 처리자와 reflection

지역 변수 선언 자체에 붙는 어노테이션은 `RUNTIME`이어도 바이너리 표현에 보존되지 않는 예외가 있습니다. 이는 변수의 타입 사용 위치에 붙는 `TYPE_USE` 어노테이션과 구분해야 합니다. 타입 사용 어노테이션은 class 파일에 남을 수 있지만, 메서드 내부의 모든 위치를 일반 reflection으로 조회할 수 있다는 뜻은 아닙니다. 실무에서는 먼저 `@Target`으로 적용 범위를 제한하고, 컴파일 시 코드 생성인지 실행 시 reflection인지 소비자를 정한 뒤 필요한 Retention만 선택하겠습니다. reflection이 필요한데 `CLASS`를 사용하면 보이지 않는 것이 정상이고, `RUNTIME`으로 바꿔도 processor 등록 없이 코드가 생성되지는 않습니다.

### 선택 기준과 검증

`RUNTIME`이어도 프레임워크 스캔 대상, 클래스 로더, 모듈 접근 권한이 맞지 않으면 애플리케이션에서 발견되지 않을 수 있습니다. 반대로 processor가 컴파일 시 코드를 생성하면 실행 중 reflection을 줄일 수 있지만 증분 빌드와 생성 산출물 추적이 필요합니다. Java 17/21에서 `javap`, reflection, processor 로그를 따로 확인해 정보가 어느 단계에서 사라졌는지 검증하겠습니다.

같은 이름의 어노테이션 클래스라도 서로 다른 클래스 로더에서 로드하면 같은 타입으로 취급되지 않을 수 있습니다. 일반 reflection에서 직접 읽히는지와 프레임워크가 스캔해서 등록했는지를 나눠 보면, 보존 정책 문제인지 클래스 경로·스캔 범위 문제인지 좁힐 수 있습니다. 모듈 접근 제한은 깊은 reflection의 허용 범위와 관련되므로 어노테이션의 존재 자체와도 분리해야 합니다.

Repeatable 어노테이션은 반복 사용을 컨테이너로 표현할 수 있습니다. getAnnotation으로 하나만 찾는 코드와 getAnnotationsByType으로 반복 요소를 찾는 코드의 결과가 다를 수 있어 조회 API를 확인하겠습니다. @Inherited는 모든 멤버나 인터페이스의 어노테이션을 자동 전파하는 기능이 아니라 클래스 어노테이션의 상속에 한정된 계약입니다. 테스트에서는 직접 선언·상위 클래스·인터페이스·반복 선언을 구분해 실제 소비자가 찾는 범위를 고정하겠습니다.

## 득점 포인트

- SOURCE·CLASS·RUNTIME과 소비 시점을 정확히 나눈다.
- processor와 reflection의 처리 등록·조회 계약을 구분한다.
- Target·지역 변수·repeatable 예외를 적용 위치와 함께 본다.

## 감점 포인트

- 어노테이션 이름만으로 JVM이나 컴파일러가 기능을 실행한다고 말한다.
- CLASS 보존이면 일반 reflection에서 항상 보인다고 단정한다.
- Target과 Retention의 역할을 뒤바꾸거나 지역 변수 예외를 무시한다.

## 더 파고들 거리

- Repeatable 어노테이션에서 컨테이너와 반복 요소의 Retention 조건은 무엇인가요?
- annotation processor의 증분 빌드 산출물이 stale해지지 않게 무엇을 추적할까요?
- 모듈 경계에서 reflection 접근이 막힐 때 보존과 접근 권한을 어떻게 나눌까요?

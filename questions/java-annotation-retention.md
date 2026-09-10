---
id: java-annotation-retention
title: "어노테이션을 붙였는데 런타임 reflection에서 보이지 않습니다. SOURCE·CLASS·RUNTIME 보존과 실제 처리자의 차이는 무엇인가요?"
difficulty: 중하
category: 언어·런타임
tags: ["Java","어노테이션","Retention","reflection","annotation processor"]
related: ["java-overload-override"]
---

# 어노테이션을 붙였는데 런타임 reflection에서 보이지 않습니다. SOURCE·CLASS·RUNTIME 보존과 실제 처리자의 차이는 무엇인가요?

## 구두 답변

어노테이션은 코드에 의미를 덧붙이는 메타데이터이고, `@Retention`은 그 메타데이터를 어디까지 보존할지를 정합니다. `SOURCE`는 소스에서만 존재하고 class 파일에 보존되지 않으며, `CLASS`는 바이너리에 남지만 런타임 reflection으로 제공된다는 보장이 없습니다. `RUNTIME`은 바이너리에 보존되고 Java reflection API가 실행 중 읽을 수 있도록 해야 합니다. `@Retention`을 생략하면 기본 정책은 `CLASS`입니다. `@Target`은 어디에 붙일 수 있는지를 정하고 Retention과는 별개의 설정입니다.

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

지역 변수 선언 자체에 붙는 어노테이션은 `RUNTIME`이어도 바이너리 표현에 보존되지 않는 예외가 있습니다. 이는 변수의 타입 사용 위치에 붙는 `TYPE_USE` 어노테이션과 구분해야 합니다. 타입 사용 어노테이션은 class 파일에 남을 수 있지만, 메서드 내부의 모든 위치를 일반 reflection으로 조회할 수 있다는 뜻은 아닙니다. 실무에서는 먼저 `@Target`으로 적용 범위를 제한하고, 컴파일 시 코드 생성인지 실행 시 reflection인지 소비자를 정한 뒤 필요한 Retention만 선택하겠습니다. reflection이 필요한데 `CLASS`를 사용하면 보이지 않는 것이 정상이고, `RUNTIME`으로 바꿔도 processor 등록 없이 코드가 생성되지는 않습니다.

## 득점 포인트

- SOURCE·CLASS·RUNTIME의 보존 범위와 reflection 가용성 차이를 정확히 설명한다.
- annotation processor와 런타임 reflection이 별도의 소비자·시점임을 구분한다.
- @Target과 Retention을 나누고 지역 변수 선언 같은 보존 예외까지 확인한다.

## 감점 포인트

- 어노테이션 이름만 선언하면 JVM이나 컴파일러가 처리 코드를 자동 실행한다고 말한다.
- CLASS 어노테이션은 항상 reflection으로 조회할 수 있다고 단정한다.
- @Target이 보존 시점을 정하고 @Retention이 적용 위치를 정한다고 뒤바꿔 설명한다.

## 더 파고들 거리

- Repeatable 어노테이션과 컨테이너의 보존 정책은 어떤 적합성 조건을 가지나요?
- 컴파일러 내장 어노테이션·사용자 annotation processor·reflection 코드의 책임을 비교해 보세요.
- RUNTIME reflection 비용과 명시적 코드 생성 방식의 배포·디버깅 trade-off는 무엇인가요?

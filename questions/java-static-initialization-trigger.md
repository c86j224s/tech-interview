---
id: java-static-initialization-trigger
title: static final 상수를 읽는 경우와 static 메서드를 호출하는 경우 클래스 초기화 시점은 어떻게 다른가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Java
  - 클래스 초기화
  - 상수 변수
related:
  - java-gc-reachability
---
# static final 상수를 읽는 경우와 static 메서드를 호출하는 경우 클래스 초기화 시점은 어떻게 다른가요?

## 구두 답변

`static final`이라는 수식어만으로는 초기화 시점을 정할 수 없습니다. JLS의 constant variable 조건을 만족하는 `static final int LIMIT = 8;` 같은 필드는 사용 코드에 값이 인라인될 수 있어, 다른 클래스가 `Flags.LIMIT`를 읽는 것만으로 `Flags`의 `<clinit>`가 실행되지 않을 수 있습니다. 반면 `static final Integer BOXED = 8`은 같은 숫자라도 constant variable로 취급되지 않으므로 실제 필드 값을 읽는 active use가 초기화를 요구합니다. `Flags.value()`처럼 static 메서드를 호출하는 경로도 호출 대상 클래스 초기화가 선행되어야 합니다.

예를 들어 static block에 `System.out.println("init")`를 넣었을 때 `int x = Flags.LIMIT;`에서 그 로그가 반드시 찍힌다고 기대하면 안 됩니다. `Integer y = Flags.BOXED;` 또는 `int z = Flags.value();`에서는 필드 값과 메서드 본문이 필요하므로 초기화 절차가 진행될 수 있습니다. `final`은 재대입 제한이고, constant variable은 타입과 컴파일 타임 상수 표현까지 포함하는 별도 조건입니다.

실제 판단은 필드 선언, initializer 표현식, 호출 종류, 클래스 로더를 함께 봅니다. 배열 타입 참조와 원소 타입 초기화도 분리해야 하고, `Class.forName`처럼 초기화를 요청하는 API 오버로드인지 확인해야 합니다. 근거는 JLS 21 규칙이며, 특정 JVM 로그를 규범 그 자체로 일반화하지 않겠습니다.

## 득점 포인트

- `final` 여부가 아니라 constant variable 조건과 값 인라인 가능성을 기준으로 상수 읽기와 일반 필드 읽기를 구분합니다.
- static 메서드 호출이 `<clinit>` 실행 전제의 active use라는 점과, 초기화 block의 부수 효과를 상수 읽기에 기대할 수 없다는 실무 결과를 연결합니다.

## 감점 포인트

- 모든 `static final` 필드가 컴파일 타임 상수라서 초기화를 건너뛴다고 말하면 안 됩니다.
- 클래스를 소스에서 언급하거나 배열 타입을 썼다는 이유만으로 항상 모든 static initializer가 실행된다고 단정하면 안 됩니다.

## 더 파고들 거리

- `javap -c`로 상수 필드 사용이 `getstatic`인지 literal인지 확인하면 초기화 차이를 어떻게 입증할 수 있을까요?
- 라이브러리의 상수 값을 변경했을 때 클라이언트 재컴파일 전까지 인라인된 값이 남는 배포 위험을 어떻게 관리할까요?

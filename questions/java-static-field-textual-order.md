---
id: java-static-field-textual-order
title: static 필드 초기화가 다른 필드의 기본값을 읽습니다. 선언 순서와 메서드 호출 우회를 어떻게 설명하나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Java
  - static initializer
  - 초기화 순서
related:
  - java-gc-reachability
---
# static 필드 초기화가 다른 필드의 기본값을 읽습니다. 선언 순서와 메서드 호출 우회를 어떻게 설명하나요?

## 구두 답변

클래스 초기화는 정적 저장 공간을 기본값으로 준비한 뒤, static field initializer와 static block을 소스에 나타난 텍스트 순서대로 실행합니다. 따라서 `int`는 처음 0이고, 명시적 대입 전에는 아래에 선언된 필드도 저장 공간 자체는 존재합니다.

```java
final class Indirect {
    static int value = read();
    static int source = 42;
    static int read() { return source; }
}
```

`value` initializer가 먼저 `read()`를 호출하므로 그 시점의 `source`는 아직 42로 대입되지 않은 기본값 0입니다. 이후 `source=42`가 실행되어도 `value`에는 이미 0이 저장됩니다. 반면 같은 클래스의 단순 이름으로 앞선 선언이 뒤의 필드를 읽는 표현은 forward-reference 컴파일 규칙 때문에 거부될 수 있습니다. 메서드 호출로 간접화되어 컴파일된다는 사실은 초기화된 값을 읽는다는 뜻이 아니며, 호출 시점의 기본값을 볼 수 있습니다.

판단은 선언 순서, static block 위치, 호출 메서드가 읽는 필드, 다른 클래스 active use를 한 줄 trace로 펼쳐야 합니다. 순서 의존을 줄이려면 서로 의존하는 값을 한 initializer에서 계산하거나 명시적 bootstrap 결과로 게시하고, 테스트는 클래스 초기화가 이미 일어나지 않은 별도 JVM 또는 격리된 class loader에서 시작하겠습니다.

## 득점 포인트

- 기본값 준비와 텍스트 순서 대입을 구분하여 `source`가 0에서 42로 바뀌는 중간 상태를 설명합니다.
- 직접 forward reference의 컴파일 제한과 메서드 호출을 통한 간접 읽기의 런타임 기본값 관찰을 서로 다른 문제로 구분합니다.

## 감점 포인트

- 선언 아래에 있는 필드는 초기화 전에는 존재하지 않는다고 설명하면 안 됩니다.
- 메서드 호출로 코드를 컴파일할 수 있다는 사실을 대입 완료의 증거로 사용하면 안 됩니다.

## 더 파고들 거리

- static field initializer와 static block을 섞은 클래스에서 텍스트 순서별 값 trace를 작성하면 어떤 순서가 안전하지 않은지 확인해 보세요.
- 이미 초기화된 클래스를 재사용하지 않도록 테스트를 새 JVM 또는 class loader로 격리해야 하는 이유를 설명해 보세요.

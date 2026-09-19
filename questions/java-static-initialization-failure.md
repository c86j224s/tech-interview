---
id: java-static-initialization-failure
title: static initializer가 처음 실패한 뒤 같은 클래스에 다시 접근하면 왜 다른 예외가 나올 수 있나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Java
  - ExceptionInInitializerError
  - NoClassDefFoundError
related:
  - java-gc-reachability
---
# static initializer가 처음 실패한 뒤 같은 클래스에 다시 접근하면 왜 다른 예외가 나올 수 있나요?

## 구두 답변

첫 접근과 두 번째 접근은 클래스의 초기화 상태가 다르기 때문에 예외 모양이 달라집니다. 첫 active use에서 `<clinit>`가 실행되다가 값 `E`를 던지면 클래스 초기화는 완료되지 않고 erroneous 상태가 됩니다. JLS 12.4.2의 조건을 정확히 말하면 `E`가 `Error`이면 그 Error를 그대로 전파하고, Error가 아닌 Throwable이면 `ExceptionInInitializerError`로 감쌉니다. 따라서 모든 실패가 자동으로 `ExceptionInInitializerError`가 된다고 답하면 틀립니다.

그 뒤 같은 클래스에 다시 active use가 들어오면 `<clinit>`를 처음부터 재시도하지 않습니다. 이미 erroneous 상태인 클래스를 사용하려 하므로 보통 `NoClassDefFoundError`가 관찰되고 최초 초기화 실패 정보가 cause에 연결될 수 있습니다. 이 이름을 단순한 class 파일 누락으로만 해석하면 정적 initializer의 원인을 놓치게 됩니다.

```java
final class Broken {
    static final int value = Integer.parseInt("not-a-number");
    static int get() { return value; }
}
// 같은 JVM에서 첫 Broken.get()과 두 번째 호출의 Throwable 타입·cause를 각각 기록
```

테스트는 클래스가 이미 초기화되지 않은 새 JVM 또는 격리된 class loader에서 시작해야 합니다. 실행 횟수, 실제 Throwable 타입, `getCause()`를 함께 기록하고, 초기화 실패를 재시도해야 한다면 static initializer가 아니라 명시적 bootstrap 상태로 옮기겠습니다.

## 득점 포인트

- 첫 실패에서 Error는 그대로 전파되고 비-Error Throwable만 `ExceptionInInitializerError`로 래핑된다는 조건을 정확히 구분합니다.
- 클래스가 erroneous 상태에 들어간 뒤 재초기화되지 않으며 후속 active use에서 `NoClassDefFoundError`가 나타날 수 있다는 상태 전이를 설명합니다.

## 감점 포인트

- 첫 실패는 항상 `ExceptionInInitializerError`, 두 번째 오류는 항상 class 파일이 없다는 뜻이라고 단정하면 안 됩니다.
- 같은 JVM에서 다른 테스트가 먼저 클래스를 사용한 상태를 무시하고 첫 실패를 재현했다고 주장하면 안 됩니다.

## 더 파고들 거리

- Error, RuntimeException, checked 예외를 initializer에서 각각 던져 첫 관찰 타입과 cause 체인이 어떻게 달라지는지 테스트 격리로 비교해 보세요.
- 재시도 가능한 설정 로딩을 명시적 `Uninitialized/Ready/Failed` 상태로 설계하면 클래스 오류 상태와 어떤 차이가 생길까요?

---
id: java-resource-effectively-final
title: 이미 만든 자원을 try-with-resources에 넣을 때 effectively final이 필요한 이유는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Java
  - effectively final
  - AutoCloseable
related:
  - java-gc-reachability
  - java-completablefuture-executor
---
# 이미 만든 자원을 try-with-resources에 넣을 때 effectively final이 필요한 이유는 무엇인가요?

## 구두 답변

기존 변수를 자원 목록에 쓰는 문법은 Java SE 21에서 final 또는 effectively final이고 definitely assigned인 변수만 허용합니다. 흔히 “사용한 객체와 종료 때 닫을 객체를 같은 변수 이름으로 안정적으로 연결하려는 제한”이라고 설명하지만, 더 정확한 실행 모델은 자원 목록 진입 시점의 값을 fresh local resource variable에 캡처하고 그 캡처된 값을 close한다는 것입니다.

```java
var input = Files.newInputStream(path);
try (input) {
    read(input);
}
```

여기서 새 스트림 소유권이나 핸들이 복사되는 것은 아닙니다. `input`이 가리키던 같은 객체의 참조 값이 자원 변수로 캡처되고, 블록 종료 때 그 객체의 `close()`가 호출됩니다. 변수에 재대입이 있었다면 기존 변수 표현식은 문법 계약을 만족하지 못합니다. Java 9부터 이 existing-variable 형식을 사용하려면 소스·컴파일러 호환성도 확인해야 하지만, 현재 JLS 21 규칙의 핵심은 final/effectively final과 값 캡처입니다.

다른 별칭이 같은 객체를 가리키면 close 뒤에 닫힌 스트림을 사용할 수 있고, caller와 callee가 모두 close하면 이중 종료 문제가 생길 수 있습니다. effectively final은 close 대상의 캡처 안정성을 표현할 뿐 소유권, 별칭, rollback을 자동 해결하지 않습니다. API 문서에 누가 자원을 닫는지 명시하고 실제 close 호출 횟수를 테스트하겠습니다.

## 득점 포인트

- existing-variable 자원은 definitely assigned이며 final 또는 effectively final이어야 하고, 자원 목록 시점의 값을 fresh local resource variable로 캡처해 닫는다고 설명합니다.
- 같은 객체의 참조 값을 닫는 것이지 새 소유자를 만드는 것이 아니며, 별칭과 caller/callee 소유권은 별도 계약이라고 구분합니다.

## 감점 포인트

- 컴파일러가 블록 안의 재대입된 변수에서 마지막 객체를 자동으로 닫는다고 말하면 안 됩니다.
- effectively final만 만족하면 double close, 별칭 사용, 외부 rollback까지 해결된다고 확대하면 안 됩니다.

## 더 파고들 거리

- Java 9 이후 문법과 이전 `try (Resource r = input)` 패턴의 소스 호환성을 `--release`별로 어떻게 검증할까요?
- 캡처된 객체와 다른 별칭을 블록 뒤에서 사용하는 코드가 닫힌 자원 접근을 만드는지 어떤 테스트로 확인할까요?

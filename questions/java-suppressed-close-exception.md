---
id: java-suppressed-close-exception
title: try 본문과 close가 모두 예외를 던지면 호출자는 어느 예외를 받고 나머지는 어디에서 찾나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Java
  - try-with-resources
  - suppressed exception
related:
  - java-gc-reachability
  - java-completablefuture-executor
---
# try 본문과 close가 모두 예외를 던지면 호출자는 어느 예외를 받고 나머지는 어디에서 찾나요?

## 구두 답변

본문에서 예외가 발생하고 자원 `close()`도 예외를 던지면 본문 예외가 primary로 호출자에게 전달되고, close 예외는 `primary.getSuppressed()`에 추가됩니다. 한 자원에서 다음과 같은 흐름을 예상할 수 있습니다.

```java
try (var r = new FailingResource("r")) {
    throw new Exception("body");
} catch (Exception e) {
    // e.getMessage() = "body"
    // e.getSuppressed()[0].getMessage() = "close r"
}
```

자원이 `r1`, `r2`라면 성공한 생성 순서의 역순으로 `r2.close()` 후 `r1.close()`가 호출됩니다. 본문이 실패한 상태에서 두 close도 실패하면 primary는 본문 예외이고 suppressed에는 실제 close 호출 순서의 실패가 쌓입니다. 본문이 정상이라면 반대로 첫 close 실패가 primary이고 이후 close 실패가 suppressed가 됩니다. 따라서 선언 순서만 외우지 말고 본문 결과와 close 호출 trace를 함께 봐야 합니다.

다만 일반적인 서로 다른 `Throwable`과 suppression 허용 상태라는 전제가 있습니다. suppression이 비활성화된 예외는 추가된 항목을 저장하지 않을 수 있고, 같은 인스턴스를 자기 자신에게 suppressed로 넣으면 `IllegalArgumentException`이 발생할 수 있습니다. try-with-resources는 핸들 반납과 예외 보존을 제공하지만 외부 DB 변경의 rollback까지 만들어 주지는 않으므로 보상 상태는 별도 설계하겠습니다.

## 득점 포인트

- 본문 예외를 primary로 유지하고 close 실패를 `getSuppressed()`에서 찾는 예외 우선순위를 구체 메시지와 함께 설명합니다.
- 여러 자원에서 역순 close, 정상 본문일 때의 primary 전환, suppression API의 일반 경로 전제를 구분합니다.

## 감점 포인트

- close 예외가 본문 예외를 항상 덮어쓴다고 말하거나 suppressed 배열을 보지 않으면 안 됩니다.
- 모든 예외가 반드시 suppressed 배열에 들어간다고 단정하여 suppression 비활성화와 self-suppression 경계를 빼면 안 됩니다.

## 더 파고들 거리

- 본문 성공/실패와 각 close 성공/실패를 조합한 시험표에서 primary와 suppressed 순서를 어떻게 검증할까요?
- 내부 로그에 suppressed를 보존하면서 사용자 응답에 stack trace를 노출하지 않는 관측 설계를 만들어 보세요.

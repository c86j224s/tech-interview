---
id: java-resource-close-no-body-error
title: 본문은 성공했지만 두 자원의 close가 모두 실패했습니다. 대표 예외와 suppressed 순서는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Java
  - suppressed exception
  - close 순서
related:
  - java-gc-reachability
  - java-completablefuture-executor
---
# 본문은 성공했지만 두 자원의 close가 모두 실패했습니다. 대표 예외와 suppressed 순서는 무엇인가요?

## 구두 답변

본문이 정상적으로 완료되면 close 단계의 첫 실패가 primary가 됩니다. `r1`을 먼저 선언하고 `r2`를 나중에 선언하면 close 호출 순서는 `r2.close()` → `r1.close()`이므로, 둘 다 실패하는 일반적인 경우 `close r2` 예외가 호출자에게 전달되고 `close r1` 예외가 `primary.getSuppressed()[0]`이 됩니다.

```java
try (var r1 = new FailingResource("r1");
     var r2 = new FailingResource("r2")) {
    // 본문 성공
} catch (Exception e) {
    // primary: close r2
    // suppressed[0]: close r1
}
```

이 결과는 선언 순서가 아니라 실제 역순 close와 첫 실패 선택을 따른 것입니다. 한 close가 실패해도 이미 성공적으로 생성된 다른 자원의 close를 계속 시도하므로 두 번째 실패를 suppressed로 보존합니다. 다만 일반적인 서로 다른 예외 인스턴스이며 suppression이 허용된다는 전제가 있습니다. `Throwable`이 suppression을 비활성화했거나 primary와 같은 인스턴스를 다시 추가하면 suppressed 배열이 기대와 달라지거나 self-suppression의 `IllegalArgumentException`이 발생할 수 있습니다.

따라서 테스트는 예외 메시지를 `close r1`, `close r2`로 고정하여 primary 타입·메시지, suppressed 길이·순서를 확인해야 합니다. 운영에서는 suppressed까지 내부 관측에 남기되, try-with-resources가 외부 DB 변경을 rollback하거나 자원 API의 이중 close 정책을 대신 결정하지는 않는다는 한계를 분리해 기록하겠습니다.

## 득점 포인트

- 본문 성공 후 역순 close에서 `r2` 실패가 primary이고 `r1` 실패가 suppressed가 되는 중간 호출 순서를 정확히 제시합니다.
- suppression 비활성화와 self-suppression 예외를 일반 경로의 조건부 한계로 덧붙여 “항상 배열에 저장”이라는 과장을 피합니다.

## 감점 포인트

- 첫 선언 자원인 `r1`이 항상 대표 예외가 된다고 말하면 안 됩니다.
- close 실패 하나가 발생하면 나머지 자원 close가 무조건 생략된다고 설명하면 안 됩니다.

## 더 파고들 거리

- 예외 인스턴스를 서로 다르게 생성한 경우와 같은 인스턴스를 재사용한 경우 `getSuppressed()` 결과가 어떻게 달라지는지 API 테스트로 확인해 보세요.
- suppressed stack trace를 내부 로그에는 보존하면서 외부 오류에는 안전한 요약만 내보내는 관측 정책을 설계해 보세요.

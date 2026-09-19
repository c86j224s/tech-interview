---
id: java-resource-close-reverse-order
title: 여러 자원을 선언한 try-with-resources는 어떤 순서로 닫으며 중간 생성 실패는 어떻게 정리하나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Java
  - 자원 수명
  - close 순서
related:
  - java-gc-reachability
  - java-completablefuture-executor
---
# 여러 자원을 선언한 try-with-resources는 어떤 순서로 닫으며 중간 생성 실패는 어떻게 정리하나요?

## 구두 답변

자원은 성공적으로 초기화된 순서의 역순으로 닫습니다. `r1` 생성 성공 뒤 `r2` 생성 성공이면 본문이 정상 종료하거나 예외로 끝날 때 `r2.close()`가 먼저 호출되고 `r1.close()`가 뒤따릅니다. `r2` 생성이 실패하면 아직 성공적으로 초기화되어 자원 목록에 들어간 객체가 아니므로 `r2.close()`는 호출되지 않고, 이미 성공한 `r1`만 닫힙니다.

상태를 쓰면 `open1 성공 → open2 예외 → close1 → open2 예외 전달`입니다. `close1`도 실패하면 생성 실패가 primary가 되고 close 실패가 suppressed가 됩니다. 이는 “괄호 안 변수 전부에 close”가 아니라 “성공적으로 초기화된 자원의 역순 정리”라는 의미입니다. 본문이 이미 실패한 경로라면 본문 예외가 primary이고 close 실패는 그 예외에 suppressed로 추가됩니다.

핸들 반납 순서는 보장되지만, 생성자가 파일·원격 lease·DB 세션을 만든 외부 효과를 `close()`가 거래적으로 rollback한다는 뜻은 아닙니다. 별도 abort나 보상 상태가 필요합니다. 프로세스 강제 종료 시 정상 정리 경로가 실행되지 않을 수 있으므로 운영에서는 open/close trace와 누수 지표를 함께 기록하겠습니다.

## 득점 포인트

- `r1` 성공과 `r2` 생성 실패의 중간 상태를 추적하여 실패한 `r2`가 아니라 성공한 `r1`만 닫힌다는 범위를 설명합니다.
- 생성 실패와 close 실패가 겹칠 때 primary와 suppressed의 관계, 외부 rollback 부재를 구분합니다.

## 감점 포인트

- 자원 목록에 적은 모든 표현식이 생성 실패 여부와 관계없이 close된다고 말하면 안 됩니다.
- 역순 close가 원격 lease나 DB 변경의 의미적 rollback까지 보장한다고 확대하면 안 됩니다.

## 더 파고들 거리

- `r1`, `r2`, `r3` 중 `r2` 생성이 실패하는 경우 실제 close 호출 목록과 suppressed 배열을 표로 작성해 보세요.
- JVM 강제 종료와 정상 예외 탈출을 구분하여 자원 반납 보장을 어디까지 관측할 수 있는지 확인해 보세요.

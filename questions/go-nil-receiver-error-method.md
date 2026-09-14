---
id: "go-nil-receiver-error-method"
title: "nil 포인터가 error interface에 들어 있습니다. Error 메서드가 nil 수신자를 허용하는지 어떻게 확인하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","인터페이스","nil","심화 질문"]
related: ["go-interface-typed-nil","go-slice-backing-array"]
promotedFrom: {"id":"go-interface-typed-nil","prompt":"nil 수신자를 허용하는 `Error` 메서드와 허용하지 않는 메서드를 어떻게 테스트할까요?"}
---

# nil 포인터가 error interface에 들어 있습니다. Error 메서드가 nil 수신자를 허용하는지 어떻게 확인하나요?

## 구두 답변

nil 수신자 메서드는 호출 자체가 항상 panic인 것은 아니고 메서드 본문이 nil을 어떻게 처리하는지에 달려 있습니다. 필드를 무조건 역참조하면 실패하고 명시적으로 nil을 처리하면 문자열을 반환할 수 있습니다.

error interface가 비nil이라는 사실과 내부 포인터의 nil 여부를 구분합니다. 정상 무오류는 가능하면 진짜 nil interface를 반환합니다. 로깅·formatting이 Error를 호출하는 경로까지 테스트해 진단 중 추가 panic이 생기지 않게 합니다.

## 득점 포인트

- nil 수신자 메서드는 호출 자체가 항상 panic인 것은 아니고 메서드 본문이 nil을 어떻게 처리하는지에 달려 있습니다. 필드를 무조건 역참조하면 실패하고 명시적으로 nil을 처리하면 문자열을 반환할 수 있습니다.
- 로깅·formatting이 Error를 호출하는 경로까지 테스트해 진단 중 추가 panic이 생기지 않게 합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: nil 수신자 메서드는 호출 자체가 항상 panic인 것은 아니고 메서드 본문이 nil을 어떻게 처리하는지에 달려 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Go에서 nil인 포인터를 error 변수에 넣었는데, 왜 err == nil은 false가 되나요?](/tech-interview/questions/go-interface-typed-nil/)

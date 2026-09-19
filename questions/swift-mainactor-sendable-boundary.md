---
id: swift-mainactor-sendable-boundary
title: MainActor 격리 객체 전달은 Sendable 경고와 어떤 계약 차이가 있나요?
difficulty: 중하
category: 모바일
tags:
  - Swift
  - Sendable
  - structured concurrency
  - TaskGroup
related:
  - swift-completion-cancel-once
---
# MainActor 격리 객체 전달은 Sendable 경고와 어떤 계약 차이가 있나요?

## 구두 답변

MainActor 격리는 UI 상태를 어느 executor에서 읽고 쓸지 정하고, Sendable은 값이 다른 concurrency domain으로 이동해도 안전한지 정하는 타입 계약입니다. `@MainActor` 객체의 reference를 closure가 보관할 수 있다는 사실은 그 객체의 `title`을 background에서 직접 읽어도 된다는 뜻이 아닙니다. worker는 `SearchInput(query: String)`처럼 Sendable인 값을 받고, 계산 결과를 반환한 뒤 `await MainActor.run` 또는 MainActor-isolated 메서드에서 현재 query와 generation을 검사하고 UI에 적용합니다.

예를 들어 `ab` 요청이 늦게 도착한 뒤 `abc` 화면을 덮지 않게 하려면 MainActor에서 현재 query가 `ab`인지 확인해야 합니다. Sendable DTO를 사용해도 결과 순서 문제는 자동 해결되지 않고, MainActor 격리를 사용해도 non-Sendable DTO를 안전하게 전달해 주지 않습니다. 실제 warning은 언어 모드·SDK annotation에 따라 target에서 확인해야 합니다.

경계 예시는 `@MainActor final class SearchModel`이 `query`를 보유하고 worker가 `model.query`를 직접 읽는 경우입니다. reference를 캡처하는 것만 허용되는 상황이어도 property read는 MainActor 격리를 요구할 수 있습니다. 안전한 흐름은 MainActor에서 query와 generation을 복사하고, worker가 그 값으로 결과를 계산한 뒤, 복귀한 MainActor 구간에서 generation이 아직 같을 때만 배열을 대입하는 것입니다. Sendable은 이동을, MainActor는 접근 위치를 검증합니다.
## 득점 포인트

- executor 접근 규칙인 MainActor와 전달 가능성인 Sendable을 독립된 계약으로 설명합니다.
- DTO 전달, background 계산, MainActor 복귀, query generation 검사를 한 흐름으로 보여 줍니다.
- 객체 identity 보관과 mutable UI property 직접 접근을 분리합니다.

## 감점 포인트

- MainActor annotation이면 어느 thread에서나 동기 접근해도 안전하다고 말합니다.
- Sendable 값이면 MainActor 상태를 await 없이 읽을 수 있다고 설명합니다.
- background 결과를 현재 query 검사 없이 UI에 반영해 늦은 결과를 허용합니다.

## 더 파고들 거리

- `@MainActor` model이 화면보다 오래 살아야 할 때 model owner와 view task 취소를 어떻게 분리할지 설명해 보세요.
- Sendable struct 안에 reference-type 필드가 들어갈 때 내부 불변성·actor 격리를 어떤 순서로 검사할지 비교해 보세요.

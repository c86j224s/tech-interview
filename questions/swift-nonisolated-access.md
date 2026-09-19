---
id: swift-nonisolated-access
title: actor isolated 프로퍼티를 일반 동기 함수가 직접 읽지 못하는 이유와 nonisolated 조건은 무엇인가요?
difficulty: 중하
category: 모바일
tags:
  - Swift
  - actor
  - await
  - reentrancy
related:
  - swift-completion-cancel-once
---
# actor isolated 프로퍼티를 일반 동기 함수가 직접 읽지 못하는 이유와 nonisolated 조건은 무엇인가요?

## 구두 답변

일반 동기 함수에는 actor executor에 들어가 값을 읽고 다른 actor 작업과 순서를 정하는 계약이 없습니다. 그래서 `wallet.balance`를 동기적으로 직접 읽으면 어느 시점의 값인지, 동시에 실행된 `withdraw`와 어떤 순서인지 표현할 수 없습니다. 호출자는 `await wallet.balance`로 snapshot을 받거나, actor 안에서 `canPay` 같은 필요한 판단을 수행하게 해야 합니다. `await`가 값을 영구적으로 고정하는 것이 아니라 읽은 순간의 결과를 전달한다는 점도 함께 말해야 합니다.

`nonisolated`는 격리를 우회해 mutable state를 읽는 표시가 아닙니다. 생성 뒤 변하지 않고 actor 상태와 독립적인 정적 메타데이터나 순수 계산처럼 executor가 필요 없다는 것을 보장할 때만 후보가 됩니다. 예를 들어 통화 코드가 불변 상수라면 가능하지만 현재 잔액을 반환하는 프로퍼티에는 맞지 않습니다. 실제 진단은 Swift 언어 모드와 strict concurrency 설정에 따라 target에서 확인합니다.

예를 들어 `func currentBalance() -> Int`를 일반 함수로 공개하고 내부 저장값을 바로 읽게 하면 두 호출 사이에 출금이 끼어 snapshot의 의미가 흔들립니다. 반면 actor 내부에서 `struct BalanceSnapshot: Sendable { let amount: Int; let version: Int }`를 한 번에 만들어 반환하면 호출자는 금액과 version이 같은 시점의 묶음임을 사용할 수 있습니다. 이후 판단을 오래 끌었다면 그 version이 여전히 현재인지 다시 actor에 확인해야 합니다.
이 API를 `await` 호출하는 비용보다 중요한 것은 값의 관찰 시점을 명확히 하는 일입니다. 여러 필드를 따로 읽으면 그 사이 다른 actor 작업이 끼어 서로 다른 snapshot이 될 수 있으므로, 함께 판단할 필드는 actor 내부 DTO로 묶어 반환합니다.
## 득점 포인트

- 문제를 thread 이름이 아니라 executor 진입과 mutable state 순서 계약의 부재로 설명합니다.
- `await` snapshot, actor 내부 계산, Sendable DTO 중 하나를 구체적인 API 경계로 제시합니다.
- nonisolated가 “모든 곳에서 읽기 허용”이 아니라 상태 독립성 주장임을 구분합니다.

## 감점 포인트

- `nonisolated`만 붙이면 actor의 잔액도 안전하게 동기 접근할 수 있다고 말합니다.
- `await`를 단순한 지연 표시로 설명하고 snapshot 시점을 누락합니다.
- actor reference가 전달 가능하다는 사실을 내부 프로퍼티 직접 접근 허용으로 오해합니다.

## 더 파고들 거리

- actor 내부 class를 immutable `Sendable` snapshot struct로 바꿀 때 snapshot 일관성을 어디서 확보할지 설명해 보세요.
- MainActor 객체를 background closure가 보관하는 것과 그 프로퍼티를 직접 읽는 것의 차이를 비교해 보세요.

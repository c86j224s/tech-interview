---
id: swift-actor-reference-element-transfer
title: actor가 반환한 배열의 원소를 호출자가 바꿀 때 내부 상태 영향은 무엇을 확인하나요?
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
# actor가 반환한 배열의 원소를 호출자가 바꿀 때 내부 상태 영향은 무엇을 확인하나요?

## 구두 답변

첫 판단은 배열의 얕은 복사 여부가 아니라 반환 경계를 통과할 수 있는 타입인지입니다. `[Item]`에서 `Item`이 `Sendable`인지, global-actor isolated인지, 호출자와 같은 격리 domain인지 먼저 확인합니다. 최신 strict concurrency에서는 mutable non-Sendable class 원소를 actor 밖으로 반환하는 예시 자체가 진단이나 오류가 될 수 있습니다. 그 계약을 통과하거나 완화된 언어 모드라면 배열 구조는 값 타입이라 호출자의 append가 actor의 배열 변수에 직접 반영되지는 않지만, mutable class 원소는 같은 객체 참조를 공유할 수 있습니다.

예를 들어 actor가 `[Item(name:"A")]`를 반환하고 호출자가 `items[0].name="X"`를 하면 actor가 보관한 원소도 X를 볼 수 있습니다. 안전한 선택은 `ItemSnapshot: Sendable` 불변 struct 반환, actor 메서드로만 mutation 허용, 또는 중첩 참조까지 포함한 deep copy입니다. `@unchecked Sendable`은 공유 mutable state를 고치지 않으므로 경고를 잠시 없애는 처방이 아닙니다.

이 문제는 COW의 구현 세부와 동시성 타입 계약을 섞지 않는 것이 중요합니다. 호출자가 배열에 원소를 추가해 배열 buffer가 분리되어도, 기존 `Item` 객체는 같은 주소를 가리킬 수 있습니다. 더 나아가 `Item` 안에 또 다른 mutable class가 있으면 한 단계 복사한 deep copy도 충분하지 않습니다. 읽기 전용 화면이라면 immutable snapshot이 가장 예측 가능하고, 큰 목록에서는 ID별 actor 명령이 전체 복사 비용을 줄이는 대신 여러 번 await하는 비용을 냅니다.
## 득점 포인트

- Sendable·격리 조건을 배열 COW 설명보다 먼저 확인합니다.
- 배열 컨테이너 복사와 class 원소의 참조 공유를 작은 객체 그래프로 구분합니다.
- immutable DTO, actor mutation API, deep copy의 비용과 사용 조건을 비교합니다.

## 감점 포인트

- Swift 배열은 항상 deep copy이므로 원소 변경이 내부에 영향을 주지 않는다고 말합니다.
- actor 반환값이면 non-Sendable reference도 언제나 호출자가 안전하게 바꿀 수 있다고 가정합니다.
- `@unchecked Sendable`만 선언하면 mutable object의 소유권이 해결된다고 설명합니다.

## 더 파고들 거리

- snapshot을 만드는 동안 actor 내부 배열이 바뀌지 않도록 어느 격리 구간에서 변환할지 설명해 보세요.
- ID별 변경 명령 API와 큰 snapshot 반환 API의 관찰 비용·복사 비용을 비교해 보세요.

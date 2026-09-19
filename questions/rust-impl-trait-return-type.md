---
id: rust-impl-trait-return-type
title: impl Trait 반환에서 분기마다 다른 구체 타입을 반환할 수 없는 이유와 대안은 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-trait-objects-generics-monomorphization
related:
  - java-overload-override
---
# impl Trait 반환에서 분기마다 다른 구체 타입을 반환할 수 없는 이유와 대안은 무엇인가요?

## 구두 답변

반환 위치의 `impl Trait`은 “호출자는 이름을 모르지만 이 함수는 하나의 구체 타입을 반환한다”는 opaque 계약입니다. 그래서 `fn source(flag: bool) -> impl Iterator<Item = i32> { if flag { 0..3 } else { std::iter::once(9) } }`는 실패합니다. `Range<i32>`와 `Once<i32>`가 모두 Iterator를 구현한다는 공통 trait 사실만으로 두 concrete type이 하나가 되지는 않기 때문입니다. 분기별 중간 상태는 `true → Range(0,1,2)`, `false → Once(9)`로 서로 다른 레이아웃과 구현을 갖습니다. 결과 집합이 소스 코드에 고정되어 있으면 `enum Source { Range(Range<i32>), Once(Once<i32>) }`를 만들고 `Iterator`를 직접 구현하는 대안이 있습니다. enum은 allocation과 vtable을 피할 여지가 있고 `match`로 모든 variant를 처리하지만, 새 분기를 추가할 때 enum과 구현을 함께 수정해야 합니다. 구현이 런타임 plugin으로 열려 있거나 목록에 소유해 보관해야 하면 `Box<dyn Iterator<Item = i32>>`로 타입을 지울 수 있습니다. 그 선택은 heap allocation 한 번과 동적 dispatch, 그리고 반환 객체의 lifetime·Send 조건을 API에 추가합니다. 단순히 컴파일을 통과시키려고 항상 Box를 고르기보다 분기 집합이 닫혔는지와 hot path인지 먼저 봅니다. `impl Trait`은 trait object와 같지 않으므로 일반적으로 정적 호출·최적화 가능성을 유지하고, `Box<dyn Iterator>`는 공통 런타임 표현을 제공하는 대신 간접 비용을 명시합니다. 이 구분은 async 함수의 opaque Future와 boxed Future를 비교할 때도 같은 방식으로 적용됩니다.

## 득점 포인트

- impl Trait의 단일 opaque concrete type 계약과 enum·Box 대안을 비용까지 비교합니다.
- 정적·동적 dispatch의 선택을 성능 단정이 아니라 고정 환경 측정과 API 요구로 결정합니다.

## 감점 포인트

- 공통 Iterator trait 구현만으로 impl Trait 분기의 concrete type이 합쳐진다고 말하지 않습니다.
- vtable, enum, opaque type의 표현 차이를 단순히 “빠르다/느리다”로 결론내리지 않습니다.

## 더 파고들 거리

- async Future에서 impl Trait과 Pin<Box<dyn Future>>의 소유·dispatch 비용은 어떻게 달라질까요?
- API 경계가 바뀔 때 Send·Sync 또는 정적·동적 dispatch 요구를 어떻게 재검증할까요?

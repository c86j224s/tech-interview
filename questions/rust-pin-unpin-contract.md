---
id: rust-pin-unpin-contract
title: Pin<Box<T>>를 쓰면 포인터 변수도 움직일 수 없나요? Pin과 Unpin의 대상은 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Rust
  - Pin
  - Unpin
  - Future
related:
  - async-api-and-blocking
  - cpp-coroutine-frame-lifetime
---
# Pin<Box<T>>를 쓰면 포인터 변수도 움직일 수 없나요? Pin과 Unpin의 대상은 무엇인가요?

## 구두 답변

`Pin<Box<T>>`가 고정하는 대상은 일반적으로 `Box` 변수 자체가 아니라 heap allocation 안의 `T`, 즉 pointee입니다. `let a = Box::pin(value); let b = a;`는 owning pointer의 소유권 이동이므로 허용되지만, 같은 allocation의 `T` 주소는 바뀌지 않습니다. 자기 참조처럼 내부 포인터가 자기 위치를 전제로 하는 `!Unpin` 타입은 이 주소 안정성이 필요합니다. `T: Unpin`이면 pinning으로 이동을 막을 이유가 없어서 `Pin<&mut T>`에서 일반 mutable reference를 얻는 경계가 열립니다. 그러나 Pin은 lifetime 연장, executor 소유권, 외부 I/O 취소를 제공하지 않습니다. projection에서 pinned field를 꺼내 이동시키는 unsafe 코드는 불변식을 작성자가 책임져야 합니다.

예를 들어 내부 필드에 자신의 다른 필드 주소를 보관하는 타입이 heap 주소 0x1000에 고정되었다고 하겠습니다. Box 핸들을 변수 a에서 b로 옮겨도 heap의 T가 그대로라면 그 내부 주소는 유지됩니다. 그러나 `mem::replace`로 T 자체를 꺼내 다른 저장소로 옮기면 자기 참조가 옛 주소를 가리킬 수 있습니다. Pin의 safe API는 `!Unpin` 대상에 이런 이동을 노출하지 않도록 제한합니다. 단순히 `!Unpin`이라는 사실만으로 모든 값이 이미 고정된 것은 아니며 pinning이 성립한 이후의 계약이 중요합니다.

판정은 주소 안정성, 소유 수명, 공유 접근을 나누어 하겠습니다. Box는 할당의 소유권, Pin은 고정된 대상의 이동 제약, borrow는 접근 기간을 표현합니다. Pin이 있다고 여러 스레드가 필드를 동시에 바꿔도 되는 것은 아니고, drop까지 미뤄 주는 것도 아닙니다. 필드 projection이나 custom Drop은 별도 unsafe 불변식이 필요하므로 직접 구현보다 검증된 projection 도구를 사용하고, 테스트가 통과했다는 이유만으로 모든 이동 경로가 안전하다고 단정하지 않습니다.

## 득점 포인트

- 포인터 값 이동과 pointee 이동을 `Box::pin` 예제로 분리합니다.
- `Unpin`을 주소 불변식이 필요 없는 타입에 대한 완화로 설명합니다.
- `Future::poll(Pin<&mut Self>)`와 자기 참조 상태 기계의 관계를 연결합니다.

## 감점 포인트

- `Pin<Box<T>>` 변수는 어떤 대입도 할 수 없다고 말합니다.
- `Box`를 move하면 heap의 `T`도 새 주소로 이동한다고 설명합니다.
- `Unpin`을 “항상 stack에 둬도 된다” 또는 lifetime 보장으로 축약합니다.

## 더 파고들 거리

- 구조체에서 unpinned field와 pinned field를 projection할 때 접근 권한이 왜 달라지나요?
- stack pin과 `Box::pin`은 소유권·수명·allocation 비용에서 어떤 선택 차이를 만드나요?

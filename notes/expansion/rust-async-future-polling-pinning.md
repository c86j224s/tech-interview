---
id: rust-async-future-polling-pinning
title: Rust Future Polling과 Pinning
topic: 언어·런타임
summary: 'Future의 지연 실행, poll과 Waker의 진행 계약, Pin이 보장하는 대상 주소 안정성을 상태 전이와 취소 경계로 설명합니다.'
questionIds: []
prerequisites:
  - async-execution
  - cpp-coroutine-lifetime
related:
  - async-execution
  - cpp-coroutine-lifetime
reviewedAt: '2026-09-19'
---
# Rust Future Polling과 Pinning

Rust의 `async fn` 호출은 결과를 계산하는 사건이 아니라, 나중에 진행할 상태 기계를 값으로 만드는 사건입니다. 그 값은 executor가 `Context`와 함께 `poll`할 때만 움직입니다. `poll`은 한 번의 진행을 `Poll::Ready(output)` 또는 `Poll::Pending`으로 보고합니다. `Pending`이면 future는 현재 `Context`에서 얻은 `Waker`를 외부 readiness 사건과 연결해야 합니다. `Pin<&mut Self>`는 poll 중 future 자체가 주소를 바꾸지 않는다는 접근 경계를 표현합니다. executor의 재호출, future의 waker 등록, pointee의 주소 안정성은 서로 다른 계약입니다.

## 지연 실행 상태

```rust
async fn load() -> u32 { println!("body"); 42 }
let f = load();
// f를 poll하거나 await하지 않으면 body는 끝까지 실행되지 않는다.
```

`f`를 변수에 저장만 하면 실행 스레드가 생기지 않습니다. 첫 poll이 `await` 전까지 진행하고 I/O를 등록한 뒤 `Pending`을 반환한다고 모델링할 수 있습니다. readiness가 발생해 다시 poll되면 저장된 상태를 읽고 `Ready(42)`를 돌려줍니다. 익명 future의 실제 필드와 레이아웃은 컴파일러 내부 표현이므로, 다음 표는 의미를 추적하는 모델입니다.

|호출|future 상태|관찰 결과|
|---|---|---|
|생성|Start|본문 실행 보장 없음|
|poll 1|Waiting|I/O 등록, `Pending`|
|poll 2|Done|`Ready(42)`|

## Poll 인터페이스

개념적인 시그니처는 `fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>`입니다. 한 시점에 mutable poll 하나만 허용하고, `Context`는 이번 호출의 waker를 제공합니다. `Ready` 뒤 같은 future를 정상 진행 경로로 다시 poll하면 안 됩니다. executor는 완료 task를 큐에서 제거하고 future를 정리해야 합니다. `wake()`는 값을 전달하거나 완료를 판정하지 않습니다. future가 다음 poll에서 readiness를 다시 읽어 결과를 판정합니다.

`Pending`은 실패가 아닙니다. “지금 이 호출에서 더 진행할 수 없다”는 뜻입니다. 반대로 `wake()` 직후에도 readiness가 사라졌다면 다음 poll은 다시 `Pending`일 수 있습니다. 표준 수준에서 보장되는 것은 진행할 수 있을 때 task가 다시 poll을 시도할 기회를 주는 것이며, 즉시 실행, queue enqueue 방식, 중복 wake 제거는 executor와 Waker 구현의 계약입니다.

## Waker 등록 경합

readiness를 먼저 읽고 waker를 나중에 등록하면 lost wakeup이 생깁니다.

```text
R1: readable=false
E : 데이터 도착, 기존 등록자 없음
R2: waker 등록
결과: 이미 발생한 이벤트의 재호출 신호를 놓침
```

안전한 primitive은 보통 등록과 재확인을 묶거나, 등록 뒤 readiness를 다시 검사하게 합니다. 직접 awaiter를 만들면 `register(waker)`가 즉시 callback을 허용하는지, 등록 실패 때 누가 재개하는지, 취소 시 등록을 어떻게 해제하는지를 정의해야 합니다. poll마다 waker가 달라질 수 있으므로 이전 waker를 무조건 유지하면 task가 다른 executor로 이동한 뒤 새 실행기에 도달하지 못할 수 있습니다. 저장된 waker와 현재 waker가 같은 task인지 비교해 필요할 때 교체하는 방식이 일반적입니다.

## Pin과 pointee

`Pin<Box<T>>`에서 이동 제한의 대상은 보통 `Box` 변수 자체가 아니라 가리키는 `T`입니다.

```rust
let a = Box::pin(MyFuture::new());
let b = a; // owning pointer 이동; heap의 T 주소는 유지
```

`Box`가 같은 allocation을 가리키는 동안 `T`의 위치는 고정됩니다. 자기 참조처럼 내부 포인터가 자기 위치를 전제로 하는 `!Unpin` 타입은 이 보장이 필요합니다. `T: Unpin`이면 pinning으로 이동을 막을 필요가 없으므로 `Pin<&mut T>`에서 일반 참조로 접근할 수 있는 경로가 열립니다. `Unpin`은 “항상 heap에 있다”는 뜻도, lifetime을 연장한다는 뜻도 아닙니다. projection에서 pinned field를 일반 mutable reference로 꺼내면 불변식을 깨뜨릴 수 있으므로, 구조적 projection 규칙이나 검증된 도구를 써야 합니다.

## 수동 Future 흐름

아래는 I/O가 아닌 상태 카운터이며 설명용입니다.

```rust
use std::{future::Future, pin::Pin, task::{Context, Poll}};
struct Twice { polls: u8 }
impl Future for Twice {
    type Output = u8;
    fn poll(mut self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<u8> {
        self.polls += 1;
        if self.polls == 2 { Poll::Ready(7) } else { Poll::Pending }
    }
}
```

첫 호출의 `polls`는 1이 되어 `Pending`, 둘째는 2가 되어 `Ready(7)`입니다. 이 예제는 waker를 사용하지 않으므로 호출자가 직접 다시 poll해야 합니다. 표준 trait 계약을 보여 주는 설명용 코드이며 이 환경에서 rustc 실행 결과를 주장하지 않습니다. 실제 I/O future는 외부 primitive가 waker를 호출해야 다시 poll됩니다.

## Drop과 원격 효과

future를 drop하면 로컬 continuation, 보유한 buffer, 소켓 핸들 등의 Rust 값이 정리됩니다. 이미 커널에 전달된 write나 서버가 커밋한 데이터까지 rollback한다는 뜻은 아닙니다. HTTP client가 drop 때 연결 종료를 시도할 수 있는지는 client/runtime의 별도 문서에 달렸습니다. 서버가 요청을 읽기 전에 끊겼을 수도 있고, 응답만 유실되고 주문 변경은 완료됐을 수도 있습니다.

따라서 timeout, 취소 요청, 취소 완료, 원격 결과 불명확을 구별합니다. 변경 요청은 idempotency key와 상태 조회를 사용하고, 메시지는 ack 시점을 정하며, 파일은 임시 파일 작성 후 rename 같은 원자적 경계를 고려합니다. Rust ownership은 로컬 메모리와 자원 정리를 돕지만 분산 트랜잭션의 원자성을 만들지 않습니다.

## 실행기 선택과 비용

executor는 worker 수, task queue, waker deduplication, shutdown 시 drop 순서를 정합니다. `block_on`은 future를 반복 poll하는 실행기이지 내부 blocking I/O를 자동으로 다른 pool로 옮기는 기능이 아닙니다. task 수가 많을수록 waker 저장과 queue 접근 비용, 불필요한 wake의 중복 비용이 생깁니다. 반대로 직접 polling을 잘못 구현하면 lost wakeup으로 영원한 `Pending`이 됩니다. 진단은 `poll 시작 → readiness 관찰 → waker 등록 → 외부 이벤트 → wake → 다음 poll`의 각 지점을 기록해야 합니다.

## 검증 경계

검증할 사실을 분리합니다. `Future` 문서로 `poll`, `Pending/Ready`, `Context/Waker`, `Pin<&mut Self>` 계약을 확인하고, `Pin`·`Unpin` 문서로 pointee 이동 제한과 완화 조건을 확인합니다. 이 배치에서는 Rust compiler가 없어 예제를 실행하지 않았습니다. 따라서 executor의 즉시성, 특정 HTTP client의 연결 종료, compiler가 생성한 익명 future의 `Unpin` 여부는 사용 중인 runtime과 compiler 문서를 추가로 확인해야 합니다. 안정적인 언어 계약과 runtime 정책을 “최신 구현의 보장”으로 섞지 않는 것이 핵심입니다.

```diagram
{"title":"Future 진행 경계","caption":"poll은 상태를 한 단계 읽고 waker는 재시도 기회를 알리며 Pin은 future pointee의 주소 안정성을 담당합니다.","rows":[[{"id":"make","label":"Future 생성"}],[{"id":"poll","label":"poll 호출","detail":["Pin + Context"]}],[{"id":"pending","label":"Pending","detail":["waker 등록"]}],[{"id":"wake","label":"wake","detail":["재-poll 기회"]}],[{"id":"ready","label":"Ready","detail":["완료 정리"]}]],"edges":[{"from":"make","to":"poll","label":"지연 실행 값"},{"from":"poll","to":"pending","label":"진행 불가"},{"from":"pending","to":"wake","label":"외부 readiness"},{"from":"wake","to":"poll","label":"상태 재확인"},{"from":"poll","to":"ready","label":"완료 판정"}]}
```

## 참고자료

- https://doc.rust-lang.org/std/future/trait.Future.html — `poll`, `Poll`, `Context`, waker 재호출 계약을 확인했습니다. 표준 문서는 wake가 완료를 보장한다고 말하지 않습니다.
- https://doc.rust-lang.org/std/pin/struct.Pin.html — Pin이 포인터가 아니라 pointee 이동을 제한하는 경계를 확인했습니다.
- https://doc.rust-lang.org/std/marker/trait.Unpin.html — `Unpin`의 자동 trait와 pinning 완화 조건을 확인했습니다.
- https://rust-lang.github.io/async-book/02_execution/02_future.html — 이 배치에서 URL이 404여서 executor 근거로 사용하지 않았습니다.

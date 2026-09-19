---
id: rust-send-sync-thread-contracts
title: Rust Send·Sync 스레드 계약
topic: 언어·런타임
summary: Rust Send·Sync 스레드 계약의 핵심 메커니즘·실패 조건·적용 경계를 다루는 제안입니다.
questionIds: []
prerequisites:
  - concurrent-ownership
  - synchronization-foundations
related:
  - concurrent-ownership
  - synchronization-foundations
reviewedAt: '2026-09-19'
---
# Rust Send·Sync 스레드 계약

Rust에서 값을 다른 스레드로 보내거나 여러 스레드에서 공유할 수 있는지는 “스레드 안전해 보이는 자료구조인가”가 아니라 타입의 `Send`·`Sync` 계약으로 판단합니다. `Send`는 값의 소유권을 스레드 사이로 이동할 수 있다는 뜻이고, `Sync`는 공유 참조를 통해 동시에 접근해도 타입 계약을 깨뜨리지 않는다는 뜻입니다. `Arc`의 원자적 참조 카운트는 소유 핸들의 수명만 안전하게 만들 뿐, 안쪽 값에 필요한 동기화까지 추가하지 않습니다.

## Send와 Sync의 의미

`T: Send`이면 `T`의 소유 값을 다른 스레드로 옮겨도 안전하다는 전제입니다. `T: Sync`이면 `&T: Send`와 동치로 이해할 수 있습니다. 즉 공유 참조 자체를 다른 스레드로 전달할 수 있는지의 문제입니다. 이 두 표지는 데이터 경합을 막는 언어 계약이며, 교착·기아·무한 대기·논리적 순서 오류까지 해결한다는 뜻은 아닙니다.

대부분의 조합형 타입은 구성요소의 조건을 따라 자동으로 auto trait을 얻습니다. 반면 `Rc<T>`의 비원자 카운트와 `UnsafeCell<T>` 기반 내부 가변성은 여러 스레드 공유를 자동으로 허용할 수 없게 만드는 대표적인 경계입니다. `unsafe impl Send`나 `unsafe impl Sync`를 직접 작성하면 컴파일러의 보수적 거절을 우회하므로, 모든 공유 경로·alias·동기화 순서를 별도로 증명해야 합니다.

## Rc와 Arc의 카운트 차이

`Rc<T>`는 단일 스레드에서 참조 카운트를 관리하는 타입입니다. `thread::spawn(move || drop(rc))`처럼 소유권을 넘기려 하면 `Rc<T>: Send` 조건을 만족하지 못해 컴파일이 거절됩니다. `Arc<T>`는 strong·weak 카운트를 원자적으로 관리해 여러 스레드가 이미 확보한 소유 핸들을 복사하고 해제할 수 있게 합니다.

```rust
use std::rc::Rc;
use std::sync::Arc;
use std::thread;

let rc = Rc::new(String::from("local"));
// thread::spawn(move || println!("{rc}")); // Rc는 Send가 아님

let arc = Arc::new(String::from("shared"));
let worker = Arc::clone(&arc);
let handle = thread::spawn(move || println!("{worker}"));
handle.join().unwrap();
```

`Arc<String>`이 허용되는 이유는 `String`이 `Send`·`Sync` 조건을 충족하고, 읽기 공유만 하기 때문입니다. `Arc<RefCell<T>>`는 `Arc`만으로 `RefCell<T>`의 비동기 내부 가변성을 바꾸지 못하므로 여러 스레드의 `&` 공유 조건에서 거절됩니다. 변경이 필요하면 `Arc<Mutex<T>>`, `Arc<RwLock<T>>`, 원자 타입 등 실제 접근 규칙에 맞는 내부 동기화를 선택합니다.

```diagram
{"title":"Arc가 보장하는 범위","caption":"Arc는 control block 카운트를 원자적으로 관리하지만 안쪽 값의 Send·Sync 조건과 데이터 접근 규칙은 그대로 남습니다.","rows":[[{"id":"handle","label":"Arc 핸들","detail":["strong count 원자 증감"]}],[{"id":"inner","label":"안쪽 T","detail":["T의 Send·Sync 조건"]}],[{"id":"guard","label":"동기화 경계","detail":["Mutex·RwLock·Atomic 등"]}],[{"id":"work","label":"스레드 작업","detail":["공유 참조 또는 소유 이동"]}]],"edges":[{"from":"handle","to":"inner","label":"소유 대상 접근"},{"from":"inner","to":"guard","label":"가변 접근 필요"},{"from":"guard","to":"work","label":"검증된 임계 구역"}]}
```

## Cell과 RefCell의 금지 경계

`Cell<T>`와 `RefCell<T>`는 내부 가변성을 제공하지만, 그 가변 접근을 스레드 간 동기화하지 않습니다. `RefCell`은 borrow 규칙을 런타임에 검사해 같은 스레드 안에서 잘못된 중첩 대여를 panic으로 알릴 수 있지만, 이 검사는 다른 스레드가 동시에 접근하는 원자적 조정 장치가 아닙니다. 따라서 `Arc<RefCell<T>>`를 만들 수 있는 것과 이를 `thread::spawn`에 전달할 수 있는 것은 다른 문제입니다.

`Arc<Mutex<T>>`에서는 lock이 가변 접근을 직렬화합니다. 표준 `Mutex<T>`의 조건을 정확히 나누면 `Mutex<T>: Send`와 `Mutex<T>: Sync` 모두 `T: Send`를 요구하며, `T: Sync`는 요구하지 않습니다. `Send`는 `into_inner`나 mutex 자체의 소유권을 다른 스레드로 넘길 때 보호된 T도 이동 가능해야 하기 때문입니다. `Sync`에서는 한 시점에 하나의 `MutexGuard`만 T를 노출하므로 T의 공유 참조 동시성이 없어도 됩니다. 따라서 `Mutex<RefCell<T>>`의 내부 borrow 규칙은 lock 아래 한 스레드에 직렬화될 수 있지만, `Mutex`를 벗겨낸 `RefCell`을 독립적으로 공유한다는 뜻은 아닙니다.

## Mutex guard와 lock 수명

guard는 잠금 획득과 해제를 묶은 RAII 값입니다. guard가 살아 있는 동안 `Deref`를 통해 보호된 데이터를 보고, guard가 drop되면 잠금이 풀립니다. 따라서 비싼 I/O나 다른 lock 획득을 guard의 수명 안에 넣지 않도록 범위를 좁히는 것이 일반적인 설계입니다.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

let total = Arc::new(Mutex::new(0_u64));
let worker_total = Arc::clone(&total);
let h = thread::spawn(move || {
    {
        let mut guard = worker_total.lock().unwrap();
        *guard += 3;
    } // 여기서 guard drop, 다음 작업이 lock을 얻을 수 있음
});
h.join().unwrap();
assert_eq!(*total.lock().unwrap(), 3);
```

`lock().unwrap()`은 다른 스레드가 panic으로 mutex를 poison한 경우 `PoisonError`를 반환할 수 있습니다. poison은 메모리 안전성의 보편적인 보장이 아니라, 보호된 불변식이 중간 상태일 가능성을 호출자에게 알리는 정책입니다. 데이터를 복구할 수 있으면 `into_inner` 등으로 상태를 검사할 수 있지만, 무조건 unwrap해 정상 데이터로 간주하면 업무 규칙을 놓칠 수 있습니다.

## 공유 참조와 소유 이동의 분리

다음 표처럼 타입 위치를 기준으로 판단해야 합니다.

| 목적 | 필요한 계약 | 예시 | 남는 문제 |
| --- | --- | --- | --- |
| 값 자체를 worker로 이동 | `T: Send` | `thread::spawn(move || value)` | 작업 순서·취소 |
| `&T`를 여러 worker가 읽음 | `T: Sync` | `Arc<T>` 공유 | 내부 논리 일관성 |
| 공유 값을 변경 | `Arc<Mutex<T>>` 등 | guard 안 갱신 | 경합·교착·poison |
| 원자적 단일 값 갱신 | 원자 타입 계약 | `AtomicUsize` | 복합 불변식 |

`Arc<AtomicUsize>`로 카운터 하나를 안전하게 늘릴 수 있어도 두 카운터의 합, 목록과 길이, 상태와 타임스탬프를 한 번에 바꾸는 불변식은 보장하지 않습니다. 그 경우 하나의 mutex 임계 구역, 불변 snapshot 교체, 또는 더 좁은 상태 머신이 필요합니다.

## 실행 흐름과 실제 실패

컴파일러가 `Rc`나 `Arc<RefCell<_>>`의 전달을 거절하는 것은 실행 중 경합을 관찰했기 때문이 아니라 타입 계약만으로 안전성을 증명할 수 없기 때문입니다. 반대로 `Arc<Mutex<T>>`가 컴파일되었다고 해서 deadlock이 사라지지는 않습니다. 두 mutex를 서로 다른 순서로 잡으면 Rust에서도 교착이 발생할 수 있고, lock을 오래 들고 있으면 지연과 기아가 커집니다.

`thread::spawn`에 넘긴 closure가 `move`를 사용하면 캡처한 값의 소유권을 worker로 전달합니다. 반환된 `JoinHandle`을 join하지 않으면 주 스레드가 먼저 끝나거나 오류를 관찰하지 못할 수 있습니다. 이 수명 문제는 `Send`·`Sync`와 별도의 실행 계약입니다. cancellation token, join, 채널 close 같은 종료 프로토콜도 함께 설계해야 합니다.

## 검증 절차와 관찰 지표

검증할 때는 먼저 컴파일 단계의 trait 오류를 최소 예제로 재현합니다. `Rc<String>`, `Arc<String>`, `Arc<RefCell<_>>`, `Arc<Mutex<_>>`를 각각 한 스레드와 두 스레드 경계에서 비교하고, 어떤 타입 경계에서 실패하는지 기록합니다. 다음으로 mutex guard의 scope를 줄인 버전과 I/O를 포함한 버전을 비교해 대기 시간을 측정합니다. 이 환경에서 예제 코드를 실행했다는 주장은 하지 않습니다.

운영 관찰에는 lock 획득 대기 시간, guard 보유 시간, poison 발생 수, worker join 대기, 작업 취소 후 남은 스레드를 둡니다. `Arc::strong_count`는 진단용 수명 단서일 뿐, 경쟁 없는 정확한 상태 스냅샷이나 누수 증명의 대체물이 아닙니다. lock-free 구조라면 reclamation과 ABA, allocator의 진행성까지 별도로 검증합니다.

## 선택 기준과 비용

읽기 전용 불변 값은 `Arc<T>`가 간단하지만 원자 카운트와 간접 접근 비용이 있습니다. 작은 Copy 값은 원자 타입이나 값 전달이 더 명료할 수 있습니다. 변경이 자주 일어나고 임계 구역이 길면 하나의 큰 mutex보다 메시지 전달·소유권 이전·sharding이 경합을 줄일 수 있습니다. `RwLock`은 읽기 병렬성을 제공할 수 있지만 writer starvation과 승격 문제를 자동으로 해결하지 않습니다.

결정 기준은 “Arc를 쓸 수 있는가”가 아니라 보호해야 하는 불변식과 소유권의 이동 경로입니다. 안쪽 T의 스레드 계약, lock을 잡는 동안 수행하는 작업, 오류·취소 때 guard가 drop되는 시점, 그리고 종료 시 마지막 소유자가 외부 자원을 정리하는 주체를 문서로 남깁니다.

## 참고 자료와 검증 범위

- Rustonomicon, “Send and Sync”, <https://doc.rust-lang.org/nomicon/send-and-sync.html> 및 <https://doc.rust-lang.org/std/sync/struct.Arc.html>, 2026-09-19 확인. auto trait, `Rc`, `UnsafeCell`의 경계를 대조했습니다. 페이지의 특정 release version은 확인하지 못했습니다.
- Rust 표준 라이브러리 `Arc`, <https://doc.rust-lang.org/std/sync/struct.Arc.html>, 2026-09-19 확인. 원자적 참조 카운트와 내부 동기화가 별도라는 설명에 사용했습니다.
- Rust 표준 라이브러리 `Mutex`, <https://doc.rust-lang.org/std/sync/struct.Mutex.html>, 2026-09-19 확인. guard 수명과 poison의 설명 범위를 대조했습니다.
- 코드와 숫자 상태는 설명용입니다. 특정 OS·allocator·Rust toolchain에서 실행한 결과가 아니며, 실제 성능 결론은 고정 환경에서 측정해야 합니다.

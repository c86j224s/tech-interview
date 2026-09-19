---
id: rust-cell-sync-boundary
title: Cell과 RefCell을 Arc로 감싸도 여러 스레드가 공유할 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-send-sync-thread-contracts
related:
  - cpp-shared-pointer-lifetime
  - condition-variable-predicate
---
# Cell과 RefCell을 Arc로 감싸도 여러 스레드가 공유할 수 없는 이유는 무엇인가요?

## 구두 답변

`Arc`가 원자적으로 만드는 것은 control block의 strong·weak count이지, 안쪽 `T`의 접근입니다. `Cell<T>`는 공유 참조에서 값을 꺼내고 바꾸는 내부 가변성을 제공하고, `RefCell<T>`는 borrow 규칙을 런타임 flag로 검사합니다. 이 검사는 한 스레드의 중첩 borrow를 발견해 panic할 수 있지만 다른 스레드의 접근과 원자적으로 합의하는 lock이 아닙니다. 따라서 `Arc::new(RefCell::new(0))` 자체는 한 스레드에서 만들 수 있어도, 이를 `thread::spawn(move || ...)`으로 보내려 하면 `Arc<RefCell<_>>`가 요구하는 `Send`·`Sync` 경계를 만족하지 못해 컴파일이 거절됩니다. “Arc로 감쌌으니 안전하다”가 아니라 “Arc와 T의 계약을 모두 통과해야 한다”가 정확합니다. 단일 숫자라면 `Arc<AtomicUsize>`에서 `fetch_add(1, Ordering::Relaxed)`처럼 원자 연산을 사용합니다. 여러 필드의 합이나 상태-타임스탬프처럼 복합 불변식을 함께 갱신해야 하면 `Arc<Mutex<State>>`로 한 임계 구역에 묶어야 합니다. `Arc<Mutex<RefCell<T>>>`는 lock 아래 RefCell이 꼭 필요한 특별한 이유가 없는 한 중복 계층입니다. guard 안에서 값을 복사해 밖으로 가져오면 lock을 짧게 유지할 수 있지만, guard에서 얻은 참조를 lock 밖에 저장하려는 설계는 수명상 막혀야 합니다. 무엇을 선택할지는 단순한 타입 통과가 아니라 원자화할 상태의 범위와 관찰자가 중간 상태를 볼 수 있는지를 기준으로 정합니다.

`Cell<T>`와 `RefCell<T>`의 차이도 경계를 바꾸지 않습니다. Cell은 작은 값을 borrow 없이 교체할 수 있지만 `Sync`를 제공하는 동기화 수단이 아니고, RefCell은 `borrow_mut` 중복을 같은 스레드에서 감지할 뿐입니다. 반면 `Mutex<T>`는 lock 획득 자체가 스레드 사이의 순서를 만들고 guard drop이 해제를 정하므로, 런타임 검사라는 공통 표현만 보고 두 타입을 같은 안전성 도구로 분류하면 안 됩니다.

## 득점 포인트

- Arc의 카운터와 Cell·RefCell의 내부 가변성, Mutex·Atomic의 동기화 범위를 분리합니다.
- 정확한 trait 경계와 deadlock·취소·복합 상태 같은 별도 실행 문제를 함께 짚습니다.

## 감점 포인트

- Arc가 내부 T를 자동으로 동기화하거나 thread contract가 deadlock을 해결한다고 말하지 않습니다.
- 개별 원자성이나 컴파일 성공을 복합 상태 일관성·교착 부재로 확대하지 않습니다.

## 더 파고들 거리

- 복합 불변식을 mutex·snapshot·단일 worker 중 어디에 둘지 어떤 관찰 지표로 결정할까요?
- API 경계가 바뀔 때 Send·Sync 또는 정적·동적 dispatch 요구를 어떻게 재검증할까요?

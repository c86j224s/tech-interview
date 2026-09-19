---
id: rust-rc-arc-thread-transfer
title: Rc를 다른 스레드로 옮기면 거절되는데 Arc는 언제 허용되나요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-send-sync-thread-contracts
related:
  - cpp-shared-pointer-lifetime
  - condition-variable-predicate
---
# Rc를 다른 스레드로 옮기면 거절되는데 Arc는 언제 허용되나요?

## 구두 답변

`Rc<T>`의 strong count는 단일 스레드 전제로 비원자적으로 갱신됩니다. `thread::spawn(move || drop(rc))`에서 worker로 핸들을 이동하려면 `Rc<T>: Send`가 필요하지만 이 카운터를 여러 스레드가 동시에 복사·drop해도 된다는 증명이 없어 컴파일러가 거절합니다. `Arc<T>`는 카운터 조작을 원자적으로 만들어 핸들의 수명 관리를 여러 스레드에서 할 수 있게 합니다. 하지만 이것은 첫 번째 층일 뿐입니다. `Arc<T>`를 소유한 값을 다른 스레드로 보내거나 `Arc`를 공유하려면 안쪽 `T`에도 보통 `Send + Sync` 조건이 필요합니다. 그래서 `Arc<String>`은 `String`이 값 이동과 공유 읽기를 모두 만족하므로 읽기 전용 worker에 clone해 넘길 수 있습니다. 반면 `Arc<RefCell<Vec<i32>>>`는 Arc 카운트만 원자적이고 `RefCell`의 borrow flag는 스레드 동기화가 아니므로 cross-thread 경계에서 거절됩니다. 변경이 필요하면 `Arc<Mutex<Vec<i32>>>`처럼 lock으로 한 번에 한 guard만 만들거나, 원자 단일 값·메시지 전달을 선택합니다. `Arc::clone`은 Vec의 원소를 깊게 복사하지 않고 핸들과 카운터만 늘리므로 복사 비용은 줄지만 원자 연산과 간접 접근 비용을 추가합니다. 또한 `Arc<Mutex<T>>`가 컴파일되어도 두 mutex를 서로 반대 순서로 잡는 교착, join 누락, 취소 지연까지 해결하지 않으므로 실행 프로토콜을 별도로 설계해야 합니다.

여기서 `thread::spawn`은 보통 closure가 `'static`하게 보관될 수 있어야 한다는 추가 경계도 둡니다. 즉 `Arc<String>`은 소유 핸들을 복제해 worker가 끝날 때까지 보관할 수 있지만, 단순 `&String`은 원본 스코프가 worker보다 먼저 끝날 수 있어 별도 lifetime 문제가 생깁니다. `Arc`는 이 저장 기간 문제를 해결하는 소유권 도구이지, 내부 자료구조의 논리적 atomicity를 대신하는 만능 래퍼가 아닙니다.

## 득점 포인트

- Rc의 비원자 count, Arc의 원자 count, 내부 T의 Send·Sync를 층별로 구분합니다.
- 정확한 trait 경계와 deadlock·취소·복합 상태 같은 별도 실행 문제를 함께 짚습니다.

## 감점 포인트

- Arc가 내부 T를 자동으로 동기화하거나 thread contract가 deadlock을 해결한다고 말하지 않습니다.
- 개별 원자성이나 컴파일 성공을 복합 상태 일관성·교착 부재로 확대하지 않습니다.

## 더 파고들 거리

- 두 mutex의 lock 순서와 cancellation을 instrumentation으로 어떻게 검증할까요?
- API 경계가 바뀔 때 Send·Sync 또는 정적·동적 dispatch 요구를 어떻게 재검증할까요?

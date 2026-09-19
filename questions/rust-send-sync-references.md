---
id: rust-send-sync-references
title: 'T: Send와 T: Sync는 각각 값 이동과 공유 참조 전달에 어떤 보장을 주나요?'
difficulty: 중하
category: 언어·런타임
tags:
  - rust-send-sync-thread-contracts
related:
  - cpp-shared-pointer-lifetime
  - condition-variable-predicate
---
# T: Send와 T: Sync는 각각 값 이동과 공유 참조 전달에 어떤 보장을 주나요?

## 구두 답변

`T: Send`는 T의 소유 값을 다른 스레드로 이동해도 된다는 marker trait이고, `T: Sync`는 공유 참조를 넘겨도 된다는 계약입니다. 정확히는 `T: Sync`와 `&T: Send`가 동치인 것으로 설명할 수 있습니다. 예를 들어 `thread::spawn(move || consume(value))`는 value 자체를 closure로 옮기므로 `T: Send`가 필요합니다. 반대로 여러 worker가 하나의 `&T`를 읽으려면 그 참조를 스레드 사이로 보낼 수 있어야 하므로 `T: Sync`가 필요합니다. `Arc<String>`을 clone해 worker마다 소유하게 넘기는 경우에는 핸들 전달과 안쪽 String의 공유·이동 조건이 함께 관여하므로 실제 API 경계에서는 `String: Send + Sync`를 충족해야 합니다. `Sync`라고 해서 내부에 lock이 있다는 뜻도 아니고, 교착·기아·취소 순서가 해결된다는 뜻도 아닙니다. `Arc<Mutex<T>>`는 T를 직접 Sync로 만드는 게 아니라 mutex guard를 통해 한 번에 한 접근만 노출하는 별도 계약을 제공합니다. `AtomicUsize` 두 개가 각각 Send·Sync여도 `available`을 줄이고 `total`을 갱신하는 사이 관찰자가 한쪽만 본다면 복합 상태는 깨집니다. 이 경우 하나의 mutex, 불변 snapshot 교체, 또는 단일 worker 소유권으로 불변식 전체를 묶어야 합니다. auto trait은 구성 요소에서 전파되지만 `Rc`의 비원자 count와 `UnsafeCell`의 내부 가변성처럼 자동 안전성을 막는 경계가 있습니다. 그러므로 trait 통과를 곧 업무 알고리즘의 선형성이나 deadlock 부재로 확대하지 않고, 실제 공유 경로와 상태 불변식을 따로 검증해야 합니다.

## 득점 포인트

- Send와 Sync를 값 이동과 공유 참조 전달로 정의하고 복합 불변식의 별도 보호를 말합니다.
- 정확한 trait 경계와 deadlock·취소·복합 상태 같은 별도 실행 문제를 함께 짚습니다.

## 감점 포인트

- Arc가 내부 T를 자동으로 동기화하거나 thread contract가 deadlock을 해결한다고 말하지 않습니다.
- 개별 원자성이나 컴파일 성공을 복합 상태 일관성·교착 부재로 확대하지 않습니다.

## 더 파고들 거리

- 복합 불변식을 mutex·snapshot·단일 worker 중 어디에 둘지 어떤 관찰 지표로 결정할까요?
- API 경계가 바뀔 때 Send·Sync 또는 정적·동적 dispatch 요구를 어떻게 재검증할까요?

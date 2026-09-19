---
id: rust-mutex-send-sync
title: Mutex<T>가 공유될 때 T의 Send 조건이 필요한 이유와 guard의 수명은 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-send-sync-thread-contracts
related:
  - cpp-shared-pointer-lifetime
  - condition-variable-predicate
---
# Mutex<T>가 공유될 때 T의 Send 조건이 필요한 이유와 guard의 수명은 무엇인가요?

## 구두 답변

`Mutex<T>`의 표준 조건은 자주 혼동됩니다. `Mutex<T>: Send`와 `Mutex<T>: Sync`의 구현은 모두 `T: Send`를 요구하지만, `T: Sync`까지 요구하지는 않습니다. `Send`가 필요한 이유는 mutex 자체나 `into_inner`로 보호된 값을 다른 스레드의 소유권으로 옮길 수 있어야 하기 때문입니다. `Sync` 쪽에서는 한 순간에 하나의 `MutexGuard`만 T에 접근하므로, T의 공유 참조를 여러 스레드가 동시에 직접 들고 있어야 한다는 조건은 필요하지 않습니다. `let total = Arc::new(Mutex::new(0)); { let mut guard = total.lock().unwrap(); *guard += 1; }`에서 guard는 T에 대한 임시 대여이며, 블록을 빠져나갈 때 Drop되어 잠금을 풉니다. `let guard = total.lock().unwrap(); use_guard(&guard); do_io();`처럼 이름 있는 guard가 살아 있는 동안에는 I/O까지 임계 구역에 들어갑니다. 계산에 필요한 숫자만 `let snapshot = *guard`로 복사한 후 guard를 drop하고 외부 호출을 하는 편이 대기 시간을 줄입니다. lock 순서가 작업 A는 M1→M2, 작업 B는 M2→M1이면 두 작업이 각각 첫 잠금을 잡은 뒤 영원히 기다릴 수 있으며 Rust가 이를 막아 주지는 않습니다. 다른 스레드 panic 뒤 `lock()`이 `PoisonError`를 반환할 수 있는데, poison은 메모리 접근 자체가 불안전하다는 뜻이 아니라 보호 불변식이 중간 상태일 가능성을 알리는 정책입니다. `into_inner()`로 복구할 수 있어도 상태를 검증한 뒤 정상화해야 하며 무조건 `unwrap`하는 것은 업무 오류를 숨길 수 있습니다.

## 득점 포인트

- Mutex<T>의 Send/Sync 조건을 정확히 말하고 guard drop·poison을 실행 경계와 연결합니다.
- 인덱스 저장, lock scope, heap allocation처럼 안전성 이후의 의미·비용 경계까지 언급합니다.

## 감점 포인트

- Mutex가 T를 Sync로 만든다고 하거나 poison을 무조건 데이터 손상으로 단정하지 않습니다.
- 개별 원자성이나 컴파일 성공을 복합 상태 일관성·교착 부재로 확대하지 않습니다.

## 더 파고들 거리

- 두 mutex의 lock 순서와 cancellation을 instrumentation으로 어떻게 검증할까요?
- Vec·Mutex·trait object를 실제 toolchain에서 어떤 최소 컴파일 예제로 확인할까요?

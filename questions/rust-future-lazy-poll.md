---
id: rust-future-lazy-poll
title: async 함수를 호출해 Future만 만들었는데 작업이 시작되지 않습니다. poll과 executor는 무엇을 맡나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Rust
  - Future
  - async
  - executor
related:
  - async-api-and-blocking
  - cpp-coroutine-frame-lifetime
---
# async 함수를 호출해 Future만 만들었는데 작업이 시작되지 않습니다. poll과 executor는 무엇을 맡나요?

## 구두 답변

`async fn` 호출은 결과값을 즉시 계산하지 않고 future라는 지연된 상태 기계를 만듭니다. `let f = load();`만 실행하면 `load` 본문이 끝까지 진행되지 않으며, `f.await`, `spawn(f)`, 또는 `block_on(f)`처럼 누군가 future를 poll하는 경로가 있어야 합니다. 첫 poll이 `await` 전까지 진행해 I/O를 등록하고 `Pending`을 반환했다고 하겠습니다. readiness가 생겨 다시 poll되면 저장된 상태를 읽고 `Ready(42)`를 반환합니다. executor는 이 poll 호출의 시점과 task 소유권을 관리하지만, `await`가 내부 blocking I/O를 자동으로 다른 스레드로 옮긴다는 뜻은 아닙니다. Waker는 다시 poll할 기회를 알리고, 완료값을 대신 전달하지 않습니다.

```text
생성: Start
poll #1: I/O 등록 -> Pending
wake 이후 poll #2: readiness 확인 -> Ready(42)
```

구체적으로 `async fn load() -> u32 { 42 }`처럼 대기점이 없는 본문은 첫 poll에서 바로 `Ready(42)`가 될 수 있습니다. 반대로 소켓 대기가 있으면 첫 poll은 이벤트 등록까지 진행하고 `Pending`을 반환합니다. async라는 표기만으로 반드시 두 번 poll되거나 스레드가 바뀌는 것은 아닙니다. `spawn`도 언어 기능이 아니라 선택한 runtime의 함수이므로, 호출한 순간 언제 첫 poll을 하는지는 그 runtime 계약을 확인합니다.

진단은 future 생성 로그와 본문 진입 로그를 분리하는 것으로 시작하겠습니다. 생성만 기록됐다면 await·spawn 경로가 빠졌는지, 첫 poll 뒤 멈췄다면 readiness와 waker가 연결됐는지를 봅니다. poll이 오래 반환하지 않는다면 동기 파일 읽기나 긴 CPU 반복문이 실행기를 점유할 수 있습니다. 이 경우 작업을 runtime이 제공하는 제한된 blocking pool로 옮기거나 계산을 작은 단위로 나눕니다. Ready가 된 future를 임의로 계속 poll하는 것도 일반 계약에 포함되지 않으므로 완료 상태를 회수하고 제거해야 합니다.

## 득점 포인트

- future 생성과 future 진행을 구분하고, 저장 후 drop되는 경로까지 설명합니다.
- `Pending`은 실패가 아니며 다음 poll에서 상태를 재확인한다는 점을 말합니다.
- executor의 스케줄링과 blocking 작업을 별도 pool로 보내는 runtime 기능을 구분합니다.

## 감점 포인트

- `async fn` 호출만으로 백그라운드 스레드가 시작된다고 말합니다.
- `wake()`가 `Ready` 값을 직접 반환하거나 `Pending`이 영구 실패라고 설명합니다.
- `await`만 붙이면 파일·CPU·동기 네트워크 호출까지 논블로킹이 된다고 단정합니다.

## 더 파고들 거리

- Future를 직접 poll하는 최소 실행기는 어떤 `RawWaker` 수명과 재진입 규칙을 가져야 하나요?
- `Ready` 뒤 재-poll을 정상 계약으로 의존하지 않도록 executor는 완료 task를 언제 제거해야 하나요?

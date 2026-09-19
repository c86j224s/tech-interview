---
id: rust-waker-pending-progress
title: Future가 Pending을 반환한 뒤 다시 poll되지 않습니다. Waker 등록과 깨움에서 무엇을 확인하나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Rust
  - Future
  - Waker
  - readiness
related:
  - async-api-and-blocking
  - cpp-coroutine-frame-lifetime
---
# Future가 Pending을 반환한 뒤 다시 poll되지 않습니다. Waker 등록과 깨움에서 무엇을 확인하나요?

## 구두 답변

`wake()`는 완료를 알리는 값이 아니라 task가 다시 `poll`을 시도할 기회입니다. 재개가 끊겼다면 `poll 시작 → readiness 관찰 → 현재 Context의 waker 등록 → 외부 이벤트 → wake 호출 → executor의 다음 poll` 순서로 확인합니다. 예를 들어 future가 먼저 `readable=false`를 읽고, 그 뒤 데이터가 도착한 다음 waker를 등록하면 이미 발생한 이벤트를 놓칠 수 있습니다. 안전한 I/O primitive은 등록과 재확인을 묶거나 등록 후 readiness를 다시 보게 합니다. waker가 호출되어도 다음 poll에서 readiness가 사라져 다시 `Pending`이 될 수 있으며, queue enqueue·중복 wake 제거·실행 시점은 executor 구현 계약입니다. poll마다 Context의 waker가 달라질 수 있으므로 이전 waker를 영원히 보관하지 말고 같은 task인지 비교해 교체합니다.

예를 들어 처음 poll에서 이벤트 소스의 상태가 `ready=false`이고 현재 waker가 W1이라고 하겠습니다. W1을 저장하기 직전에 producer가 ready를 true로 바꾸고 옛 waker만 깨우면, 등록 뒤 바로 Pending으로 돌아가는 구현은 아무도 다시 깨우지 않는 상태에 빠질 수 있습니다. 따라서 검증된 primitive의 등록·재검사 프로토콜을 쓰고, 둘 사이에 이벤트를 주입하는 테스트를 만들어야 합니다. 단순히 주기적으로 poll을 반복하는 busy loop로 증상을 숨기면 CPU 비용과 공정성 문제가 생깁니다.

또한 wake가 여러 번 발생했다고 poll 횟수도 반드시 같지는 않습니다. 실행기는 여러 알림을 한 번의 재시도로 합칠 수 있고, poll 전에 다른 소비자가 데이터를 가져가 readiness가 사라질 수도 있습니다. 완료 여부는 wake 횟수가 아니라 다음 poll이 읽은 상태로 결정합니다. 객체를 제거할 때는 이벤트 소스가 보유한 waker의 수명과 등록 해제를 정리해야 하며, 오래된 task를 계속 깨우는 현상은 진행 보장이 아니라 수명 누수일 수 있습니다.

## 득점 포인트

- lost-wakeup의 구체 순서와 등록 후 재확인이라는 해결 방향을 제시합니다.
- wake, executor enqueue, 다음 poll, Ready 판정을 각각 다른 사건으로 분리합니다.
- waker 변경과 중복 wake가 정상일 수 있음을 설명합니다.

## 감점 포인트

- `wake()`가 결과값을 future 내부에 넣거나 반드시 즉시 한 번만 poll한다고 말합니다.
- readiness 확인과 등록의 순서가 중요하지 않다고 설명합니다.
- executor가 아무리 좋아도 future가 waker를 저장하지 않은 문제를 해결한다고 가정합니다.

## 더 파고들 거리

- 등록 함수가 즉시 callback을 호출할 수 있을 때 poll 재진입과 이중 resume을 어떻게 막나요?
- 취소와 늦은 이벤트가 동시에 오면 waker 저장소의 task 수명을 어떤 순서로 정리하나요?

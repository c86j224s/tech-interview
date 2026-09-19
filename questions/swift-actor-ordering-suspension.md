---
id: swift-actor-ordering-suspension
title: 같은 actor에 보낸 두 작업의 await 이전 코드가 전체 메서드 동안 독점된다고 볼 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 모바일
tags:
  - Swift
  - actor
  - await
  - reentrancy
related:
  - swift-completion-cancel-once
---
# 같은 actor에 보낸 두 작업의 await 이전 코드가 전체 메서드 동안 독점된다고 볼 수 없는 이유는 무엇인가요?

## 구두 답변

actor는 한 시점에 하나의 actor-isolated 구간을 실행하지만, async 메서드가 `await`에서 중단되면 그 메서드가 반환할 때까지 executor를 계속 점유하지 않습니다. A가 `version=4`를 읽고 외부 저장을 기다리는 동안 B가 실행되어 version을 5로 올릴 수 있습니다. A가 재개되면 A의 앞부분은 이미 지나갔으므로 version 5를 보고 결과를 폐기하거나 재계산해야 합니다. 따라서 actor가 data race를 줄인다는 보장과 메서드 전체의 FIFO·transaction 보장은 서로 다릅니다.

순서를 요구한다면 호출 도착 순서에 기대지 않고 await 전 짧은 동기 구간에서 sequence number나 reservation을 발급하고, 외부 결과는 그 세대에만 적용합니다. 네트워크를 actor 내부에서 blocking 방식으로 실행해 독점을 흉내 내면 다른 요청이 모두 기다리는 병목이 되므로, 외부 I/O를 기다리는 동안에는 양보하고 재개 후 검증하는 편이 낫습니다.

또한 호출 순서와 실행 순서를 로그에서 분리해야 합니다. A가 sequence 10을 발급하고 await한 다음 B가 sequence 11을 끝냈다고 해서, 서버 callback의 도착 순서가 10, 11로 유지되는 것은 아닙니다. 업무가 “마지막 저장만 유효”라면 version 비교로 10의 늦은 결과를 폐기하고, “모든 명령을 순서대로 반영”해야 한다면 외부 호출을 시작하기 전 actor 안에 명령 큐를 두어야 합니다.
즉, actor의 보호 범위는 memory safety와 isolation이지 외부 시스템의 commit ordering이 아닙니다. 외부 저장소도 순서를 요구한다면 client sequence만 믿지 말고 서버 version 또는 conditional write를 함께 사용해야 합니다.
## 득점 포인트

- A의 await, B의 version 갱신, A의 재개라는 시간 순서를 보여 줍니다.
- “동시에 저장하지 않음”과 “await 사이 interleaving 가능”을 분리합니다.
- FIFO가 필요할 때 sequence·queue·reservation을 별도로 설계한다고 답합니다.

## 감점 포인트

- actor executor가 async 메서드 시작부터 반환까지 계속 잠긴다고 단정합니다.
- B가 A와 같은 메모리를 동시에 쓰는 data race만 문제라고 설명합니다.
- 순서 보장을 위해 actor에서 blocking 네트워크 I/O를 실행해도 된다고 말합니다.

## 더 파고들 거리

- 외부 결과가 순서 역전될 때 version 검증과 reservation의 실패 비용을 비교해 보세요.
- 논리 호출 순서와 실제 callback 도착 순서를 로그에서 어떻게 구분할지 설계해 보세요.

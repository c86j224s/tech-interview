---
id: swift-async-let-scope-join
title: Swift async let을 만든 scope가 결과를 await하기 전에 끝나면 자식 작업의 취소와 대기는 어떻게 되나요?
difficulty: 중하
category: 모바일
tags:
  - Swift
  - Sendable
  - structured concurrency
  - TaskGroup
related:
  - swift-completion-cancel-once
---
# Swift async let을 만든 scope가 결과를 await하기 전에 끝나면 자식 작업의 취소와 대기는 어떻게 되나요?

## 구두 답변

`async let`은 enclosing scope에 속한 child task이므로 parent가 결과를 읽지 않고 끝나도 child가 detached처럼 계속 떠돌지 않습니다. 정상적으로 scope를 빠져나갈 때도 아직 실행 중인 child를 정리하며 기다리고, 오류가 scope 밖으로 전파되는 경로에서는 남은 child에 cancellation request를 보낸 뒤 실제 완료를 기다립니다. 취소는 cooperative이므로 child가 확인하지 않거나 취소 가능한 API가 반환하지 않으면 scope 종료가 늦어집니다.

예를 들어 A는 20ms, B는 200ms이고 parent가 50ms에 오류를 던진다면 B는 50ms에 취소 요청을 받지만 즉시 사라진다고 할 수 없습니다. B가 70ms에 취소를 확인하면 scope 반환도 그 뒤가 되고, 취소를 무시하면 200ms까지 파일·connection을 점유할 수 있습니다. 사용자 응답을 먼저 보내고 작업을 계속해야 한다면 async let이 아니라 내구 job과 명시적 owner를 설계해야 합니다.

정상 return의 경우도 `async let value`를 읽지 않았다는 이유로 child가 scope 밖으로 탈출하지 않습니다. scope 정리 시점에 child 결과를 기다리는 것이 구조적 계약이므로, 짧은 UI 응답을 위해 오래 걸리는 child를 숨겨 놓는 용도로 async let을 쓰면 latency가 예상보다 커집니다. 반대로 내구 큐는 결과를 저장하고 별도 worker가 재시작할 수 있어야 하므로 취소·대기 계약이 async let과 다릅니다.
이 대기는 “결과를 사용하지 않았으니 비용이 없다”는 직관과 반대입니다. scope 경계가 child의 소유자이므로 parent 함수의 latency 예산에 child cleanup 시간을 포함하고, 독립 실행이 필요한 요구는 저장된 job 상태로 옮겨야 합니다.
## 득점 포인트

- child의 scope 귀속과 정상·예외 종료 시 대기를 설명합니다.
- 50ms 취소 요청과 70ms 또는 200ms 실제 종료를 구분합니다.
- 응답보다 긴 작업에 detached를 무작정 쓰지 않고 durable job·supervisor를 제시합니다.

## 감점 포인트

- parent가 return하는 즉시 child가 백그라운드에서 독립 실행된다고 말합니다.
- cancel 호출이 반환되면 파일과 connection을 바로 재사용해도 된다고 봅니다.
- 독립 내구 작업 문제를 `Task.detached`로 바꾸는 것만으로 해결합니다.

## 더 파고들 거리

- child가 취소를 무시할 때 사용자 응답 deadline과 자원 최대 수명을 각각 제한하는 방법을 설계해 보세요.
- 고정된 두 결과에는 async let, 동적 fan-out과 부분 실패에는 task group을 선택하는 기준을 비교해 보세요.

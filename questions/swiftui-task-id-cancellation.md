---
id: swiftui-task-id-cancellation
title: '.task(id: query)에서 query 변경 뒤 이전 결과를 다시 검사해야 하는 이유는 무엇인가요?'
difficulty: 중하
category: 모바일
tags:
  - SwiftUI
  - identity
  - State
  - diffing
related:
  - ios-navigation-view-retention
---
# .task(id: query)에서 query 변경 뒤 이전 결과를 다시 검사해야 하는 이유는 무엇인가요?

## 구두 답변

`.task(id: query)`는 query identity가 바뀔 때 이전 task에 cancellation을 요청하고 새 task를 시작하는 수명 장치이지, 네트워크 결과를 최신순으로 정렬하는 계약은 아닙니다. `ab` 요청이 t=0에 시작되고 t=10에 `abc`로 query가 바뀌면 `ab` 취소 요청과 `abc` 새 작업이 생깁니다. `abc`가 t=50에 도착해 적용된 뒤 `ab`가 t=80에 도착할 수 있으므로, 결과 적용 직전에 MainActor에서 현재 query와 request generation을 다시 검사해야 합니다.

불일치하면 UI state에는 쓰지 않지만, 이미 서버에서 처리된 효과나 cache write가 자동 rollback되지는 않습니다. URLSession의 실제 종료와 cancellation request도 별개이므로 로그에서 구분합니다. view active 여부까지 검사하면 화면이 사라진 뒤 늦은 결과가 새 화면 상태를 덮는 것도 막을 수 있습니다. deduplication이나 exactly-once가 필요하면 actor coordinator와 서버 멱등 key를 별도로 둡니다.

현재 generation을 `1`에서 `2`로 올리는 순간 `ab` task에 취소 요청을 보내고, 결과 closure가 실행되더라도 `result.generation == currentGeneration`일 때만 state를 씁니다. 네트워크 API가 cancellation을 무시하거나 이미 response를 큐에 넣었어도 이 마지막 guard가 늦은 UI 반영을 막습니다. 다만 cache에는 `ab`의 유효한 데이터가 필요할 수 있으므로 cache 저장과 화면 표시를 같은 guard로 묶지 말고 각각의 freshness 정책을 둡니다.
세대 검사는 네트워크가 순서대로 반환된다는 가정을 없애는 마지막 방어선입니다. task cancellation을 요청한 직후 화면이 사라지는 경우에도 MainActor의 active 상태를 함께 확인해, 오래된 결과가 새 view tree에 쓰이지 않도록 합니다.
## 득점 포인트

- query 변경, cancellation request, 실제 I/O 종료, 늦은 결과 폐기의 네 단계를 추적합니다.
- `ab` 80ms와 `abc` 50ms의 순서 역전을 구체적으로 설명합니다.
- generation 검사와 UI mutation을 같은 MainActor 구간에서 수행한다고 답합니다.

## 감점 포인트

- task cancellation이 이미 실행된 callback을 절대 막는다고 말합니다.
- 새 query task가 시작되면 완료 순서도 자동으로 최신순이라고 가정합니다.
- UI에서 결과를 버린 것을 서버 취소나 외부 효과 rollback으로 설명합니다.

## 더 파고들 거리

- `ab` 결과를 cache에는 저장하되 화면에는 적용하지 않으려면 cache generation과 UI generation을 어떻게 분리할지 설계해 보세요.
- `.task(id:)`와 actor 검색 coordinator를 함께 사용할 때 deduplication·취소·결과 owner를 어느 계층에 둘지 비교해 보세요.

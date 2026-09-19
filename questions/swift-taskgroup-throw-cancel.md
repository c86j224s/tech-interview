---
id: swift-taskgroup-throw-cancel
title: withThrowingTaskGroup에서 child 하나가 throw하면 다른 child에는 어떤 취소와 대기가 적용되나요?
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
# withThrowingTaskGroup에서 child 하나가 throw하면 다른 child에는 어떤 취소와 대기가 적용되나요?

## 구두 답변

오류 전파, 취소 요청, 실제 child 종료를 세 단계로 나눠야 합니다. `withThrowingTaskGroup`의 `next()`가 child 오류를 관찰하고 body가 그 오류를 밖으로 던지는 경로가 되면 남은 child에는 cancellation request가 전달됩니다. 하지만 취소는 강제 kill이 아니라 협력 신호입니다. sibling이 `Task.isCancelled`를 확인하거나 취소 가능한 URLSession 작업이 반환해야 실제 종료하며, structured scope는 child 정리와 대기를 거친 뒤 반환합니다.

예를 들어 profile이 20ms에 throw하고 recommendation이 원래 300ms 걸린다면 20ms에 오류를 관찰해도 recommendation의 cleanup이 25ms일 수도 300ms까지 걸릴 수도 있습니다. 서버가 이미 추천 생성 같은 효과를 만들었다면 Swift 취소가 서버 rollback을 보장하지 않습니다. 필수 작업은 오류를 전파하되 선택 작업은 `Result` 상태로 수집하는 등 API 응답 정책도 group 밖에서 설계합니다.

예를 들어 profile child가 오류를 던진 시각이 20ms이고 recommendation child가 80ms에 `Task.isCancelled`를 검사한다면 group의 외부 오류 관찰과 실제 resource release 사이에는 60ms가 있습니다. recommendation이 취소를 검사하지 않고 300ms에 정상 응답하면 scope가 그때까지 기다릴 수 있습니다. 따라서 timeout을 추가하더라도 서버 작업 중단, 로컬 task 종료, 사용자에게 반환하는 오류를 각각 기록해야 하며, 단순히 첫 오류 문자열만 저장하면 운영 대사가 불가능합니다.
group 내부에서 오류를 수집해 정상 값으로 바꾸는 선택을 하더라도 cancellation 상태를 숨기지 않습니다. 관찰자에게는 `profile=failed`, `recommendation=cancelled`처럼 서로 다른 상태를 보여 주어 재시도 대상과 이미 처리된 외부 효과를 구별하게 합니다.
## 득점 포인트

- child 오류 관찰, sibling cancellation request, 실제 종료·scope 반환을 시간 순서로 분리합니다.
- cooperative cancellation이라 child 코드와 I/O API가 실제 종료 시간을 좌우한다고 설명합니다.
- 필수 실패와 선택 실패를 throw 전파와 partial result 수집으로 구분합니다.

## 감점 포인트

- 한 child가 throw하는 순간 형제 child가 즉시 kill된다고 말합니다.
- group 오류 반환 시 connection과 파일이 이미 재사용 가능하다고 단정합니다.
- 원래 네트워크 실패와 취소로 종료된 sibling을 같은 오류 하나로 덮습니다.

## 더 파고들 거리

- 취소를 무시하는 child가 있을 때 parent 응답 deadline과 실제 자원 최대 수명을 어떻게 분리할지 설계해 보세요.
- partial success를 반환할 때 필수 결과·선택 결과·재시도 대상을 어떤 schema로 표현할지 설명해 보세요.

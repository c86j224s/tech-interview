---
id: swift-detached-sendable-capture
title: class를 Task.detached에 캡처할 때 Sendable 경고가 생기는 핵심 이유는 무엇인가요?
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
# class를 Task.detached에 캡처할 때 Sendable 경고가 생기는 핵심 이유는 무엇인가요?

## 구두 답변

`class`는 reference identity를 가지므로 여러 concurrency domain이 같은 mutable 저장소를 볼 수 있습니다. `Task.detached`는 현재 actor context와 분리된 `@Sendable` closure를 실행하므로, 그 안에 non-Sendable mutable class나 `self`를 캡처하면 “누가 동시에 `var`를 바꿔도 안전한가”라는 계약을 입증해야 합니다. `let cache`로 reference를 묶어도 `cache.value`는 여전히 바뀔 수 있습니다. 경고의 정확한 오류 여부는 Swift 언어 모드와 strict concurrency 설정에 따라 달라집니다.

해결은 `@unchecked Sendable`을 먼저 붙이는 것이 아닙니다. owner에서 필요한 값만 `Sendable` DTO로 읽어 detached 작업에 보내고 결과는 owner executor에서 반영합니다. 공유 상태가 필요하면 actor가 cache를 소유하게 하고 `await`로 접근합니다. lock 기반 class는 lock 범위와 초기화·callback 수명을 검토한 뒤에만 unchecked 적합성을 선택합니다. 또한 detached는 structured parent의 자동 대기·취소를 제공하지 않으므로 별도 수명도 설계해야 합니다.

작은 상태 추적은 `cache.value=0`에서 detached 작업이 1을 읽고 owner가 동시에 2를 쓰는 경우입니다. 컴파일러가 경고를 내는 핵심은 “이 두 줄이 반드시 경합한다”가 아니라, closure가 reference를 이동시켜 이런 경합을 막을 소유권 증거가 없다는 점입니다. DTO 방식이라면 `initial=0`을 worker가 1로 계산한 뒤 MainActor나 actor owner가 현재 version을 확인하고 적용합니다. detached 결과가 늦으면 결과를 버릴 수 있지만, 계산에 든 CPU 시간은 이미 지불됩니다.
## 득점 포인트

- class의 reference identity와 mutable state 공유를 Sendable 경계의 문제로 연결합니다.
- `let` binding과 내부 `var`의 차이를 `cache.value` 예로 설명합니다.
- DTO 추출·actor owner·검증된 lock의 선택과 detached 수명 단절을 함께 말합니다.

## 감점 포인트

- detached가 background thread에서 돈다는 이유만으로 모든 캡처가 안전하다고 합니다.
- `let`으로 캡처하면 참조 대상의 mutable property도 불변이라고 설명합니다.
- `@unchecked Sendable`을 경고 제거용 annotation으로만 사용합니다.

## 더 파고들 거리

- actor와 detached가 같은 cache 객체를 각각 보관하지 않도록 mutation owner를 하나로 정하는 방법을 설명해 보세요.
- detached 결과가 화면 세대보다 늦게 도착할 때 generation 검사와 최대 수명을 어떻게 둘지 비교해 보세요.

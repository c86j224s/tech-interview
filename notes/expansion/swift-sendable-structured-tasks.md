---
id: swift-sendable-structured-tasks
title: Swift Sendable과 구조적 작업 전달
topic: 모바일
summary: Sendable 전달 계약과 child task·task group 수명·취소를 연결합니다.
questionIds: []
prerequisites:
  - ios-runtime-storage
  - arc-ownership
related:
  - swift-actor-reentrancy
  - arc-ownership
  - request-task-lifetime
reviewedAt: '2026-09-19'
---
# Swift Sendable과 구조적 작업 전달

`Sendable`과 structured concurrency는 서로 다른 실패를 다룹니다. Sendable은 값을 다른 concurrency domain으로 넘길 때 그 값의 소유권과 mutable state가 안전하다는 정적 계약이고, `async let`·task group은 child task가 어느 scope에 속하고 언제 끝나야 하는지를 정합니다. Sendable 값이라도 detached 작업의 수명이 자동 관리되는 것은 아니며, child task라도 취소를 즉시 따르는 것은 아닙니다. 아래 코드는 설명용이며 이 환경에서 Swift 컴파일러로 실행하지 않았습니다.

## Sendable 의미

`Int`, `String`, 불변 값 타입처럼 내부 구성도 전달 가능한 값은 concurrent closure로 복사해 보내기 쉽습니다. 반면 mutable `class`는 여러 실행 단위가 같은 reference를 가리킬 수 있어, 현재 테스트에서 경합이 없었다는 사실만으로 Sendable이 되지 않습니다. `let cache`는 reference binding만 고정할 뿐 `cache.value`의 mutable 저장 공간을 불변으로 만들지 않습니다.

실제 선택은 필요한 필드를 `struct RequestInput: Sendable`로 추출하거나, mutable state를 actor가 소유하게 하거나, lock과 불변식을 완전히 구현한 reference를 검토하는 순서입니다. `@unchecked Sendable`은 컴파일러 검사를 개발자가 대신 서명하는 것이므로 lock 범위, callback lifetime, 초기화 순서를 별도로 입증해야 합니다.

## 캡처와 domain 이동

`@Sendable` closure에 `self`를 캡처하면 self 내부의 delegate·cache·UI object까지 함께 이동할 수 있습니다. detached 작업은 현재 actor와 priority·task-local context가 분리되므로 이 경계를 더 선명하게 드러냅니다.

```swift
final class Cache { var value = 0 }
let cache = Cache()
let job = Task.detached { @Sendable in
    cache.value += 1
    return cache.value
}
```

이 코드는 설명용이며 strict concurrency 수준과 언어 모드에 따라 경고 또는 오류의 표현은 다를 수 있습니다. 안전한 trace는 owner가 `cache.value`를 읽어 `let initial: Int`로 snapshot한 뒤 detached 작업에는 `initial`만 전달하고, 결과를 원래 owner가 다시 적용하는 방식입니다. actor reference를 전달하는 선택도 가능하지만 actor 내부 프로퍼티를 background에서 직접 읽는 것과 reference를 보관하는 것은 다른 행동입니다.

## MainActor 경계

`@MainActor`는 UI 상태에 접근할 executor를 제한하는 격리 계약입니다. Sendable은 다른 domain 이동 가능성을 말합니다. `@MainActor` 객체의 reference를 closure가 보관할 수 있더라도 `title`이나 `items`를 background에서 동기 읽어도 된다는 뜻은 아닙니다. worker는 `SearchInput(query: String)`과 같은 Sendable DTO를 받고, 결과를 MainActor-isolated 메서드로 돌려보냅니다.

검색어가 `ab`에서 `abc`로 바뀐 경우 worker 결과가 MainActor에 도착하면 현재 query와 generation을 같은 격리 구간에서 검사합니다. 이 검사는 Sendable을 보완하지만 대체하지는 않습니다. DTO 안에 mutable reference를 숨겨 넣으면 구조체 포장만으로 소유권 문제가 해결되지 않습니다.

## 구조적 수명

`async let`과 task group child는 parent scope에 속합니다. 정상 return이라도 scope가 끝날 때 아직 실행 중인 child를 정리하며 기다려야 하고, 오류가 scope 밖으로 탈출하면 남은 child에 취소 요청이 전달된 뒤 완료를 기다립니다. 취소는 kill 명령이 아니라 cooperative flag와 취소 가능한 API의 응답에 의존합니다.

반대로 `Task.detached`는 같은 자동 parent-child 수명에 들어가지 않습니다. 화면 요청이 끝났는데 detached가 계속 실행되면 결과 owner, 최대 수명, 재시작 정책을 직접 설계해야 합니다. 앱 재실행 뒤에도 반드시 이어져야 하는 일은 detached가 아니라 내구 큐·서버 작업·복원 가능한 worker 문제입니다.

## async let 추적

A가 20ms, B가 200ms 걸리고 parent가 50ms에 오류를 던지는 모형을 보겠습니다.

```text
t=0   A와 B 생성
t=20  A 완료
t=50  parent 오류 탈출, B에 cancellation request
t=70  B가 취소 확인하고 종료 -> scope 반환
t=200 B가 취소를 무시 -> 그때까지 scope 대기
```

따라서 `cancel` 요청 시각과 파일·connection을 재사용할 수 있는 시각은 다릅니다. parent가 사용자에게 실패를 보이는 설계라도 구조적 scope가 반환되기 전 child cleanup을 기다리는지 확인해야 합니다. 응답을 먼저 보내야 한다면 child를 구조 밖으로 빼는 순간 그 owner와 누수 상한을 명시해야 합니다.

## throwing group 오류

`withThrowingTaskGroup`에서 `next()`가 child 오류를 관찰해 throw하면 body가 오류를 밖으로 전파하는 경로가 됩니다. 이때 남은 child에 cancellation request가 가고, group scope는 child들의 종료를 정리합니다. 다른 child의 서버 요청이 이미 효과를 만들었다면 Swift cancellation이 서버 rollback을 보장하지 않습니다.

필수 작업 실패와 선택 작업 실패를 다르게 표현하려면 child가 `Result`나 도메인별 상태를 반환하도록 설계해 일부 성공을 수집할 수 있습니다. 그렇지 않고 `next()` 오류 하나만 대표 오류로 반환하면 원래 실패와 취소로 인한 종료를 로그에서 구분해야 합니다.

## 구현 선택

공유 mutable cache를 여러 worker가 건드린다면 actor owner를 두고 `await cache.read`·`await cache.write`로 접근합니다. 계산만 detached로 보낼 때는 값 snapshot만 캡처합니다. MainActor는 UI 적용만 맡기고 파일·네트워크는 바깥에서 수행합니다. task group은 모든 결과가 scope에 필요한 fan-out에, async let은 고정된 소수의 병렬 결과에, 내구 작업은 별도 큐에 맞습니다.

## 실패와 검증

검증표에는 전달한 타입, closure 캡처 목록, actor/domain 경계, child 생성·완료·취소 요청·실제 종료 시각을 기록합니다. 하나의 child가 throw하는 테스트에서 sibling이 `Task.isCancelled`를 확인하는 경우와 무시하는 경우를 나눕니다. 20ms/200ms trace처럼 cleanup 시각을 계산하고, group 반환 뒤에도 서버 효과가 남는 경로를 원장으로 확인합니다.

```diagram
{"title":"전달 계약과 작업 수명","caption":"Sendable은 값이 domain을 건너는 안전성을, structured scope는 child의 생성·취소·대기를 다룹니다.","rows":[[{"id":"owner","label":"상태 owner","detail":["mutable state 소유"]}],[{"id":"dto","label":"Sendable DTO","detail":["필드 snapshot"]},{"id":"scope","label":"구조적 scope","detail":["child 수명"]}],[{"id":"child","label":"child worker","detail":["취소 협력"]}],[{"id":"apply","label":"owner 반영","detail":["격리된 적용"]}]],"edges":[{"from":"owner","to":"dto","label":"값 추출"},{"from":"owner","to":"scope","label":"child 생성"},{"from":"dto","to":"child","label":"domain 전달"},{"from":"scope","to":"child","label":"수명 관리"},{"from":"child","to":"apply","label":"결과 반환"}]}
```

## 비용과 한계

값 snapshot은 복사 비용과 stale 결과 폐기 비용이 있지만 공유 경합을 줄입니다. actor는 소유권을 명확히 하지만 한 actor에 무거운 I/O를 넣으면 병목이 됩니다. structured scope는 누수 없는 정리를 얻는 대신 느린 child가 parent 반환을 지연시킵니다. detached는 응답을 분리할 수 있지만 취소·backpressure·재실행·결과 owner를 모두 직접 만들어야 합니다.

## 참고자료

- SE-0302 Concurrent Value and Concurrent Closures: https://raw.githubusercontent.com/swiftlang/swift-evolution/main/proposals/0302-concurrent-value-and-concurrent-closures.md (Sendable과 @Sendable 캡처 계약)
- SE-0304 Structured Concurrency: https://raw.githubusercontent.com/swiftlang/swift-evolution/main/proposals/0304-structured-concurrency.md (child scope, cancellation, awaiting)
- Apple Sendable: https://developer.apple.com/documentation/swift/sendable (이 배치에서는 본문을 읽지 못했으므로 진단 문구의 직접 근거로 사용하지 않음)

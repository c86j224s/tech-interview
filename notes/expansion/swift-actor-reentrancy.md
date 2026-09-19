---
id: swift-actor-reentrancy
title: Swift actor의 재진입과 격리
topic: 모바일
summary: Actor 격리와 await suspension을 나누고 재개 후 상태 재검증을 설명합니다.
questionIds: []
prerequisites:
  - ios-runtime-storage
  - observation-contracts
related:
  - arc-ownership
  - async-execution
reviewedAt: '2026-09-19'
---
# Swift actor의 재진입과 격리

Swift actor는 mutable state에 대한 접근을 한 실행 영역으로 모으지만, `async` 메서드 전체를 끝까지 잠그는 transaction은 아닙니다. actor-isolated 코드가 `await`에서 중단될 수 있고, 그 사이 같은 actor의 다른 작업이 실행됩니다. 따라서 안전성은 “동시에 두 쓰기가 일어나지 않는다”와 “내가 읽었던 조건이 재개 뒤에도 유효하다”를 나누어 설명해야 합니다. 이 장의 수치는 설명용 계산이며 Swift 컴파일러나 iOS 기기에서 실행한 결과가 아닙니다.

## 격리 경계

actor의 저장 프로퍼티를 일반 동기 호출자가 직접 읽지 못하는 이유는 호출자의 스레드가 무엇인지보다, 읽는 순간 actor executor에 어떤 순서를 예약한다는 계약이 없기 때문입니다. actor 내부의 짧은 동기 구간은 그 actor에서 다른 actor-isolated 구간과 겹치지 않으므로 `available` 확인과 예약 생성처럼 함께 보존해야 하는 invariant를 묶을 수 있습니다. 그러나 외부 API를 기다리기 위해 `await`를 넣으면 그 구간은 둘로 나뉩니다.

`await wallet.balance`처럼 경계를 넘는 접근은 특정 시점의 값을 snapshot으로 받아오는 행위입니다. snapshot이 미래에도 맞는다는 약속은 아닙니다. `nonisolated`는 이 경계를 무조건 없애는 키워드가 아니라 actor mutable state와 독립적인 immutable 메타데이터나 순수 계산을 선언하는 선택입니다. 현재 잔액을 반환하는 프로퍼티에 붙여 격리를 우회하려 하면 상태 소유권을 잃게 됩니다.

## suspension 지점

`await`는 반드시 실제 중단된다는 뜻은 아니지만, 중단 가능성이 있는 지점을 표시합니다. 캐시 적중처럼 즉시 완료되는 경로도 있고, 네트워크 응답을 기다리며 actor executor를 양보하는 경로도 있습니다. 실제 중단이 일어나면 함수는 재개 지점 다음부터 계속되고, 같은 메서드의 앞부분이 자동으로 다시 실행되지는 않습니다. 그러므로 await 전의 `balance`와 await 후의 `balance`를 같은 사실로 취급하면 안 됩니다.

재진입은 data race와 다릅니다. 두 조각이 같은 순간 메모리를 동시에 쓰는 것이 아니라, 첫 조각이 양보한 틈에 둘째 조각이 상태를 읽고 갱신한 뒤 첫 조각이 돌아오는 interleaving입니다. actor는 이 겹침을 격리하지만 비즈니스 순서까지 정렬하지 않습니다.

## 잔액 상태 추적

초기 상태를 `balance=100, version=0`으로 두고 A와 B가 각각 70원을 결제한다고 하겠습니다. 승인 API가 40ms 뒤 성공하고 두 호출이 await에서 중단된다는 설명용 trace는 다음과 같습니다.

```text
A: balance=100 확인, version=0 기록 -> authorize(70) await
B: balance=100 확인, version=0 기록 -> authorize(70) await
A: 승인 성공, 재검사 없이 balance=30 저장
B: 승인 성공, 재검사 없이 balance=-40 저장
```

문제는 actor가 동시에 쓰기를 허용해서가 아니라 두 메서드가 같은 낡은 조건을 확인했다는 데 있습니다. 가장 강한 선택은 await 전에 actor 내부에서 예약을 만드는 것입니다.

```text
A 시작: available=100, reserve A=70 -> available=30
B 시작: available=30 -> insufficient, 외부 승인 호출 안 함
A 승인 성공: reserve A를 committed로 전환
```

예약을 둘 수 없다면 재개 후 `version`, 현재 잔액, 해당 요청의 상태를 다시 확인해야 합니다. 하지만 외부 승인이 이미 성공한 뒤 검사가 실패할 수 있으므로 `stateChanged`를 곧바로 사용자 실패로만 반환할 수 없습니다. 멱등 키로 결제 상태를 조회하거나 환불·보류·대사 중 하나를 정해야 합니다.

## 재개 검증

재개 후 검사는 프로퍼티 하나의 재확인이 아니라 “이 결과가 여전히 이 요청 세대에 속하는가”를 판정하는 단계입니다. 요청 ID, version, 대상 레코드 존재 여부, 외부 작업의 멱등 키를 함께 확인합니다.

```swift
actor Wallet {
    private var balance = 100
    private var version = 0

    func pay(_ amount: Int, gateway: Gateway, requestID: String) async throws {
        guard amount <= balance else { throw PaymentError.insufficient }
        let observed = version
        let result = try await gateway.authorize(amount, idempotencyKey: requestID)
        guard version == observed, amount <= balance else {
            throw PaymentError.stateChanged
        }
        balance -= amount
        version += 1
        _ = result
    }
}
```

이 코드는 설명용이며 실행하지 않았습니다. 여기서 `stateChanged` 경로는 gateway에 이미 남은 승인과 로컬 잔액을 대사해야 합니다. 예약을 사용하면 “승인 전 경쟁”을 없앨 수 있지만, 승인 timeout 뒤 서버가 실제로 성공했는지 확인하는 문제는 남습니다. 재검사만으로 외부 효과의 rollback이 만들어지지는 않습니다.

## 순서와 재진입

같은 actor에 A를 먼저 호출했다는 사실이 A의 외부 callback이 먼저 도착한다는 뜻은 아닙니다. A가 먼저 실행되어 `await`하면 B가 먼저 끝날 수 있습니다. FIFO가 요구사항이면 sequence number를 발급하거나 actor 안에서 예약을 직렬화하고, 외부 결과는 세대 검사로 적용합니다. 단순히 actor라는 이유로 네트워크 I/O를 actor의 동기 구간에 넣어 잠그면 안전해지는 대신 executor를 막아 모든 호출 지연이 커집니다.

배열 경계도 같은 원칙으로 봅니다. `[Item]`의 배열 저장 구조는 값 타입이라 호출자가 배열을 append해도 actor가 보유한 배열 변수 자체가 자동으로 바뀌지는 않습니다. 그러나 `Item`이 mutable class면 두 배열이 같은 원소 객체를 가리킬 수 있습니다. 최신 strict concurrency에서 이 반환이 허용되려면 `[Item]`의 Sendable·격리 조건부터 통과해야 하며, 허용된다는 전제 아래에서도 참조 공유는 별도 소유권 문제입니다.

## 구현 선택

불변 snapshot이 필요한 읽기 API라면 actor 내부의 class를 `struct ItemSnapshot: Sendable`로 변환해 반환합니다. 변경은 `updateItem(id:)`처럼 actor 메서드로만 받으면 원소의 mutable state가 외부로 새지 않습니다. deep copy는 중첩된 reference까지 복사해야 하므로 비용이 커지고, `@unchecked Sendable`은 그 비용이나 경쟁 상태를 없애지 않습니다. actor가 큰 파일·네트워크 작업까지 소유하면 순서 제어가 쉬워지는 대신 단일 executor가 병목이 되므로 I/O는 외부에서 기다리고 짧은 상태 반영만 actor 안에 둡니다.

## 실패와 검증

검증 로그에는 actor 진입 시각, await 직전 snapshot, suspension과 resume, version, request ID, 외부 승인 결과를 남깁니다. A/B 승인 지연을 40ms와 10ms로 뒤집어 결과 순서를 바꾸고, B의 예약이 A의 재개 검사를 실패시키는지 확인합니다. 재검사 실패 때 외부 승인 조회가 실행되는지도 별도 검증합니다.

```diagram
{"title":"await 뒤 상태 재검증","caption":"actor 구간은 격리되지만 await 동안 재진입이 가능하므로 재개 뒤 현재 상태와 요청 세대를 확인합니다.","rows":[[{"id":"read","label":"조건 읽기","detail":["잔액·version snapshot"]}],[{"id":"await","label":"외부 await","detail":["actor 양보 가능"]}],[{"id":"interleave","label":"다른 작업","detail":["예약·version 변경"]}],[{"id":"check","label":"재개 검사","detail":["현재값·요청 세대"]}]],"edges":[{"from":"read","to":"await","label":"승인 요청"},{"from":"await","to":"interleave","label":"재진입"},{"from":"interleave","to":"check","label":"변경 뒤 재개"}]}
```

## 비용과 한계

예약은 overspend를 막지만 승인 실패·timeout·환불 상태를 관리하는 원장과 cleanup을 요구합니다. version 검사는 구현이 단순하지만 외부 성공 후 불일치라는 보상 경로가 남습니다. 동기 구간을 길게 하면 interleaving은 줄어도 actor 대기열의 tail latency가 늘어납니다. 어떤 전략도 서버의 멱등성이나 결제 상태 조회 계약을 대신하지 않습니다.

## 참고자료

- Swift Evolution SE-0306 Actors: https://raw.githubusercontent.com/swiftlang/swift-evolution/main/proposals/0306-actors.md (actor isolation, reentrancy, await 사이 상태 변화의 근거로 확인할 URL; 대상 Swift 언어 모드는 별도 고정)
- Swift Evolution SE-0296 Async/Await: https://raw.githubusercontent.com/swiftlang/swift-evolution/main/proposals/0296-async-await.md (suspension point와 재개 의미)
- Apple Actor 문서: https://developer.apple.com/documentation/swift/actor (이 배치에서는 본문을 읽지 못했으므로 특정 진단 문구의 독립 근거로 사용하지 않음)

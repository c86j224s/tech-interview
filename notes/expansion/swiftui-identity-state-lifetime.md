---
id: swiftui-identity-state-lifetime
title: SwiftUI identity와 상태 수명
topic: 모바일
summary: 'View identity와 diffing이 @State, ForEach ID, 조건부 branch의 수명에 미치는 영향을 설명합니다.'
questionIds: []
prerequisites:
  - view-lifecycle
  - observation-contracts
related:
  - view-lifecycle
  - observation-contracts
  - arc-ownership
reviewedAt: '2026-09-19'
---
# SwiftUI identity와 상태 수명

SwiftUI에서 `body`가 다시 계산되는 것과 `@State` 저장 공간이 새로 생기는 것은 같은 사건이 아닙니다. framework는 현재 view tree를 이전 tree와 비교하면서 identity를 기준으로 어떤 노드를 이어갈지 정합니다. 같은 identity라면 state와 task 수명이 이어질 수 있고, identity가 바뀌면 subtree가 새로 만들어져 입력·작업·애니메이션이 초기화될 수 있습니다. 따라서 상태 문제는 픽셀 모양보다 “논리 항목과 저장 owner가 무엇인가”에서 출발해야 합니다.

## 값과 identity

View 값은 UIKit controller처럼 장수하는 화면 객체라기보다 선언적 설명입니다. `body`는 여러 번 다시 평가될 수 있지만, 동일한 위치와 identity로 매칭된 노드는 연결된 storage를 재사용할 수 있습니다. `View.id(_:)`는 identity를 명시하는 도구이며, 안정적인 논리 ID를 넣어야 합니다.

`id(UUID())`를 body 계산마다 만들면 매번 다른 node가 되어 `@State`가 초기화되고 `.task(id:)` 작업도 다시 시작될 수 있습니다. 반대로 다른 모델에 같은 ID를 부여하면 서로 다른 행이 같은 storage를 공유하는 것처럼 보일 수 있습니다. SwiftUI 내부 diff의 모든 세부 규칙을 이 문서가 보장한다고 확대하지 않고, 대상 SDK에서 작은 재현으로 확인해야 합니다.

## ForEach 매칭

초기 배열이 `[A, B, C]`이고 B의 TextField state가 `"b*"`라고 하겠습니다. index를 ID로 사용하면 이전 매핑은 `0=A, 1=B, 2=C`입니다. 앞에 X를 삽입한 뒤 새 매핑은 `0=X, 1=A, 2=B, 3=C`가 됩니다. framework가 같은 숫자 identity를 이어가면 이전 `id=1`의 `"b*"`가 새 A에 붙어 state가 이동한 것처럼 관찰됩니다.

```text
이전: id0=A, id1=B(input=b*), id2=C
삽입: id0=X, id1=A, id2=B, id3=C
위험: storage(id1,b*) -> A
```

모델이 서버에서 받은 고유 ID를 제공한다면 `ForEach(items, id: \.id)`처럼 논리 ID를 사용합니다. 배열 순서가 바뀌어도 B는 같은 ID를 가지므로 state가 B를 따라갈 수 있습니다. ID는 유일해야 하고, 삭제 후 다른 항목에 재사용하지 않는 정책이 필요합니다.

## branch 구조

`if editing { Editor() } else { Summary() }`에서 두 branch가 비슷한 모양을 그려도 tree 구조와 타입 위치는 다를 수 있습니다. branch 내부 `@State`를 서로 자동 이전한다고 기대하지 말고, 편집 초안이 보존되어야 하면 공통 model owner가 초안을 보유해 두 branch에 `Binding`으로 전달합니다.

반대로 모드 전환이 의도적인 reset이라면 branch 교체를 정책으로 기록합니다. `.id(mode)`를 상위 view에 붙이면 mode 변화가 subtree 전체의 새 identity가 되어 field뿐 아니라 task, scroll position, animation도 다시 시작할 수 있습니다. 한 field만 reset하려고 상위 전체 ID를 바꾸는 것은 범위를 넘는 비용입니다.

## State 소유권

화면 생존 동안만 필요한 입력 focus나 임시 토글은 view의 `@State`에 둘 수 있지만, 서버 snapshot·다운로드 상태·여러 화면이 공유하는 원장은 view identity에 묶지 않습니다. model actor나 observable store가 상태의 원본을 갖고, view는 snapshot과 binding으로 표시합니다. 화면이 교체되어도 원본에서 복구할 수 있어야 합니다.

```swift
struct Row: View {
    let item: Item
    @State private var draft = ""

    var body: some View {
        TextField("name", text: $draft)
            .task(id: item.id) {
                // item.id 세대에 맞는 초기화 또는 조회
            }
    }
}
```

이 코드는 설명용이며 실행하지 않았습니다. `draft`가 영속 이름인지 임시 초안인지에 따라 owner를 달리해야 합니다. item ID가 바뀔 때 draft를 reset할지, 모델 binding을 통해 저장할지 먼저 결정하지 않으면 identity 현상을 데이터 손실로 오해하게 됩니다.

## task identity

`.task(id: query)`는 query가 바뀔 때 이전 작업에 cancellation을 요청하고 새 작업을 시작하는 수명 경계를 만듭니다. 그러나 이미 진행 중인 URLSession 요청이나 callback이 즉시 취소된다고 보장하지 않습니다. `ab`가 80ms, `abc`가 50ms에 끝나는 trace에서는 최신 `abc`가 먼저 적용된 뒤 늦은 `ab` 결과가 도착합니다.

```text
t=0  ab 시작
t=10 abc 변경, ab 취소 요청
t=50 abc 적용
t=80 ab 도착 -> query/generation 불일치로 폐기
```

결과 적용 직전에 MainActor에서 현재 query, view active 여부, request generation을 검사합니다. UI에서 버린 결과가 서버나 캐시의 외부 효과까지 rollback하는 것은 아니므로 cache write 정책과 화면 적용 정책을 분리합니다.

## 구현 선택

컬렉션에는 모델 고유 ID를, subtree 전체를 reset하려는 경우에만 상위 `.id()`를 사용합니다. 위치 기반 ID는 삽입·정렬·삭제가 잦은 편집 목록에서 피합니다. query task는 actor coordinator와 중복 요청 정책을 정하고, 취소 요청·실제 네트워크 종료·결과 폐기를 각각 로그로 남깁니다.

## 실패와 검증

테스트는 행 앞 삽입, 중간 삭제, 정렬, duplicate ID, branch 전환, query 연속 변경을 분리합니다. 각 단계에 모델 ID, 표시 순서, state 초깃값, task 시작·취소·완료, 적용 query를 기록합니다. `id(UUID())`를 넣은 화면에서 state와 task가 매 갱신마다 리셋되는지도 확인하고, 의도적인 reset과 accidental reset을 구분합니다.

```diagram
{"title":"논리 ID와 state storage","caption":"논리 ID가 tree node 매칭을 결정하고, 그 결과 state와 task의 수명이 이어지거나 새로 시작됩니다.","rows":[[{"id":"model","label":"논리 항목","detail":["stable unique ID"]}],[{"id":"node","label":"tree node","detail":["diffing 매칭"]}],[{"id":"storage","label":"state storage","detail":["TextField·task"]}],[{"id":"render","label":"화면 반영","detail":["현재 snapshot"]}]],"edges":[{"from":"model","to":"node","label":"ID 매칭"},{"from":"node","to":"storage","label":"수명 연결"},{"from":"storage","to":"render","label":"값 표시"}]}
```

## 비용과 한계

안정적 ID는 state 보존과 효율적인 diffing을 돕지만, 논리적으로 다른 항목에 재사용하면 잘못된 입력이 유지됩니다. 매번 ID를 바꾸면 reset은 확실하지만 task 재시작·애니메이션·네트워크 중복과 state 손실이 커집니다. `.task(id:)` cancellation은 협력적이며 서버 exactly-once를 보장하지 않습니다. 특정 container의 세부 보존 동작은 target SDK와 기기에서 검증해야 합니다.

## 참고자료

- Apple View.id: https://developer.apple.com/documentation/swiftui/view/id(_:) (이 배치에서는 본문을 읽지 못해 내부 diff 규칙의 직접 근거로 과장하지 않음)
- Apple SwiftUI State: https://developer.apple.com/documentation/swiftui/state (state storage와 owner 확인용)
- Apple SwiftUI task(id:): https://developer.apple.com/documentation/swiftui/view/task(id:priority:_:) (취소·재시작 계약 확인용)

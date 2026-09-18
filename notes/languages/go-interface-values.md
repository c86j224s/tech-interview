---
id: go-interface-values
title: Go Interface의 Typed Nil과 비교 가능성
topic: 언어·런타임
summary: 동적 타입·값의 쌍으로 nil을 구분하고 오류 반환 경계·nil receiver·타입 assertion·비교 불가능한 값과 map 키를 설명합니다.
questionIds: [go-interface-typed-nil, go-nil-receiver-error-method, go-type-assertion-typed-nil, go-interface-comparability]
---

# Go Interface의 Typed Nil과 비교 가능성

Go의 interface 값은 타입 정보와 동적 값을 함께 담습니다. 그래서 포인터가 nil이라는 사실, interface가 nil이라는 사실, 타입 assertion이 성공했다는 사실, 동적 값이 비교 가능하다는 사실을 각각 확인해야 합니다.

## Typed Nil 포인터와 error interface의 타입 정보

```go
type MyError struct{}
func (*MyError) Error() string { return "작업 오류" }

var p *MyError = nil
var err error = p
fmt.Println(p == nil, err == nil) // true false
```

interface를 이해할 때 동적 타입과 동적 값의 쌍을 생각하면 됩니다. 위 error에는 `*MyError`라는 동적 타입과 nil 포인터 값이 들어 있으므로 아무 동적 타입도 없는 nil interface와 다릅니다. 실제 메모리 배치가 모든 구현에서 이 설명 그대로라는 뜻은 아닙니다.

| 값 | 동적 타입 | 동적 값 | interface == nil |
| --- | --- | --- | --- |
| 초기화하지 않은 error | 없음 | 없음 | true |
| nil `*MyError`를 담은 error | `*MyError` | nil 포인터 | false |
| nil slice를 담은 any | `[]int` | nil slice | false |


`nil` interface는 동적 타입도 값도 없지만 typed nil은 `*MyError` 타입 정보를 가진 채 포인터 값만 nil입니다. 이 쌍을 표로 먼저 적으면 `p == nil`과 `err == nil`이 다르게 나오는 것이 메모리 배치가 아니라 언어 값의 비교 규칙임을 설명할 수 있습니다.

## 성공 반환부의 nil interface

```go
func run() error {
    var result *MyError
    // 오류가 있을 때만 result를 채웁니다.
    if result == nil {
        return nil
    }
    return result
}
```

`return result`만 쓰면 반환 타입 error로 변환되면서 typed nil이 됩니다. 호출자마다 reflection으로 예외 처리를 붙이기보다 정상 경로가 nil interface를 반환하도록 API 경계를 고칩니다. errors.Is·errors.As는 오류 관계·타입 탐색을 위한 도구이지 잘못 반환한 typed nil을 성공으로 바꾸는 자동 수리 도구가 아닙니다.

```diagram
{"title":"포인터의 nil과 interface의 nil을 분리합니다","caption":"화살표는 interface 변환입니다. 포인터 값이 nil이어도 동적 타입이 추가되면 interface 자체는 nil이 아닙니다.","rows":[[{"id":"pointer","label":"p: *MyError = nil"}],[{"id":"interface","label":"err: error","detail":["타입 *MyError","값 nil 포인터"]}],[{"id":"compare","label":"err == nil 은 false"}]],"edges":[{"from":"pointer","to":"interface","label":"interface에 대입"},{"from":"interface","to":"compare","label":"쌍 전체의 부재 검사"}]}
```

호출부는 성공 시 `err == nil`을 기대하므로, 내부 포인터 변수를 그대로 error로 변환하는 경계를 피합니다. 테스트는 정상 실행, 실제 오류 객체, typed nil 반환을 각각 호출해 성공 분류가 정확히 하나만 되는지 확인합니다.

## 타입 assertion 성공과 객체 존재의 분리

위 err에서 `e, ok := err.(*MyError)`는 ok=true이면서 e=nil입니다. 동적 타입은 맞지만 실제 포인터가 nil인 상태입니다. 타입 불일치·typed nil·정상 객체 세 경우를 나눠야 합니다.

nil 포인터 receiver의 메서드는 호출 자체가 항상 panic인 것은 아닙니다. 예제의 Error는 필드를 역참조하지 않으므로 상수 문자열을 반환할 수 있습니다. `return e.message`처럼 nil receiver의 필드를 읽으면 실패합니다. 메서드가 nil을 허용하는 계약인지 확인하고 formatting·logging이 Error를 호출하는 경로도 검사합니다. 진단 라이브러리가 panic을 표시하는 방식과 메서드가 안전한 것은 다른 문제입니다.


`e, ok := err.(*MyError)`에서 `ok=true`는 타입 일치만 의미하고 `e == nil`을 보장하지 않습니다. nil receiver 메서드가 상수만 읽는 경우는 동작할 수 있지만 필드 역참조는 panic할 수 있으므로, receiver nil 허용 여부를 메서드 계약에 적고 logging 경로도 시험합니다.

## Interface 비교와 동적 값의 비교 가능성

int·string·비교 가능한 struct는 ==로 비교할 수 있습니다. slice·map·function은 일반적인 동등 비교가 불가능하고 nil과의 직접 비교만 허용되는 경우가 있습니다. 같은 비비교 가능 동적 타입을 담은 두 interface를 ==로 비교하면 런타임 panic이 날 수 있습니다.

```go
var a any = []int{1}
var b any = []int{1}
fmt.Println(a == nil) // false, 이 비교 자체는 가능
// a == b 는 같은 비비교 가능 동적 타입의 값 비교로 panic
```

interface끼리 `==`할 때는 동적 타입이 다르면 서로 다르다고 끝날 수 있고, 같은 동적 타입이면 그 동적 값의 비교를 시도합니다. 그렇다고 타입이 다른 경우가 있다는 사실만으로 `any` 비교 전체가 안전해지는 것은 아닙니다. slice 필드를 가진 struct는 비교 불가능하고, interface 필드를 가진 비교 가능한 struct도 내부에 비교 불가능한 동적 값을 담으면 비교 중 panic이 날 수 있으므로 타입의 비교 가능성과 실제 동적 값의 안전성을 나눠 봅니다.


`any`에 slice를 담는 것은 가능하지만 같은 동적 slice 값을 interface끼리 `==`로 비교하면 panic할 수 있습니다. 비교 가능한 타입이라는 정적 인상과 실제 동적 값의 comparability를 분리하며, 업무 동등성이 필요하면 명시적인 비교 함수를 선택합니다.

## Map 키의 도메인 값과 비교 가능성

`map[any]...` 자체는 컴파일되지만, `[]int` 같은 slice를 동적 키로 넣는 순간 비교할 수 없어 panic으로 실패할 수 있습니다. 외부 입력을 그대로 키로 받지 말고 문자열 ID나 명시적으로 비교 가능한 값으로 바꾸거나, 입력 타입을 그 범위로 제한합니다. `reflect` 기반 deep equality를 택한다면 nil과 빈 slice를 같은 것으로 볼지, 순환·포인터를 어떻게 다룰지, 비교 비용이 업무상 동등성의 의미와 맞는지를 먼저 정합니다.

any 안의 slice를 순회하려면 타입 assertion이나 switch로 실제 타입을 얻어야 합니다. 추상 타입 하나에 담았다고 모든 동적 값이 같은 연산을 지원하는 것은 아닙니다.


`map[any]`는 키 입력 시 동적 값의 비교 가능성을 요구합니다. 외부 slice를 그대로 넣는 테스트는 panic을 예측해야 하며, 문자열 ID·정규화된 struct처럼 비교 가능한 도메인 키로 변환합니다. `reflect.DeepEqual`을 택할 때 nil/빈 slice의 업무 의미도 별도로 정합니다.

## 반환·호출·비교 경계별 실패 시험

정상 run은 err==nil, 실제 오류는 err!=nil인지 확인합니다. typed nil의 assertion 결과와 nil-safe·nil-unsafe 메서드를 격리된 테스트로 비교합니다. int·slice·map·비교 가능한 struct·interface 중첩값의 비교와 map 삽입도 나눕니다. panic을 복구하는 테스트는 기대한 실패의 범위만 감싸고 운영 코드를 무조건 recover로 덮는 해결책으로 쓰지 않습니다.

최소 시험표는 `nil interface`, typed nil, 정상 pointer, nil-safe method, nil-unsafe method, int key, slice key, nested interface를 각각 분리합니다. panic 복구는 예상된 경계의 assertion에만 사용하고, 운영 코드가 모든 interface 비교를 recover로 감추는 방식은 해결로 기록하지 않습니다.

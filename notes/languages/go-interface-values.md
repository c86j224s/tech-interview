---
id: go-interface-values
title: Go Interface의 Typed Nil과 비교 가능성
topic: 언어·런타임
summary: 동적 타입·값의 쌍으로 nil을 구분하고 오류 반환 경계·nil receiver·타입 assertion·비교 불가능한 값과 map 키를 설명합니다.
questionIds: [go-interface-typed-nil, go-nil-receiver-error-method, go-type-assertion-typed-nil, go-interface-comparability]
---

# Go Interface의 Typed Nil과 비교 가능성

## Nil 포인터를 error로 반환하면 타입 정보가 남습니다

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

## 성공 반환부에서 진짜 Nil을 돌려줍니다

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

## 타입 assertion 성공은 객체 존재 증명이 아닙니다

위 err에서 `e, ok := err.(*MyError)`는 ok=true이면서 e=nil입니다. 동적 타입은 맞지만 실제 포인터가 nil인 상태입니다. 타입 불일치·typed nil·정상 객체 세 경우를 나눠야 합니다.

nil 포인터 receiver의 메서드는 호출 자체가 항상 panic인 것은 아닙니다. 예제의 Error는 필드를 역참조하지 않으므로 상수 문자열을 반환할 수 있습니다. `return e.message`처럼 nil receiver의 필드를 읽으면 실패합니다. 메서드가 nil을 허용하는 계약인지 확인하고 formatting·logging이 Error를 호출하는 경로도 검사합니다. 진단 라이브러리가 panic을 표시하는 방식과 메서드가 안전한 것은 다른 문제입니다.

## Interface끼리 비교할 때 동적 값의 연산이 필요합니다

int·string·비교 가능한 struct는 ==로 비교할 수 있습니다. slice·map·function은 일반적인 동등 비교가 불가능하고 nil과의 직접 비교만 허용되는 경우가 있습니다. 같은 비비교 가능 동적 타입을 담은 두 interface를 ==로 비교하면 런타임 panic이 날 수 있습니다.

```go
var a any = []int{1}
var b any = []int{1}
fmt.Println(a == nil) // false, 이 비교 자체는 가능
// a == b 는 같은 비비교 가능 동적 타입의 값 비교로 panic
```

동적 타입이 다르면 서로 다르다고 끝날 수 있지만 그 사실을 any 비교가 항상 안전하다는 근거로 삼지 않습니다. struct도 slice 필드를 가지면 비교 불가능하고, interface 필드를 가진 비교 가능 struct는 그 필드에 들어간 동적 값 때문에 비교 중 panic이 날 수 있습니다. 타입의 비교 가능성과 임의 동적 값의 안전성을 구분합니다.

## Map 키는 도메인에 맞는 안정적인 값으로 좁힙니다

`map[any]...`는 컴파일되지만 키에 slice 같은 값을 넣으면 실패할 수 있습니다. 키를 문자열 ID·명시적 비교 가능 값으로 제한하거나 입력 타입을 좁힙니다. reflect 기반 deep equality는 nil과 빈 slice·순환·포인터·비용의 의미가 업무 동등성과 맞는지 확인해야 합니다.

any 안의 slice를 순회하려면 타입 assertion이나 switch로 실제 타입을 얻어야 합니다. 추상 타입 하나에 담았다고 모든 동적 값이 같은 연산을 지원하는 것은 아닙니다.

## 반환·호출·비교의 실패를 따로 시험합니다

정상 run은 err==nil, 실제 오류는 err!=nil인지 확인합니다. typed nil의 assertion 결과와 nil-safe·nil-unsafe 메서드를 격리된 테스트로 비교합니다. int·slice·map·비교 가능한 struct·interface 중첩값의 비교와 map 삽입도 나눕니다. panic을 복구하는 테스트는 기대한 실패의 범위만 감싸고 운영 코드를 무조건 recover로 덮는 해결책으로 쓰지 않습니다.

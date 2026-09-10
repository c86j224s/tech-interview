---
id: go-interface-typed-nil
title: "Go에서 nil인 포인터를 error 변수에 넣었는데, 왜 err == nil은 false가 되나요?"
answerMinutes: 5
followups: [{"id":"go-slice-backing-array","prompt":"any에 nil 슬라이스를 넣은 뒤 비교하거나 range할 때 typed nil의 의미는 어떻게 달라질까요?"},{"id":"python-duck-typing","prompt":"Go 인터페이스와 Python Protocol은 구조적 계약을 각각 어느 시점에 검사하나요?"},{"id":"go-channel-close-ownership","prompt":"채널로 error 인터페이스를 전달할 때 typed nil을 정상 결과로 오인하지 않게 생산자와 소비자의 계약을 어떻게 정할까요?"}]
difficulty: 하
category: 언어·런타임
tags:
  - "Go"
  - "인터페이스"
  - "nil"
related: ["go-slice-backing-array"]
---

# Go에서 nil인 포인터를 error 변수에 넣었는데, 왜 err == nil은 false가 되나요?

## 구두 답변

**포인터가 nil인 것과, 그 포인터를 담은 인터페이스가 nil인 것은 다르기 때문입니다.** 먼저 다음 코드를 보면 어떤 비교가 달라지는지 알 수 있습니다.

### 인터페이스가 보존하는 타입

```go
type MyError struct{}

func (*MyError) Error() string { return "작업 오류" }

var p *MyError = nil
var err error = p

fmt.Println(p == nil)   // true
fmt.Println(err == nil) // false
```

`error`는 `Error() string` 메서드를 가진 값을 담을 수 있는 인터페이스입니다. 위에서는 `*MyError`가 그 메서드를 가지므로 `p`를 `error` 변수에 대입할 수 있습니다. 이때 포인터 값은 여전히 nil이지만, 인터페이스에는 **들어 있는 값의 구체적인 타입이 `*MyError`라는 정보도 함께 들어갑니다.**

인터페이스 값은 이해를 위해 ‘구체적인 타입과 그 값’의 쌍으로 생각하면 됩니다. 이것을 동적 타입과 동적 값이라고 부릅니다. 실제 메모리 배치를 외우라는 뜻은 아닙니다.

| 코드 | 인터페이스에 담긴 구체적인 타입 | 담긴 값 | `== nil` |
|---|---|---|---|
| `var err error` | 없음 | 없음 | `true` |
| `var err error = p` | `*MyError` | nil 포인터 | `false` |

아무것도 대입하지 않은 `error` 변수처럼, 구체적인 타입과 값이 모두 없는 상태가 **nil 인터페이스**입니다. 반면 `p`를 넣은 인터페이스는 타입이 정해져 있으므로 nil 인터페이스가 아닙니다. `err == nil`은 내부 포인터만 꺼내 비교하는 연산이 아닙니다.

실제 버그는 오류를 반환하는 함수에서 자주 나타납니다.

```go
func run() error {
    var result *MyError = nil
    // 오류가 없어서 result는 계속 nil입니다.
    return result
}

err := run()
if err != nil {
    fmt.Println("오류로 처리됨") // 이 분기가 실행됩니다.
}
```

`return result`에서 반환 타입인 `error`로 변환되면서, nil 포인터와 `*MyError` 타입 정보가 함께 전달됩니다. 그래서 오류 객체를 만들지 않았어도 호출자는 오류가 있다고 판단합니다.

수정할 때는 **인터페이스로 변환하기 전에 구체적인 포인터가 nil인지 확인하고, 정상 경로에서는 명시적으로 nil을 반환**하면 됩니다.

```go
func run() error {
    var result *MyError = nil
    // 작업 중 오류가 발생했다면 result에 오류 객체를 넣습니다.
    if result == nil {
        return nil
    }
    return result
}
```

### nil 경계와 비교 규칙

저는 이런 문제가 보이면 호출자마다 특별한 nil 검사를 추가하기보다, 오류를 반환하는 경계부터 고치겠습니다. 그리고 정상 경로는 `err == nil`, 실패 경로는 `err != nil`이 되는지 테스트하겠습니다. 요점은 **nil 포인터를 인터페이스에 넣는다고 인터페이스 자체까지 nil이 되지는 않는다**는 것입니다.

### 선택 기준과 검증

`any`에 `[]int(nil)`을 넣으면 인터페이스에 동적 타입이 남으므로 `value == nil`은 패닉 없이 `false`입니다. 그러나 두 인터페이스가 모두 비교 불가능한 동적 타입인 슬라이스를 담고 서로 비교하면 동적 값 비교 단계에서 패닉합니다. `any` 변수 자체를 바로 `range`할 수도 없고, `v.([]int)` 같은 타입 assertion이나 타입 스위치가 필요합니다. 따라서 nil 여부, 타입 검사, 실제 값 순회를 각각 분리해 테스트하겠습니다.

여기서 포인터 수신자 메서드는 nil 포인터로 호출돼도 본문이 그 포인터를 역참조하지 않으면 실행될 수 있습니다. 예제의 Error는 상수 문자열만 반환하므로 호출할 수 있지만 필드를 읽도록 바꾸면 패닉할 수 있습니다. 인터페이스가 nil이 아니라는 사실은 메서드 호출의 모든 내부 전제가 충족됐다는 뜻이 아닙니다. 오류 없음은 nil 인터페이스라는 API 계약을 반환부에서 지키는 것이 가장 단순합니다.

타입 assertion도 값이 nil인지와는 별개입니다. err가 typed nil인 *MyError를 담았다면 e, ok := err.(*MyError)는 ok=true이면서 e=nil일 수 있습니다. assertion이 성공했다는 이유로 e의 필드를 바로 읽지 않겠습니다. 오류 래핑에서는 errors.Is로 의미 있는 오류 관계를 검사하고 errors.As로 타입을 찾을 수 있지만, 이 도구들이 잘못 반환된 typed nil을 자동으로 정상 성공으로 바꾸지는 않습니다.

## 득점 포인트

- 동적 타입과 동적 값이 인터페이스 nil을 결정함을 설명한다.
- 반환 경계에서 typed nil을 명시적 nil로 정정한다.
- nil 수신자와 비교 불가능한 동적 값까지 테스트한다.

## 감점 포인트

- 포인터 값이 nil이면 인터페이스도 nil이라고 말한다.
- nil 포인터를 인터페이스에 넣을 때 오류 객체가 새로 생성된다고 설명한다.
- 호출자마다 reflection 예외를 추가해 반환 계약 오류를 가린다.

## 더 파고들 거리

- nil 수신자를 허용하는 `Error` 메서드와 허용하지 않는 메서드를 어떻게 테스트할까요?
- 인터페이스에 담긴 map·func·slice를 비교할 때 어떤 비교가 패닉을 만들까요?
- 타입 assertion 실패와 typed nil 성공을 호출자 API에서 어떻게 구분할까요?

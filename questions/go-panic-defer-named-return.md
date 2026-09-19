---
id: go-panic-defer-named-return
title: panic을 recover한 뒤 함수가 원래 panic 지점부터 계속되나요? defer와 named return은 어떻게 작동하나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Go
  - panic
  - defer
  - named-return
  - 언어·런타임
related:
  - go-context-values
  - go-channel-close-ownership
---
# panic을 recover한 뒤 함수가 원래 panic 지점부터 계속되나요? defer와 named return은 어떻게 작동하나요?

## 구두 답변

recover가 성공해도 함수는 panic 문장 다음으로 점프해 계속 실행되지 않습니다. panic은 stack을 unwind하고 각 frame의 defer를 실행합니다. deferred function에서 유효한 recover가 일어나면 panic 전달이 멈추고, 해당 함수는 panic 지점 아래 일반 문장이 아니라 반환 경계로 나갑니다. named result가 있으면 defer가 그 결과 변수를 마지막에 수정할 수 있습니다.

```go
func parse() (value string, err error) {
    defer func() {
        if v := recover(); v != nil {
            value = ""
            err = fmt.Errorf("bad: %v", v)
        }
    }()
    panic("input")
    // 이 아래에 둔 문장은 실행되지 않는다.
}
```

T0에 value와 err의 zero value가 준비됩니다. T1에 panic이 발생하여 defer closure가 실행됩니다. T2에 closure가 v를 읽고 value를 빈 문자열, err를 오류로 씁니다. T3에 함수는 그 named result를 caller에게 반환합니다. panic 뒤에 `return`이 자동 실행된 것이 아니라 defer가 결과 변수를 작성한 뒤 반환 경계를 완성한 것입니다. named return이 없어도 recover와 cleanup 자체는 가능하지만 caller에게 변환된 실패 결과를 돌려줄 저장 공간이나 명시적 결과 경로가 필요합니다.

여러 defer는 마지막 등록부터 실행되므로 recovery defer가 다른 cleanup보다 먼저인지, 마지막 panic이 원래 panic을 덮지 않는지를 설계합니다. 복구가 성공해도 이미 실행된 외부 호출은 rollback되지 않으며, 이를 성공 응답으로 게시하지 않도록 commit 시점을 분리해야 합니다. 예를 들어 결제 요청을 외부에 보낸 뒤 panic이 나면 err를 채우는 것만으로 상대 시스템의 결제가 취소되지는 않습니다. transaction 안에 둘 수 없는 호출에는 idempotency key와 조회 기반 보정 단계를 둡니다.

## 득점 포인트

- panic 이후 resume이 아니라 unwind→defer→반환이라는 제어 흐름을 직접 답합니다.
- named result를 T0~T3의 상태로 추적하고 defer가 값을 수정하는 이유를 코드와 연결합니다.
- named return의 부재가 recover를 막지는 않지만 오류 전달 설계가 달라진다는 점을 구분합니다.

## 감점 포인트

- recover 뒤 panic 다음 줄이 정상 실행된다고 하면 Go의 unwind semantics를 잘못 설명한 것입니다.
- named return이 있어야만 recover할 수 있다고 하면 recovery와 결과 작성 기능을 혼동한 것입니다.
- defer가 외부 side effect까지 되돌린다고 말하면 transaction 경계를 빠뜨린 것입니다.

## 더 파고들 거리

- 여러 defer에서 recovery, stack 기록, resource close 순서를 LIFO 표로 만들어 보세요.
- named result를 error로 바꾸는 최상위 handler와 worker 내부 recovery의 관측 필드를 비교해 보세요.

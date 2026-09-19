---
id: go-panic-recover-defer-boundary
title: Go Panic·Recover와 Defer 경계
topic: 언어·런타임
summary: >-
  panic의 stack unwinding, recover의 직접 deferred 호출 조건, 고루틴별 경계를 named return과 취소
  설계까지 연결합니다.
questionIds: []
prerequisites:
  - go-request-lifetime
  - go-channel-lifecycle
related:
  - go-request-lifetime
  - go-channel-lifecycle
reviewedAt: '2026-09-19'
---
# Go Panic·Recover와 Defer 경계

Go의 `panic`은 현재 고루틴의 호출 stack을 unwind하면서 각 frame의 deferred call을 실행합니다. `recover`는 전역 예외 처리기가 아니라 같은 고루틴에서 panic이 진행 중일 때 deferred function의 직접 호출로 평가되어야 하는 제한된 복구 장치입니다. 이 경계를 기준으로 helper 간접 호출, 부모와 자식 고루틴, named return의 결과를 분리해서 이해해야 합니다.

## panic 제어 흐름

정상 return은 현재 함수의 다음 반환 경계를 따라 caller로 나갑니다. panic은 panic 문장 다음의 일반 문장을 실행하지 않고 unwind를 시작합니다. 각 frame의 defer는 등록 역순으로 실행되며, 유효한 recover가 panic을 멈추면 그 함수는 panic 지점으로 되돌아가 재개하지 않고 반환 경계로 빠져나갑니다.

```go
func read() (value int) {
    defer func() {
        if recover() != nil { value = -1 }
    }()
    panic("bad input")
}
```

위 trace는 `panic → deferred closure 실행 → value=-1 → 함수 반환`입니다. `panic` 다음 줄이 실행되어 value를 고치는 것이 아닙니다.

## defer 평가와 순서

defer 문이 만나는 순간 함수값과 일반 인자는 평가되지만 deferred function 본문은 반환 또는 panic 때 실행됩니다. closure가 캡처한 변수는 본문 실행 시점의 값을 볼 수 있어 로그 값이 다르게 보일 수 있습니다. 여러 defer는 마지막 등록부터 실행됩니다.

예를 들어 A를 먼저 등록하고 B를 나중에 등록하면 `panic → B → A`입니다. B가 recover하면 A는 panic이 없는 정상적인 반환 정리처럼 실행됩니다. defer에서 다시 panic하면 원래 panic을 덮을 수 있으므로 recovery, stack 기록, resource cleanup 순서를 설계해야 합니다.

`panic(nil)`은 버전 경계를 명시해야 합니다. Go 1.21부터 panic이 활성 상태일 때 유효한 직접 recover가 nil을 받지 않도록 runtime이 보장하며, `panic(nil)`도 이를 위해 runtime panic을 일으킵니다. pre-1.21 동작과 typed-nil interface 값은 구별해야 하므로 대상 toolchain을 고정하지 않은 문서에서 단순히 “nil이면 panic 없음”이라고 판단하면 안 됩니다.

## 직접 recover 조건

다음 helper는 직접 deferred function이 아니므로 표준 직접 호출 계약을 만족하지 않습니다.

```go
func helper() any { return recover() }
func bad() {
    defer func() { _ = helper() }()
    panic("boom")
}
```

`helper` 안의 `recover()`는 nil을 반환하고 panic은 계속 unwind합니다. 안전한 형태는 deferred closure 본문에서 직접 호출해 결과만 helper에 넘기는 것입니다.

```go
defer func() {
    if v := recover(); v != nil { report(v) }
}()
```

소스에 `recover`라는 글자가 있다는 것만으로는 충분하지 않습니다. 함수값, wrapper, method 호출을 추가한 경우에는 target Go spec과 작은 실행으로 확인해야 하며, 실패한 recovery를 성공으로 기록해서는 안 됩니다.

## 고루틴별 경계

각 고루틴은 독립적인 실행 stack을 갖습니다. 부모가 `defer recover()`를 두어도 `go worker()`의 panic unwind는 부모 defer를 통과하지 않습니다. child의 마지막 경계에 직접 recovery를 두거나, panic을 error channel·`errgroup`·context cancel로 변환하여 부모가 관찰해야 합니다.

```go
go func() {
    defer func() {
        if v := recover(); v != nil { errs <- fmt.Errorf("worker: %v", v) }
        close(errs)
    }()
    doWork()
}()
```

channel을 읽는 부모는 child stack을 자동으로 정리하지 않습니다. child가 외부 DB나 API를 이미 호출했다면 recover가 rollback까지 해 주지 않으므로 transaction, idempotency key, 보상 상태를 별도로 둡니다.

## named return 동작

named result는 defer가 반환 직전 값을 수정할 수 있게 합니다. 값 반환식이 계산된 뒤에도 defer가 실행되므로 panic을 error 결과로 바꿀 수 있습니다.

```go
func parse() (out string, err error) {
    defer func() {
        if v := recover(); v != nil {
            out = ""; err = fmt.Errorf("parse panic: %v", v)
        }
    }()
    panic("malformed")
}
```

여기서 `return` 문이 panic 뒤에 암묵적으로 실행되는 것이 아닙니다. recovery가 성공한 deferred function이 named result를 작성하고 함수 반환을 마무리합니다. named result가 없어도 recover 자체는 가능하지만 caller에게 실패를 전달할 별도 결과 경로가 필요합니다.

## 중간 상태 추적

`f → g → panic`을 생각하면 T0에 f가 defer A를, T1에 g가 defer B를 등록합니다. T2에 g가 panic하고 B가 먼저 실행됩니다. B가 recover하지 않으면 T3에 A가 실행되고, A가 직접 recover하면 f의 반환 경계로 갑니다. 어느 경우에도 panic 지점 아래 문장은 실행되지 않습니다.

이것은 실행 로그가 아니라 제어 흐름 trace입니다. 실제 진단에서는 recovery 여부, panic 값, stack, 고루틴 종료, channel close 횟수를 별도 필드로 기록해야 합니다. recovery 후에도 commit된 외부 효과가 남는지를 함께 확인해야 결과를 안전하게 공개할 수 있습니다.

## 실패와 적용 경계

사용자 입력, 네트워크 오류, DB 거절처럼 caller가 예상할 수 있는 조건은 `error`가 기본입니다. recover는 최상위 HTTP handler, plugin runner, worker supervisor처럼 고루틴의 마지막 안전 경계에서 제한적으로 사용합니다. 모든 함수에 넣으면 버그가 정상 오류로 변하고 stack 정보가 사라집니다.

복구한 panic을 error로 바꿀 때 민감한 입력을 stack에 그대로 남기지 않고, 이미 외부에 게시한 상태를 성공으로 확정하지 않는 commit 경계를 둡니다. worker가 오류를 보내는 동안 부모가 먼저 channel을 닫지 않게 close owner도 명시해야 합니다.

## 검증과 비용

최소 검증 집합은 같은 고루틴의 직접 recover, helper 간접 recover, 부모-자식 고루틴, named return, 정상 반환의 다섯 케이스입니다. Go 1.21 경계를 포함해 `panic(nil)`을 별도 시험하고 typed-nil interface와 비교합니다. 이 노트는 특정 실행 결과를 주장하지 않고 문서 규칙과 재현 설계를 설명합니다.

recover는 작은 runtime 비용보다 의미 비용이 큽니다. 어디서 오류가 삼켜지는지, 누가 stack을 소유하는지, 취소와 재시작이 어떤 순서인지 정해야 합니다.

## 참고 자료

- [Effective Go: Panic](https://go.dev/doc/effective_go#panic) — panic, defer, recover 사용 모델. 확인일 2026-09-19.
- [Go Specification: Handling panics](https://go.dev/ref/spec#Handling_panics) — panic/recover 조건과 Go 1.21의 nil 관련 규칙. 확인일 2026-09-19.
- [Go 요청 Context·Errgroup·Defer 수명](/tech-interview/notes/go-request-lifetime/) — 취소와 작업 수명.

```diagram
{"title":"고루틴별 panic 경계","caption":"panic은 현재 고루틴 안에서만 unwind되며 child의 recovery 결과는 명시적인 채널 전달을 거쳐 부모가 봅니다.","rows":[[{"id":"panic","label":"child panic","detail":["현재 stack"]}],[{"id":"defer","label":"child defer","detail":["직접 recover"]}],[{"id":"result","label":"error 결과","detail":["복구 후 전환"]}],[{"id":"parent","label":"부모 고루틴","detail":["channel 관찰"]}]],"edges":[{"from":"panic","to":"defer","label":"같은 고루틴 unwind"},{"from":"defer","to":"result","label":"recover 성공"},{"from":"result","to":"parent","label":"명시적 전달"}]}
```

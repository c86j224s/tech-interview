---
id: go-recover-direct-deferred
title: defer 함수 안에서 helper를 통해 recover를 호출하면 왜 panic을 잡지 못할 수 있나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Go
  - panic
  - defer
  - recover
  - 언어·런타임
related:
  - go-context-values
  - go-channel-close-ownership
---
# defer 함수 안에서 helper를 통해 recover를 호출하면 왜 panic을 잡지 못할 수 있나요?

## 구두 답변

표준 Go의 직접 호출 규칙에서는 helper 안의 `recover()`가 panic을 회복하지 못합니다. `recover`가 유효하려면 panic이 진행 중인 같은 고루틴에서 deferred function이 실행되고, 그 deferred function의 호출 본문에서 `recover()`가 직접 평가되어야 합니다.

```go
func helper() any { return recover() }
func f() {
    defer func() { _ = helper() }()
    panic("boom")
}
```

T0에 f가 closure를 defer stack에 등록합니다. T1에 panic이 발생하고 closure가 실행됩니다. T2에 closure는 helper를 호출하지만 recover를 평가하는 frame은 helper입니다. 이 직접 deferred-call 조건을 만족하지 않으므로 helper의 결과는 nil이고 panic은 계속 unwind하여 프로세스의 panic 처리로 갑니다. 즉 “잡지 못할 수도 있다”가 아니라 이 단순한 간접 형태에서는 잡지 못하는 것이 규칙입니다.

안전한 형태는 deferred closure 자체가 recover를 호출하고, 필요한 로깅·변환 helper에는 값을 인자로 전달하는 것입니다. `defer func(){ if v := recover(); v != nil { report(v) } }()`처럼 쓰면 closure에서 recovery가 성립합니다. 함수값이나 wrapper를 한 단계 더 넣었을 때 같은 결론을 확대하려면 대상 Go spec과 실제 toolchain을 고정해 따로 시험해야 합니다. 이 예제에서 `helper`가 nil을 돌려준 직후 closure가 끝나도 panic 상태는 소멸하지 않으므로, 다음 caller 문장이 실행된다고 기대할 수 없습니다. recover 실패를 성공 반환으로 바꾸지 말고 worker 경계에서 panic 값과 stack을 기록해야 부분 side effect를 놓치지 않습니다.

## 득점 포인트

- 같은 고루틴, deferred function, 직접 recover라는 세 조건을 한 번에 제시합니다.
- helper 간접 호출의 frame 상태와 nil 반환, panic 지속이라는 결과를 T0~T2로 설명합니다.
- recovery 값은 helper에 인자로 전달하고 실패 시 stack을 보존하는 구현 선택을 말합니다.

## 감점 포인트

- defer 안에서 호출되기만 하면 helper의 recover도 항상 동작한다고 하면 직접 호출 조건을 누락합니다.
- helper가 nil을 반환해도 panic이 정상 처리됐다고 판단하면 치명적 실패를 성공으로 기록하게 됩니다.
- 모든 wrapper 변형을 동일한 실험 결과로 단정하면 대상 toolchain 경계를 무시합니다.

## 더 파고들 거리

- direct closure, helper, function value 세 형태의 작은 Go 재현을 나란히 비교해 보세요.
- worker supervisor에서 recovery 로그와 error 전달을 어느 순서로 수행해야 channel close와 충돌하지 않는지 설계해 보세요.

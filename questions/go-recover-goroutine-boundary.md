---
id: go-recover-goroutine-boundary
title: 부모 고루틴의 recover로 자식 고루틴 panic을 잡을 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Go
  - panic
  - goroutine
  - 언어·런타임
related:
  - go-context-values
  - go-channel-close-ownership
---
# 부모 고루틴의 recover로 자식 고루틴 panic을 잡을 수 없는 이유는 무엇인가요?

## 구두 답변

panic unwind는 고루틴별 호출 stack 안에서만 진행됩니다. 부모 고루틴에 `defer func(){ recover() }()`를 등록해도 `go worker()`로 시작한 자식 고루틴의 stack이 부모 frame을 통과하지 않으므로 자식 panic을 회복하지 못합니다. 부모가 channel을 읽는 것도 stack recovery가 아니라 통신일 뿐입니다.

```go
errs := make(chan error, 1)
go func() {
    defer func() {
        if v := recover(); v != nil { errs <- fmt.Errorf("worker: %v", v) }
        close(errs)
    }()
    doWork()
}()
err := <-errs
```

T0에 parent가 자신의 defer를 등록하고 T1에 child를 시작합니다. T2에 child에서 panic이 나면 child defer만 후보가 됩니다. child defer가 직접 recover하면 T3에 panic을 error로 바꾸어 channel로 보내고 종료합니다. parent는 T4에 error를 읽고 context 취소나 다른 worker 정리를 결정합니다. child에 recovery가 없으면 parent의 defer는 실행되지 않고 panic은 process-level 장애가 될 수 있습니다.

복구는 외부 side effect rollback이 아닙니다. child가 DB commit이나 API 호출을 끝낸 뒤 panic하면 그 효과는 남을 수 있으므로 transaction, idempotency key, 보상 상태가 필요합니다. 반복 작업이라면 recover한 panic을 재시작 가능한 오류와 영구 실패로 분류하고, channel close owner를 worker supervisor로 명시해 송신과 close 경쟁도 막아야 합니다. 예를 들어 child가 buffered channel에 한 번만 오류를 보내고 종료하게 하면 parent가 늦게 읽어도 recovery 경계가 송신에서 막히지 않습니다. 여러 worker가 같은 channel을 쓸 때는 각 worker가 close하지 않고 supervisor만 종료 시점을 결정해야 합니다.

## 득점 포인트

- panic stack과 goroutine 경계를 분리해 부모 defer가 child frame을 지나지 않는다는 핵심을 설명합니다.
- child 내부 recovery→error channel→parent 관찰의 실제 상태 전이를 제시합니다.
- recovery와 DB/API side effect rollback을 분리하고 close owner를 정합니다.

## 감점 포인트

- 부모가 channel을 수신하면 자식 panic도 자동으로 recover된다고 말하면 통신과 stack unwind를 혼동한 것입니다.
- 모든 child panic이 error channel에 도달한다고 하면 child recovery 부재 시 process 장애를 놓칩니다.
- recover만 넣으면 외부 side effect가 취소된다고 설명하면 데이터 정합성을 깨뜨릴 수 있습니다.

## 더 파고들 거리

- `errgroup`과 context cancel을 child recovery 결과에 연결해 다른 worker 중단 순서를 정해 보세요.
- panic을 격리해야 하는 plugin worker와 즉시 프로세스를 중단해야 하는 invariant violation을 구분하는 정책을 만들어 보세요.

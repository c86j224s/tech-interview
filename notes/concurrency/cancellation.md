---
id: cancellation
title: 비동기 작업의 수명과 취소
topic: 동시성
summary: 응답 종료·취소 요청·실제 종료를 구분하고 자식 작업·허가·버퍼를 한 수명으로 관리합니다.
questionIds: [async-api-and-blocking, deadline-cancellation-propagation, structured-concurrency-fanout, goroutine-lifecycle-and-leaks, graceful-shutdown, semaphore-mutex, bounded-queue-backpressure, cpp-coroutine-frame-lifetime, iocp-cancel-drain, js-abortcontroller-lifetime, python-asyncio-taskgroup, agent-background-cancellation]
---

# 비동기 작업의 수명과 취소

## 세 가지 종료를 구분합니다

- **응답 대기 종료**: 호출자가 결과를 더 기다리지 않습니다.
- **취소 요청**: 하위 작업에 중단 의도를 알립니다.
- **실제 작업 종료**: 코드·I/O가 더 이상 자원을 사용하지 않습니다.

이 세 시점은 다를 수 있습니다. timeout을 반환했지만 DB가 계속 실행될 수 있고, 취소 요청이 성공했지만 정상 완료가 늦게 도착할 수 있습니다. 이미 commit한 외부 효과는 취소로 자동 rollback되지 않습니다.

## 부모와 자식의 구조

```text
handle request:
    establish one deadline
    acquire bounded execution permit
    try:
        start required child operations
        pass remaining deadline and cancellation
        await required results
        on failure: request cancellation of siblings
        await termination or record durable unresolved work
    finally:
        release permit when the work it limits has actually ended
```

허가가 제한하는 것이 ‘응답을 기다리는 사용자 수’인지 ‘실제 DB 작업 수’인지 명시해야 합니다. 실제 작업이 계속되는데 응답이 끝났다고 슬롯을 반환하면 설정한 동시성보다 더 많은 작업이 실행됩니다.

필수 결과와 선택 결과를 구분합니다. 추천 조회 하나의 실패 때문에 결제 확인까지 취소할지, 일부 응답을 줄지는 기능 계약입니다.

## 취소와 완료의 경쟁

```text
Pending -> Completed
Pending -> Cancelled
```

결과 전달권은 한 전이만 얻어야 합니다. 각각 플래그를 읽고 나중에 callback하는 방식은 둘 다 실행될 수 있습니다. lock·CAS·actor 등으로 전이를 직렬화합니다.

그러나 Cancelled가 사용자 결과를 먼저 확정했어도 실제 외부 성공은 기록해야 합니다. 예약이 생성됐는데 그 사실을 버리면 사용자는 실패로 알고 다시 예약할 수 있습니다. 사용자 응답 상태와 외부 효과 대사 상태를 분리합니다.

## 자원 수명

I/O가 참조하는 버퍼·OVERLAPPED·코루틴 프레임은 실제 작업 종료까지 유지합니다. generation은 오래된 결과의 논리적 적용을 막을 수 있지만 해제한 메모리를 안전하게 읽게 만들지는 않습니다.

스레드 offload는 이벤트 루프를 보호해도 취소 불가능한 함수가 계속 실행될 수 있습니다. 별도 실행 pool과 큐·시간·메모리 상한이 필요합니다. 필수로 완료할 작업은 단순 detached thread가 아니라 내구 접수·소유권·결과 조회를 가진 작업으로 분리합니다.

## 종료 순서

1. 새 요청·메시지 fetch·자식 등록을 막습니다.
2. 진행 중 작업을 완료하거나 취소·복구 가능한 상태로 만듭니다.
3. 실제 참조가 끝난 뒤 DB·HTTP pool을 닫습니다.
4. 제한된 시간 안에 로그를 정리합니다.

새 자식 등록과 종료자의 카운터 0 확인이 경쟁하지 않도록 같은 동기화 규칙을 사용합니다. 오케스트레이터의 전체 종료 유예 안에 hook·전파·drain·정리 시간을 모두 배분합니다.

## 언어별로 확인할 경계

Go context, Java interrupt·Future, JavaScript AbortSignal, Python cancellation은 신호와 협력 처리의 구체 규칙이 다릅니다. 라이브러리가 신호를 지원하는지, 예외를 삼켰는지, 프로세스 밖 작업은 별도 취소 API가 필요한지 확인합니다.

## 연습

완료 직전 취소, 취소 직전 완료, 취소 무시, 제출 즉시 실패, 부모 종료 뒤 자식 생성의 순서를 제어해 봅니다. callback 한 번, 실제 활성 작업 수, 허가 합계, 열린 연결·버퍼와 외부 원장을 각각 검사합니다.

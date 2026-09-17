---
id: rio-foundations
title: Windows RIO 등록 버퍼와 큐
topic: 네트워크
summary: Winsock RIO의 런타임 함수 탐색부터 등록 버퍼·요청 큐·완료 큐·알림 재무장·결과 회수와 수명 종료까지 하나의 소유권 모델로 설명합니다.
questionIds: []
prerequisites: [iocp-foundations, iocp-completion]
related: [iocp-scheduling, iocp-shutdown, io-readiness, tcp]
reviewedAt: '2026-09-17'
---

# Windows RIO 등록 버퍼와 큐

## 등록 I/O의 문제 구조

Windows Winsock의 등록 I/O(RIO)는 네트워크 작업에 사용할 메모리와 큐를 애플리케이션이 미리 준비하고, 결과를 완료 큐에서 회수하는 확장 인터페이스입니다. 등록 버퍼는 운영체제가 접근할 메모리 범위를 미리 식별한 것이고, 완료 큐(CQ)는 끝난 송수신 결과를 보관하는 큐이며, 요청 큐(RQ)는 한 소켓의 RIO 송수신 요청을 관리하는 자원입니다.

RIO는 기존 overlapped `WSARecv`·`WSASend`와 같은 이름의 더 빠른 호출로 이해하면 안 됩니다. 기존 모델은 `OVERLAPPED`와 `WSABUF`를 작업마다 제출하고 IOCP에서 완료 패킷을 받습니다. RIO는 `RIOReceive`·`RIOSend`가 RQ를 통해 작업을 제출하고 `RIODequeueCompletion`이 CQ의 `RIORESULT` 배열을 회수합니다.

함수 포인터와 버퍼를 준비했다고 작업이 완료된 것은 아닙니다. 제출한 `RIO_BUF`와 그 `RIO_BUFFERID`는 completion을 dequeue할 때까지 유효해야 하며, 그 전에는 같은 범위를 다른 작업에 안전하게 재사용할 수 없습니다. 핵심은 호출 순서가 아니라 “어느 사건 뒤에 어느 자원을 다시 빌릴 수 있는가”입니다.

## 런타임 함수 탐색

RIO 함수는 정적으로 링크된 일반 Winsock 함수처럼 항상 호출할 수 있다고 가정하지 않습니다. `WSAStartup` 뒤 provider가 반환한 소켓에 `WSAIoctl`을 호출하고, `SIO_GET_MULTIPLE_EXTENSION_FUNCTION_POINTER`와 `WSAID_MULTIPLE_RIO`를 사용해 `RIO_EXTENSION_FUNCTION_TABLE`을 런타임에 받아야 합니다.

실제 RIO 요청에 사용할 소켓은 `WSASocket` 생성 시 `WSA_FLAG_REGISTERED_IO`를 지정하는 경로가 필요합니다. 함수 테이블 조회 성공과 RIO용 소켓 생성 성공은 별도로 확인하고, 생성·조회 중 하나라도 실패하면 명시적인 오류 또는 기존 overlapped 경로로 전환합니다.

Microsoft 함수 테이블 문서는 desktop client 최소 지원을 Windows 8, server 최소 지원을 Windows Server 2012로 표시합니다. 이는 문서상 최소 범위이지 현재 실행 중인 provider가 RIO 테이블을 반드시 반환한다는 보장이 아닙니다. SDK 헤더에 RIO 타입이 보이는 사실과 provider 탐색 성공을 별도 상태로 저장합니다.

```cpp
// 의사 코드: 실제 프로그램은 WSAStartup, 포인터 검증, 반환 바이트,
// provider별 fallback과 정리 경로를 완성해야 합니다.
RIO_EXTENSION_FUNCTION_TABLE rio{};
rio.cbSize = sizeof(rio);
GUID rioId = WSAID_MULTIPLE_RIO;
DWORD returned = 0;
int rc = WSAIoctl(socket,
                  SIO_GET_MULTIPLE_EXTENSION_FUNCTION_POINTER,
                  &rioId, sizeof(rioId),
                  &rio, sizeof(rio), &returned,
                  nullptr, nullptr);
if (rc == SOCKET_ERROR) {
    int error = WSAGetLastError();
    // 제품 정책: 기존 overlapped IOCP 경로로 전환하거나 기능을 끕니다.
    disable_rio_for_provider(error);
} else if (!required_rio_pointers_are_present(rio, returned)) {
    disable_rio_for_provider(INSUFFICIENT_PROVIDER_TABLE);
}
```

이 코드는 provider가 실제 구조체를 채운 뒤 필요한 함수 포인터가 모두 있는지 확인해야 한다는 생략을 포함합니다. 오류 시 RIO 호출을 계속하면 안 됩니다. fallback을 제공할지는 제품 요구사항이며, 특정 provider에서 자동으로 전환된다고 주장하지 않습니다.

## 등록 버퍼와 메모리 범위

`RIORegisterBuffer`는 애플리케이션 메모리에 등록 버퍼 식별자를 만들고, 등록한 가상 메모리 페이지를 물리 메모리에 고정할 수 있습니다. 이 고정은 일반적인 가상 메모리 이동·페이지 아웃 정책과 다른 비용을 뜻하므로, 큰 slab을 무제한 등록하지 말고 locked memory를 제품 예산으로 관리해야 합니다.

RIO 호출은 등록 버퍼 전체가 아니라 `RIO_BUF`로 부분 범위를 참조합니다. `BufferId`, `Offset`, `Length` 세 값을 함께 다루고, offset과 length가 등록 범위를 벗어나지 않는지 애플리케이션에서 확인합니다. 예를 들어 64KiB slab에 4KiB 수신 슬롯 네 개를 배치하면 각 요청은 같은 `BufferId`와 서로 다른 offset을 가질 수 있습니다.

다만 슬롯을 나눴다는 사실만으로 모든 동시 재사용이 안전해지는 것은 아닙니다. 요청이 참조한 범위를 completion dequeue 전까지 보존하고, 송신이라면 provider가 요구하는 전체 등록 버퍼의 재사용 제약까지 보수적으로 관리해야 합니다. 이 문서의 설명은 슬롯 분할을 API 계약의 대체물로 사용하지 않습니다.

```text
상태 표기: slot은 요청이 시작된 뒤 completion을 dequeue하고 사용자 소비까지 끝나야 다시 빌립니다.
slot[0] = { BufferId=slab_id, Offset=0, Length=4096, state=AVAILABLE }
reserve_and_register_before_submit(slot[0])
slot[0].state = IN_FLIGHT
started = RIOReceive(rq, &slot[0].rio_buf, 1, 0, slot[0].context)
if not started:
    release_submission_reservation_once(slot[0])

result = dequeue_one_completion()
if result.RequestContext == slot[0].context and result.Status == 0 and result.BytesTransferred > 0:
    view = parser_feed(slab + slot[0].offset, result.BytesTransferred)
    hold_parser_reference_until_consumed(view)
    release_parser_reference(view)
    slot[0].state = AVAILABLE_AFTER_PARSER_RELEASE
```

위는 의사 코드이며 `RIORESULT`의 실제 필드명과 반환 배열 처리는 대상 SDK 선언에 맞춰 작성해야 합니다. 제출 전 참조와 상태를 등록하고 완료 처리자와 제출 실패 처리자 중 하나만 종결권을 얻는 것이 핵심입니다. 오류·0바이트 결과는 파서에 넘기지 않고 각각 오류·EOF 경로에서 동일한 수명 규칙으로 정리합니다. API 문서상 해당 시점 전에는 시스템이 버퍼 연결·등록·quota를 해제하지 않습니다.

## 등록 수명과 해제 순서

등록 식별자가 더 필요 없을 때 `RIODeregisterBuffer`를 호출합니다. 그러나 outstanding operation이 사용하는 버퍼를 먼저 deregister하면 결과가 정의되지 않으며 심각한 오류로 취급됩니다. 애플리케이션 pool에서 slab을 대여 목록에서 제외하는 일과 provider에게 등록을 해제하는 일은 같은 사건이 아닙니다.

버퍼 반환은 다음 네 경계를 분리해서 기록해야 합니다.

| 상태 | 애플리케이션이 할 수 있는 일 | 할 수 없는 일 |
| --- | --- | --- |
| 등록만 됨 | slot을 RIO 요청에 대여 | 등록 해제를 먼저 실행하면서 사용 중으로 표시하지 않기 |
| RIO 요청 제출됨 | 결과와 context 추적 | 메모리 수정·동일 범위 재사용·deregister |
| completion dequeue | `BytesTransferred`만 파서에 전달 | parser view가 남았는데 pool 반환 |
| 사용자 소비도 끝남 | slot 재대여 또는 등록 해제 | 다른 참조의 수명 무시 |

`RIOReceive`와 `RIOSend`는 호출 뒤 버퍼와 등록이 operation 기간 동안 유효해야 합니다. 송신은 특히 in-flight send가 끝날 때까지 provider 계약상 재사용할 수 없는 범위를 지켜야 합니다. “전체 slab이 항상 금지” 또는 “서로 다른 슬롯이면 언제나 허용” 중 어느 쪽도 공식 계약을 넘어서 단정하지 않고, provider와 대상 SDK 문서를 기준으로 범위를 결정합니다.

## 완료 큐와 요청 큐 용량

완료 큐의 크기는 entry 개수로 지정하며 확인한 문서 기준으로 1 이상 `RIO_MAX_CQ_SIZE` 이하이어야 합니다. notification completion을 `NULL`로 만들면 애플리케이션이 polling으로 완료를 확인합니다. notification을 선택해도 결과가 애플리케이션 버퍼로 자동 복사되는 것은 아닙니다. 결국 `RIODequeueCompletion`으로 `RIORESULT`를 회수해야 합니다.

RQ를 만들 때 소켓의 send·receive CQ와 최대 outstanding send·receive 수를 연결합니다. CQ는 유한하므로 socket별 pending 작업의 상한과 공유 CQ를 사용하는 모든 socket의 상한을 함께 계산해야 합니다. 이 조건을 무시하면 CQ가 가득 찼거나 receive entry가 0인 경우 `RIOReceive`가 `WSAENOBUFS`로 실패할 수 있습니다.

수치 예를 들어 CQ가 8개 entry이고 한 소켓에 수신 3개와 송신 3개를 동시에 허용하면 해당 소켓의 정상적인 최대 완료 6개는 큐 안에 들어갈 수 있습니다. 하지만 다른 소켓이 같은 CQ를 사용한다면 그 작업의 최대 완료도 더해야 합니다. “RQ의 outstanding 합계가 6이니 CQ 8이면 충분하다”는 판단은 공유 CQ의 다른 소켓 작업을 제외하면 틀립니다.

```diagram
{"title":"RIO 큐 용량과 버퍼 수명의 연결","caption":"요청은 RQ에 제출되지만 결과는 CQ의 유한한 entry를 차지합니다. completion을 dequeue한 뒤에야 버퍼 연결과 quota가 반환되므로 용량 계산과 수명 계산을 함께 합니다.","rows":[[{"id":"buffer","label":"등록 버퍼","detail":["BufferId·offset·length","in-flight 동안 유효"]}],[{"id":"rq","label":"RIO_RQ","detail":["소켓별 outstanding 제한"]}],[{"id":"cq","label":"RIO_CQ","detail":["유한한 completion entry"]}],[{"id":"dequeue","label":"RIODequeueCompletion","detail":["RIORESULT·bytes·context"]}],[{"id":"parser","label":"파서·slot 반환"}]],"edges":[{"from":"buffer","to":"rq","label":"RIO_BUF로 제출"},{"from":"rq","to":"cq","label":"완료 entry 생성"},{"from":"cq","to":"dequeue","label":"결과 회수"},{"from":"dequeue","to":"parser","label":"유효 바이트 전달"}]}
```

처음 설계할 때는 CQ별로 허용할 최대 completion 수를 계산하고, 그 합이 entry 수를 넘지 않도록 RQ 상한을 제한합니다. 실제 API의 `Max*DataBuffers`와 데이터 버퍼 수 제한까지 포함하는 정확한 설정 검증은 대상 SDK 헤더와 provider에서 수행해야 합니다.

## 요청 큐와 동기화

`RIOReceive`와 `RIOSend`를 호출하려면 먼저 socket과 send·receive CQ를 바탕으로 `RIO_RQ`를 생성해야 합니다. RQ 자원은 socket에 연결되어 있으며, 확인한 문서상 사용을 마치면 `closesocket`으로 socket을 닫아 연관 자원을 해제합니다.

같은 RQ 또는 CQ를 여러 스레드가 동시에 접근해도 RIO가 애플리케이션 동기화를 대신 제공하지 않습니다. 같은 socket에서 여러 스레드가 송수신을 발행하는 경우와 같은 CQ에서 여러 스레드가 dequeue하는 경우 모두 lock 또는 단일 소유자 모델이 필요합니다.

처음 설계할 때는 CQ별 dequeue owner와 RQ별 제출 owner를 정하는 편이 추적하기 쉽습니다. 여러 연결이 같은 CQ를 공유하면 owner가 CQ를 비울 때 다른 연결의 결과도 얻을 수 있으므로 각 `RIORESULT`의 socket context와 application context를 분기합니다. 한 worker가 결과를 회수했다는 사실만으로 해당 연결 상태가 자동으로 직렬화되지는 않습니다.

## 제출 결과와 완료 회수

`RIOReceive`가 `TRUE`를 반환하면 completion이 이미 CQ에 들어갔거나 나중에 들어갈 작업이 성공적으로 시작되었다는 의미입니다. `FALSE`는 operation이 시작되지 않았고 completion indication도 없다는 계약입니다. `TRUE`를 “이미 데이터가 버퍼에 있다”로 해석하지 않고, `FALSE`에서는 completion이 올 것처럼 기다리지 않습니다.

`RIOSend`도 같은 형태로 `TRUE`는 즉시 또는 나중 completion을, `FALSE`는 시작되지 않은 실패를 뜻합니다. 제출자와 완료 처리자가 같은 operation을 한 번만 종결하도록 application context에 상태를 기록합니다. 즉시 성공처럼 보이는 `TRUE` 뒤에 직접 bytes를 처리하고 다시 dequeue하면 이중 처리가 될 수 있습니다.

```text
의사 코드: 각 API 호출의 구체적인 인자와 오류 저장은 실제 SDK 선언에 맞춥니다.
submit_receive(op):
    reserve_slot_and_increment_in_flight(op)
    started = RIOReceive(op.rq, &op.rio_buf, 1, 0, op.context)
    if not started:
        error = WSAGetLastError()
        mark_submission_failed_once(op, error)
        release_slot(op)
        return SUBMISSION_FAILED
    return COMPLETION_EXPECTED

consume_cq(cq):
    count = RIODequeueCompletion(cq, results, capacity)
    if count == 0:
        return CQ_EMPTY
    if count == RIO_CORRUPT_CQ:
        enter_cq_failure_policy()
        return CQ_CORRUPT
    for result in results[0:count]:
        finish_operation_once(result.RequestContext,
                              result.Status, result.BytesTransferred)
```

`RIODequeueCompletion`은 완료된 요청의 상태, 전송 바이트, socket context와 application context를 해석할 정보를 제공합니다. 반환값 0은 회수할 완료가 없다는 뜻이고, `RIO_CORRUPT_CQ`는 빈 큐와 다른 장애입니다. 성공적인 dequeue 뒤에야 해당 요청의 버퍼 연결·registration·quota를 해제할 수 있습니다.

수신 결과의 `BytesTransferred`가 양수이면 그 범위만 파서에 넣습니다. 0바이트나 오류의 의미는 TCP 종료와 RIO 작업 상태를 분리해 결정해야 합니다. TCP 프레임 완성은 transport completion과 다른 상위 사건입니다. 송신 completion도 상대 애플리케이션이 데이터를 처리했다는 확인이 아닙니다.

## 알림 등록과 큐 비우기

`RIONotify`는 CQ에 완료가 대기 중임을 알아내기 위한 등록이며 completion 자체를 dequeue하지 않습니다. 완료 통지가 발생한 뒤에는 다시 `RIONotify`를 호출해야 다음 통지를 받을 수 있습니다. 이전 notification 요청이 아직 완료되지 않은 상태에서 다시 호출하면 `WSAEALREADY`가 될 수 있습니다.

IOCP 통지를 사용할 때는 RIO 전용 notification용 `OVERLAPPED`와 `CompletionKey`를 둡니다. IOCP에서 이 패킷을 받은 worker는 bytes를 EOF로 해석하지 않고, key로 어느 CQ를 drain할지 판정한 뒤 `RIODequeueCompletion`을 반복합니다. notification `OVERLAPPED`를 일반 `WSARecv` 작업으로 캐스팅하지 않습니다.

권장되는 단일 owner 순서는 다음과 같습니다.

1. owner가 `RIONotify`를 한 번 등록합니다.
2. IOCP 또는 선택한 이벤트 통지를 받습니다.
3. 같은 owner가 CQ를 0이 나올 때까지 `RIODequeueCompletion`으로 비웁니다.
4. 각 결과를 bytes·status·context별로 종결하고 후속 parser 참조를 관리합니다.
5. CQ가 비었음을 확인한 뒤 `RIONotify`를 한 번 재등록합니다.
6. 재등록 실패를 기록하고 polling이나 연결 종료 같은 명시적 정책을 선택합니다.

이 순서는 신호와 결과 회수를 혼동하지 않기 위한 설계입니다. 실제 provider에서 notification과 새로운 완료가 경쟁하는 세부 시점은 실행 검증해야 하며, 알림 하나당 결과 하나라고 가정하지 않습니다.

## 송신 큐와 백프레셔

RIO send request는 `RIO_MSG_DEFER`가 설정됐는지와 무관하게 RQ outstanding I/O capacity를 차감합니다. 따라서 defer가 요청 수 상한을 늘려 주는 기능이라고 생각하면 안 됩니다. 송신 큐의 프레임 바이트와 slot 수를 제한하고, in-flight completion이 dequeue되어 자원을 돌려줄 때 다음 요청을 제출합니다.

송신 버퍼와 registration은 operation 동안 유효해야 합니다. 메시지를 애플리케이션 큐에서 꺼냈다고 provider가 더 이상 사용하지 않는 것은 아니며, completion을 dequeue하기 전에 vector나 slab을 재사용해서는 안 됩니다. 논리 송신 큐에서 pop한 시점과 실제 buffer ownership 반환 시점을 분리합니다.

느린 상대가 있으면 RQ와 CQ 공간뿐 아니라 애플리케이션 송신 큐도 포화됩니다. 새 프레임 생성 제한, 상위 요청 거절, 최신 상태 병합, 연결 종료처럼 메시지 의미에 맞는 정책을 정합니다. RIO가 큐를 제공한다는 이유로 무한한 사용자 큐까지 대신 관리하지는 않습니다.

## 종료와 검증 범위

종료에서는 먼저 새 RIO 송수신 제출을 막고, 애플리케이션이 추적하는 outstanding 작업 집합을 고정합니다. 각 작업의 completion을 dequeue하거나 대상 provider에서 확인한 취소·종료 결과를 처리해야 buffer와 registration 수명을 끝낼 수 있습니다.

`RIOCloseCompletionQueue`는 CQ를 invalid로 표시하고 새 completion을 추가할 수 없게 합니다. 문서상 새 completion은 조용히 버려질 수 있으므로 CQ close를 “모든 pending send/receive가 끝났다”는 증거로 사용할 수 없습니다. pending 작업은 애플리케이션이 별도로 추적해야 합니다.

확인한 문서는 버퍼가 dequeue 전까지 유효해야 한다는 점, `closesocket`이 RQ 연관 자원을 해제한다는 점, CQ close가 새 completion을 버릴 수 있다는 점을 각각 보장합니다. 그러나 모든 provider에 적용되는 하나의 취소·drain 순서를 문서가 완성해 주지는 않습니다. 운영 구현은 target provider의 취소 경로를 별도로 시험하고, outstanding=0과 후속 parser 참조 종료를 함께 확인해야 합니다.

이 문서에서 Windows RIO provider를 실제 실행하지 않았습니다. 다음 검증에서는 function-table 탐색 성공·실패, CQ full에 따른 `WSAENOBUFS`, RQ outstanding 상한, immediate/later queued `TRUE`, no-completion `FALSE`, partial receive, send completion, empty CQ, `WSAEALREADY`, notification 재등록, pending 종료와 in-use deregistration을 기록합니다.

## 참고 자료와 검증 범위

- [RIO extension function table](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/ns-mswsock-rio_extension_function_table): Microsoft Learn, page updated 2024-02-22. desktop client Windows 8 및 server Windows Server 2012 최소 지원 표기와 런타임 탐색 계약을 확인했습니다. 이 표기는 현재 provider 가용성을 보장하지 않습니다.
- [RIORegisterBuffer](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rioregisterbuffer): Microsoft Learn, page updated 2024-02-22. 등록 버퍼의 page lock과 부분 `RIO_BUF` 참조를 확인했습니다.
- [RIODeregisterBuffer](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rioderegisterbuffer): Microsoft Learn, page updated 2025-08-27. outstanding operation 중 deregister의 undefined behavior를 확인했습니다.
- [RIOCreateCompletionQueue](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_riocreatecompletionqueue): Microsoft Learn, page updated 2024-02-22. CQ capacity, polling, notification, synchronization 계약을 확인했습니다.
- [RIOCreateRequestQueue](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_riocreaterequestqueue): Microsoft Learn, page updated 2024-02-22. RQ 생성 필요성, finite CQ capacity, socket close 자원 해제를 확인했습니다.
- [RIONotify](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rionotify): Microsoft Learn, page updated 2024-02-22. notification 등록과 `WSAEALREADY`, IOCP 식별을 확인했습니다.
- [RIODequeueCompletion](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_riodequeuecompletion): Microsoft Learn, page updated 2024-02-22. `RIORESULT`, 0, `RIO_CORRUPT_CQ`, dequeue 전 자원 수명을 확인했습니다.
- [RIOReceive](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rioreceive), [RIOSend](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_riosend): Microsoft Learn, 각 page updated 2024-02-22. `TRUE`·`FALSE`, buffer 수명, CQ full과 outstanding capacity 계약을 확인했습니다.
- [RIO_NOTIFICATION_COMPLETION](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/ns-mswsock-rio_notification_completion): Microsoft Learn, page updated 2024-02-22. IOCP notification용 `OVERLAPPED`와 key를 확인했습니다.
- [RIOCloseCompletionQueue](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rioclosecompletionqueue): Microsoft Learn, page updated 2025-08-27. CQ close와 silently dropped completion 경고를 확인했습니다.
- [IOCP 수신·완료 처리](/tech-interview/notes/iocp-completion/), [IOCP 송신](/tech-interview/notes/iocp-send/): 기존 저장소 노트. RIO와 혼동하지 않아야 할 overlapped 수명과 transport completion 경계를 연결합니다.

참고 자료는 2026-09-17에 확인했습니다. 실제 Windows provider나 RIO 프로그램을 실행한 결과는 이 문서에 포함하지 않았습니다. Microsoft 문서에 없는 provider별 가용성, 취소·drain 순서, 성능 순위는 확정 사실로 서술하지 않았습니다.

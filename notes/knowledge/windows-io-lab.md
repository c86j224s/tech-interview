---
id: windows-io-lab
title: Windows IOCP·RIO 루프백 실습
topic: 네트워크
summary: overlapped IOCP의 안정적인 operation 소유권, 완전한 TCP framing, bounded sender, CancelIoEx drain, RIO IOCP notification과 registered memory 수명을 분리해 검증하는 교정 노트입니다.
questionIds: []
prerequisites: [iocp-foundations, rio-foundations, iocp-shutdown]
related: [iocp-send, wire-format, tcp]
reviewedAt: '2026-09-18'
---

# Windows IOCP·RIO 루프백 실습

이 실습은 TCP 바이트 누적과 Windows 완료 통지의 소유권을 작은 loopback 프로그램으로 분리합니다. 핵심 불변식은 알림과 결과를 분리하고, 제출된 operation의 메모리와 buffer를 completion packet 또는 RIO result를 dequeue하기 전까지 해제하지 않는 것입니다. Windows API 계약은 공식 Microsoft Learn 자료를 기준으로 정리했지만, 현재 macOS 27 arm64 환경에서는 Windows compiler와 provider를 사용할 수 없으므로 compile/runtime 결과는 `NOT_RUN`입니다.

```diagram
{"title":"완료와 메모리 반환","caption":"IOCP packet과 RIO CQ 결과는 서로 다른 회수 단계입니다.","rows":[[{"id":"submit","label":"작업 제출","detail":["안정적인 버퍼·operation"]}],[{"id":"iocp","label":"overlapped IOCP","detail":["packet에서 결과 회수"]},{"id":"rio","label":"RIO IOCP 알림","detail":["CQ dequeue 추가 필요"]}],[{"id":"finish","label":"잔량과 수명 판정","detail":["부분 완료 → 잔량 제출","모든 완료 → 메모리 반환"]}]],"edges":[{"from":"submit","to":"iocp","label":"WSARecv·WSASend"},{"from":"submit","to":"rio","label":"RIOReceive·RIOSend"},{"from":"iocp","to":"finish","label":"bytes·error"},{"from":"rio","to":"finish","label":"RIORESULT"}]}
```

## overlapped IOCP

`WSARecv`와 `WSASend`에서 즉시 완료의 반환값 0은 operation이 이미 끝났다는 뜻이며, 그 자체가 별도의 IOCP packet을 의미하지는 않습니다. `SOCKET_ERROR`와 `WSA_IO_PENDING`의 조합은 operation이 성공적으로 시작되어 나중에 completion이 온다는 뜻입니다. 그 밖의 오류는 제출 실패이며 completion이 오지 않으므로 active operation으로 남기지 않습니다.

각 operation은 heap에 고정된 `OVERLAPPED`와 buffer storage를 `OpStore`가 소유합니다. `GetQueuedCompletionStatus`가 `FALSE`를 반환해도 `OVERLAPPED != nullptr`이면 실패한 I/O completion packet을 dequeue한 것입니다. 이 경우에도 packet의 operation을 먼저 판별하고, 필요한 오류를 복사한 뒤 제거합니다. 제거한 객체를 다시 읽지 않습니다. timeout은 `OVERLAPPED == nullptr`인 별도 경우이며 cleanup 허가가 아닙니다.

## TCP framing과 송신 backpressure

TCP는 byte stream이므로 한 번의 receive가 frame 전체를 반환한다고 가정하지 않습니다. wire format은 little-endian `uint32_t` 길이와 payload입니다. receiver는 명시적인 `Header`와 `Payload` phase를 사용해 부분 completion을 누적하고, payload 길이가 4인 경우에도 상태를 혼동하지 않습니다. 성공적인 receive의 bytes가 0이면 아직 완성된 frame이 아니라 peer의 orderly close로 해석합니다.

sender는 최대 네 개의 frame만 queued 또는 active 상태로 둡니다. 한 번의 send completion이 frame 전체보다 작으면 완료된 접두부만 offset으로 반영하고 나머지를 새 operation으로 제출합니다. resubmit 전 `OVERLAPPED`를 초기화하고, 새 제출이 즉시 실패하면 해당 operation을 active store에서 제거합니다. 성공적인 zero-byte send는 진행이 없으므로 오류로 처리합니다. 성공적인 send는 peer 애플리케이션이 ACK를 처리했다는 뜻이 아닙니다.

split-write client는 하나의 frame을 세 번에 나눠 보냅니다. 이후 ACK frame을 정확히 읽고 payload를 검증한 뒤 종료합니다. 따라서 client가 ACK를 읽지 않고 socket을 닫아 서버의 송신 completion만 남기는 경로를 만들지 않습니다.

## CancelIoEx와 drain

IOCP operation의 timeout 또는 예외 경로에서는 새 제출을 막고, active operation 각각에 정확한 socket handle과 `OVERLAPPED`를 사용해 `CancelIoEx`를 요청합니다. 반환 성공은 cancellation request가 접수되었다는 뜻이지 완료가 아닙니다. `ERROR_NOT_FOUND`는 해당 시점에 matching request가 없었다는 뜻이며, 이미 완료됐거나 completion과 경합했을 수 있으므로 소유권을 즉시 버리지 않습니다. 비동기 pending I/O의 최종 packet을 dequeue한 뒤에만 operation memory를 회수합니다. 최종 status가 `ERROR_OPERATION_ABORTED`일 수도 있지만, 정상 완료나 다른 오류일 수도 있으므로 packet을 검사합니다.

전역 deadline은 `received == true`인 뒤에도 계속 적용됩니다. drain deadline은 diagnostic boundary입니다. deadline까지 completion이 관찰되지 않으면 `UNSAFE_TO_FREE`를 출력하고 `TerminateProcess`로 끝냅니다. 여전히 system이 참조할 수 있는 `OVERLAPPED`, socket, buffer에 대해 stack destructor를 실행하지 않습니다. 이것은 안전한 cancellation이라고 주장하는 경로가 아니라, provider/driver가 completion을 주지 않는 경우의 명시적인 unsafe process-termination escape hatch입니다.

## RIO IOCP notification

`rio_iocp_loopback.cpp`는 overlapped IOCP data path와 별도의 RIO data/notification path입니다. RIO CQ는 `RIO_IOCP_COMPLETION`으로 만들고, CQ마다 dedicated `OVERLAPPED`와 stable completion key를 둡니다. IOCP packet은 RIO result가 아니므로 key와 dedicated pointer로 어느 CQ를 조사할지 식별한 뒤 `RIODequeueCompletion`을 호출합니다.

RIO function table은 `WSAIoctl`, `SIO_GET_MULTIPLE_EXTENSION_FUNCTION_POINTER`, `WSAID_MULTIPLE_RIO`로 runtime에 얻습니다. CQ, RQ, registered buffer를 순서대로 초기화하고 각 실패 지점에서 local ownership으로 rollback합니다. send와 receive buffer는 endpoint의 heap storage에 고정되어 move로 주소가 바뀌지 않습니다.

첫 RIO operation을 성공적으로 제출하기 전에 endpoint의 `outstanding` guard를 활성화합니다. `RIOReceive`가 성공한 뒤 `RIOSend` 제출이 실패하는 경우에는 endpoint destructor로 unwind하지 않고 즉시 unsafe termination을 사용합니다. operation이 outstanding인 상태에서 registered buffer를 deregister하거나 CQ를 닫지 않습니다. 각 RIO notification에서 `RIODequeueCompletion`의 0은 현재 결과 없음이고 `RIO_CORRUPT_CQ`는 손상입니다. 반환된 `RIORESULT`를 확인한 뒤에만 해당 endpoint의 outstanding를 줄입니다. `RIORESULT.Status`와 양수 바이트 수를 검사하고 부분 송수신에서는 `RIO_BUF.Offset`을 늘리고 `Length`를 줄여 잔량만 다시 제출합니다. CQ 알림도 다시 요청합니다. 정해진 짧은 payload 전체를 모은 뒤에만 내용 비교를 하며, 범용 framing parser나 여러 동시 요청을 구현한 것은 아닙니다.

RIO provider가 취소를 보장한다는 공개 provider-independent 계약을 확인할 수 없으므로 RIO deadline을 full cancellation으로 부르지 않습니다. 운영 코드에서는 graceful peer-close protocol, 신규 제출 중지, 관찰 가능한 result drain, outstanding 0 확인 순서를 별도로 구현해야 합니다. 그 계약을 세울 수 없는 deadline 경로는 stack cleanup이 아니라 unsafe process termination이어야 합니다.

## 빌드와 실행

Visual Studio Developer Command Prompt에서 저장소 루트를 기준으로 실행합니다. Windows SDK와 대상 Winsock provider가 필요합니다.

```bat
examples\knowledge\windows-io-lab\build.bat
examples\knowledge\windows-io-lab\run.bat
```

`run.ps1`은 IOCP 서버·분할 송신 클라이언트·RIO 프로그램의 종료 코드를 확인하고 각 대기를 5초로 제한합니다. 일반 경로에서 ACK 검증까지 끝난 결과와, 제한 시간 초과로 자식 프로세스를 종료한 결과를 구분합니다. 고정 loopback 포트 39555·39556을 사용하므로 병렬 실행하지 않습니다.

## 공식 근거와 실행 한계

- [WSARecv](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsarecv) — 즉시 완료·pending·제출 실패와 버퍼 수명입니다.
- [GetQueuedCompletionStatus](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-getqueuedcompletionstatus) — 실패 packet과 timeout의 구분입니다.
- [CancelIoEx](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-cancelioex) — 취소 요청은 완료가 아니며 완료 전 메모리를 재사용하지 않습니다.
- [RIO_NOTIFICATION_COMPLETION](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/ns-mswsock-rio_notification_completion) — CQ 알림과 IOCP 연결입니다.
- [RIODequeueCompletion](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_riodequeuecompletion) — CQ 결과와 오류의 구분입니다.

현재 실행 상태:

- static contract test: PASS
- Python syntax 및 JSON validation: PASS
- Windows `cl.exe` compilation: NOT_RUN
- Windows Winsock/RIO provider runtime: NOT_RUN

NOT_RUN은 성공 loopback, provider acceptance, 실제 partial completion ordering, provider-specific error code, 또는 RIO cancellation behavior를 의미하지 않습니다.

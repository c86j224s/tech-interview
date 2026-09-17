---
id: iocp-shutdown
title: IOCP 종료 처리
topic: 네트워크
summary: 새 요청을 막고 남은 I/O를 회수한 다음 워커와 포트를 닫는 순서를, 취소 API와 함께 설명합니다.
questionIds: [iocp-cancel-drain, iocp-worker-shutdown, iocp-stop-packets-after-drain, iocp-timeout-loop-versus-stop-packet, shutdown-independent-audit-sink]
---

# IOCP 종료 처리

**IOCP 읽는 순서:** [수신과 완료](/tech-interview/notes/iocp-completion/) → [접속 수락](/tech-interview/notes/acceptex/) → [워커 구성](/tech-interview/notes/iocp-scheduling/) → [송신](/tech-interview/notes/iocp-send/) → [종료](/tech-interview/notes/iocp-shutdown/)

서버 종료 버튼을 눌렀는데 한 연결은 수신을 기다리고 다른 연결은 응답을 보내는 중이라고 생각해 보겠습니다. 이때 워커부터 종료하면 남은 완료 패킷을 처리할 사람이 없어집니다. 버퍼부터 해제하면 Windows가 아직 사용하는 메모리를 치울 수 있습니다.

종료의 핵심은 **새 일을 멈추는 것과 이미 맡긴 일을 정리하는 것을 순서대로 수행하는 것**입니다. 새 일을 받지 않으면서 기존 작업을 마무리하는 과정을 드레이닝(draining)이라고 부릅니다.

## 취소 함수가 돌아왔다고 버퍼 사용이 끝난 것은 아닙니다

CancelIoEx는 취소를 요청합니다. 호출 직전에 작업이 이미 완료됐거나 완료 큐로 이동 중일 수 있고, 취소와 정상 완료가 경쟁할 수 있습니다. 성공 반환이나 ERROR_NOT_FOUND를 버퍼 해제의 근거로 삼으면 안 됩니다. 애플리케이션이 추적한 작업의 실제 종결을 확인해야 합니다.

연결은 논리적으로 닫혔어도 컨텍스트와 버퍼는 완료 소비·후속 처리까지 살아 있어야 합니다. 늦은 결과를 새 세션에 적용하지 않는 것과 그 결과의 자원 정리를 생략하는 것은 전혀 다릅니다.

## 종료는 의존성의 역순으로 합니다

```diagram
{"title":"완료 통로를 마지막까지 유지합니다","caption":"화살표는 종료 절차입니다. worker와 포트는 남은 I/O 결과를 정리하는 데 필요하므로, 새 제출을 막고 drain한 뒤 종료합니다.","rows":[[{"id":"stop","label":"새 연결·I/O 제출 차단"}],[{"id":"cancel","label":"기존 작업 완료·취소 요청"}],[{"id":"drain","label":"완료와 후속 처리 drain","detail":["정상 · 취소 · 오류 모두 종결"]}],[{"id":"workers","label":"worker 종료 신호·join"}],[{"id":"port","label":"포트·공유 자원 해제"}]],"edges":[{"from":"stop","to":"cancel","label":"등록 집합 고정"},{"from":"cancel","to":"drain","label":"완료 통로 유지"},{"from":"drain","to":"workers","label":"종결 확인"},{"from":"workers","to":"port","label":"독자 없음"}]}
```

포트를 먼저 닫으면 결과를 수집해 OVERLAPPED와 버퍼를 정리할 경로를 잃을 수 있습니다. 타이머가 끝났거나 큐가 잠깐 비었다는 사실은 pending 작업이 없다는 증거가 아닙니다.

## 종료 플래그와 제출 예약을 같은 규칙으로 묶습니다

종료 플래그 하나만 추가하면 충분할 것 같지만, 다음 순서에서는 문제가 생깁니다.

1. 수신을 제출할 스레드가 연결이 열려 있음을 확인합니다.
2. 그 스레드가 잠시 멈춘 사이, 종료 스레드가 미완료 작업 수를 읽습니다. 아직 등록 전이므로 0입니다.
3. 종료 스레드는 연결을 정리합니다.
4. 첫 스레드가 다시 실행되어 이미 정리한 연결에 수신을 제출하려 합니다.

따라서 **연결이 열려 있는지 확인하는 일과 작업 수를 늘리는 일**을 같은 잠금 안에서 처리해야 합니다. 완료 후 다음 `WSARecv`를 제출하는 경로도 이 검사를 거칩니다. 종료가 시작됐다면 새 수신을 만들지 않고 현재 작업을 정리합니다.

```text
beginShutdown():
    under_admission_lock:
        accepting = false
        snapshot = retain_all_registered_operations()
    for operation in snapshot:
        request_cancel_if_needed(operation)
    release_snapshot_references()
    wait_until_no_submitted_or_processing_operations()
    signal_each_worker_to_exit()
    join_workers()
    close_completion_port()
```

snapshot은 작업 목록을 순회하는 동안 컨텍스트가 사라지지 않게 참조를 유지한다는 뜻입니다. 취소 요청 자체가 정상 완료·취소 완료의 단일 종결 경로와 경쟁해 카운터를 두 번 줄이지 않게 해야 합니다. 즉시 제출 실패는 통지가 없다는 API 계약에 맞춰 예약을 되돌립니다.

## 패킷을 꺼낸 뒤에도 사용자 코드가 버퍼를 읽을 수 있습니다

완료 워커가 패킷을 꺼내자마자 pending을 0으로 만든 뒤 파서가 버퍼를 읽는다면 종료자가 먼저 메모리를 회수할 수 있습니다. 커널 I/O 참조를 후속 처리 참조로 넘기거나, 모든 소비가 끝난 뒤 마지막 참조를 놓아야 합니다.

| 상태 | 종결됐다고 볼 수 있는 것 | 남을 수 있는 것 |
| --- | --- | --- |
| CancelIoEx 반환 | 취소 요청 API 결과 | 커널 작업·완료 패킷 |
| 완료 dequeue | 해당 I/O 결과 수집 | 파싱·별도 실행기 처리 |
| 후속 처리 완료 | 버퍼 소비 종료 | 연결의 다른 작업 |
| worker join | 해당 worker 실행 종료 | 잘못 남긴 작업·참조 누수 검사 |

세대 검사에서 오래된 완료라고 판단해도 참조 반환은 해야 합니다. 반대로 세대가 맞아도 연결이 닫혔거나 요청이 취소됐다면 사용자 결과 적용은 별도 정책에 따릅니다.

## 종료 패킷 수와 배치 소비를 고려합니다

단일 GQCS로 한 워커가 종료 패킷 하나를 받고 즉시 빠지는 구조에서는 워커 수만큼 신호를 넣는 방식이 가능합니다. 하지만 GQCSEx로 한 워커가 여러 종료 패킷을 한꺼번에 가져오면 다른 worker의 신호까지 소비할 수 있습니다. 신호 전달 규약·재게시·별도 이벤트 등으로 모두 깨어나도록 설계해야 합니다.

종료 패킷은 drain 뒤에 보내거나, 받더라도 실제 종결 조건을 확인하도록 합니다. 짧은 GQCS timeout으로 주기 검사하는 방식은 단순할 수 있지만 idle wakeup 비용과 종료 반응 시간의 절충이 있습니다. 어느 쪽도 pending I/O를 자동으로 취소·회수하지 않습니다.

## 종료 기한을 넘겼다면 어떻게 할까

종료 기한이 지났다고 사용 중 버퍼를 free하면 안전한 종료가 아닙니다. 강제 종료가 필요하다면 프로세스 단위 격리 등으로 범위를 정하고 불확정 외부 효과를 복구할 기록을 남겨야 합니다. 개별 작업의 메모리 수명을 무시하는 것으로 기한을 맞추지 않습니다.

마지막 로그가 이미 닫힌 DB 풀이나 종료한 worker에 의존하면 오류를 잃거나 교착할 수 있습니다. 제한된 독립 sink·stderr·내구 상태 기록을 사용하되 flush에도 기한을 둡니다. 감사 필수 기록과 버려도 되는 debug 로그의 정책을 나누고 비밀값·무한 재시도를 피합니다. 로그 전송 성공은 거래 커밋 증거가 아닙니다.

## 수신 하나를 취소하는 API 호출

연결을 아직 유지하면서 특정 수신을 취소하려면 그 요청의 `OVERLAPPED`를 지정할 수 있습니다. 아래 호출 동안 소켓 핸들과 작업 메모리가 살아 있고, 다른 스레드가 close 후 같은 숫자의 소켓을 재사용하지 못하도록 소유권을 확보했다는 전제입니다.

```cpp
BOOL requested = CancelIoEx(reinterpret_cast<HANDLE>(socket),
                            &operation->overlapped);
if (!requested) {
    DWORD error = GetLastError();
    if (error != ERROR_NOT_FOUND) {
        reportCancellationFailure(error);
    }
}
// 어느 반환 경로에서도 여기서 operation을 삭제하지 않습니다.
// 정상·취소·다른 오류 중 실제 완료 결과를 기존 워커가 회수합니다.
```

`ERROR_NOT_FOUND`는 취소할 요청을 찾지 못했다는 뜻입니다. 이미 성공 완료가 큐에 들어갔는데 워커가 아직 꺼내지 않았을 수도 있습니다. 반대로 성공 반환도 취소 완료가 아닙니다. 완료가 취소보다 먼저 확정되면 정상 성공으로 돌아올 수 있고, 취소가 적용되면 `ERROR_OPERATION_ABORTED`, 다른 원인이 생기면 다른 오류로 종결될 수 있습니다.

연결 전체를 종료할 때는 새 제출을 막고 `closesocket`을 연결의 소유 경계에서 수행하는 경로도 사용합니다. 소켓은 `CloseHandle`이 아니라 `closesocket`으로 닫습니다. 닫기 호출과 다른 Winsock 호출을 무보호로 경합시키지 않으며, 닫힌 소켓의 pending 작업 컨텍스트도 완료 회수 전 해제하지 않습니다. TCP의 `shutdown(SD_SEND)`로 송신 방향을 정상 종료하려는 절차와, 즉시 연결 자원을 닫는 절차는 사용자 프로토콜에 따라 따로 설계합니다.

### CancelIo와 CancelIoEx를 바꿔 쓰면 안 되는 이유

`CancelIo`는 호출한 스레드가 시작한 I/O만 대상으로 합니다. 수신은 워커 A가 제출했고 종료 처리는 워커 B가 수행한다면 B의 CancelIo가 A의 수신까지 취소한다고 기대할 수 없습니다. `CancelIoEx`는 현재 프로세스에서 다른 스레드가 제출한 해당 핸들의 요청도 대상으로 하고, 두 번째 인자로 개별 작업을 지정할 수 있습니다.

Microsoft 문서의 최소 지원은 CancelIoEx가 Windows Vista·Server 2008입니다. 그보다 오래된 대상에 이를 정적 호출하면 헤더 설정만 바꿔 해결되지 않습니다. 최소 지원 OS를 올리거나, 지원 여부를 조회해 명시적인 다른 종료 경로를 사용해야 합니다. 취소 지원이 없는 경로를 성공한 취소처럼 처리해서는 안 됩니다.

### 종료를 시작한 스레드가 워커를 막지 않게 합니다

완료 처리에 필요한 연결 mutex를 잡은 채 pending이 0이 되기를 기다리면, 워커는 그 mutex를 얻지 못해 pending을 줄이지 못합니다. 종료자는 잠금 안에서 closing 전환과 작업 목록 참조만 확보하고, 기다림은 잠금을 놓거나 condition-variable wait처럼 잠금을 풀어 주는 방식으로 수행합니다. 마지막 진단 역시 종료할 IOCP 워커에 다시 작업을 보내고 동기 대기하는 구조를 피합니다.

## 종료 코드를 확인할 때 볼 것

수신 대기·송신 진행·AcceptEx 대기에서 종료를 시작하고, 취소 직전 정상 완료·취소 직후 완료·완료 중 재제출·반복 종료를 시험합니다. 전역 및 연결별 작업 집합과 카운터, 참조 생존을 대조해야 합니다.

실제 Windows API의 취소 가능성·오류와 스케줄링은 대상 환경에서 시험해야 합니다. 이 노트는 종료 불변식이며, 워커가 모두 끝났다는 결과만 보고 누수나 외부 효과까지 정리됐다고 판단하지 않습니다.

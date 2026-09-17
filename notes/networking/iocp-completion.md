---
id: iocp-completion
title: IOCP 수신·완료 처리
topic: 네트워크
summary: 소켓을 완료 포트에 연결하고 WSARecv의 반환값과 완료 패킷을 처리하는 과정을 C++ 코드로 따라갑니다.
questionIds: [iocp-completion-key-overlapped, iocp-gqcs-error-contract, gqcs-ex-per-entry-error, iocp-immediate-completion, windows-skip-success-completion, iocp-completion-before-submit-return, iocp-operation-counter-invariants, iocp-generation-not-memory-safety, iocp-user-packet-tagging]
---

# IOCP 수신·완료 처리

**IOCP 읽는 순서:** [수신과 완료](/tech-interview/notes/iocp-completion/) → [접속 수락](/tech-interview/notes/acceptex/) → [워커 구성](/tech-interview/notes/iocp-scheduling/) → [송신](/tech-interview/notes/iocp-send/) → [종료](/tech-interview/notes/iocp-shutdown/)

채팅 서버에 클라이언트 하나가 접속했다고 생각해 보겠습니다. 서버는 소켓에 수신 버퍼를 맡긴 뒤 다른 일을 합니다. 데이터가 들어오면 Windows가 완료 포트에 결과를 넣고, 대기 중인 워커가 그 결과를 꺼냅니다. IOCP를 구현할 때 가장 먼저 익혀야 하는 흐름은 **소켓 연결 → 수신 제출 → 완료 수집 → 다음 수신 제출**입니다.

이 글의 앞부분에서는 완료 결과를 읽는 규칙을 설명하고, 뒤의 **실제 API로 수신 경로 연결하기**에서는 그 규칙을 C++ 코드에 적용합니다. 처음에는 연결당 수신을 하나만 걸고, 성공 통지 생략 옵션은 사용하지 않습니다. 이 두 선택 덕분에 버퍼 순서와 정리 책임을 따라가기 쉬워집니다.

## 연결별 동시 I/O 작업과 완료 결과 식별 정보

소켓 하나에서 수신과 송신을 동시에 진행할 수 있습니다. 그러면 완료 워커는 두 가지를 알아야 합니다. **어느 연결의 결과인지**, 그리고 **그 연결에서 어떤 작업이 끝났는지**입니다.

첫 번째 질문에는 소켓을 포트에 연결할 때 지정한 `completion key`를 사용합니다. 두 번째 질문에는 I/O를 제출할 때 넘긴 `OVERLAPPED`의 주소를 사용합니다. 보통 key로 연결 객체를 찾고, `OVERLAPPED`로 수신 버퍼나 송신 진행량을 가진 작업 객체를 찾습니다.

다만 Windows는 우리가 넣은 포인터 값을 돌려줄 뿐입니다. 그 객체를 대신 보관하거나 삭제 시점을 관리하지 않으므로, 미완료 작업이 있는 동안 연결 객체가 살아 있도록 애플리케이션에서 참조를 유지해야 합니다.

미완료 작업마다 독립 OVERLAPPED를 두고 작업 컨텍스트에 종류·버퍼·연결 참조·세대를 저장합니다. 포인터 크기를 보존하는 ULONG_PTR 등의 API 타입을 사용하고 임의 메모리를 잘못된 포함 객체로 캐스팅하지 않습니다.

## GQCS 반환값·OVERLAPPED 포인터 조합

| 반환 | OVERLAPPED | 해석 |
| --- | --- | --- |
| TRUE | non-null | 성공 I/O 또는 규약상 사용자 패킷 |
| FALSE | non-null | 실패한 I/O 완료, 그 작업을 종결해야 함 |
| TRUE | null | 사용자 제어 패킷으로 정의 가능 |
| FALSE | null | 패킷을 못 얻음, timeout·포트 오류 등 |

FALSE·null에서는 bytes·key가 유효한 작업 결과라고 가정하면 안 됩니다. FALSE·non-null에서 continue만 하면 실패 작업의 버퍼·참조가 남습니다. GetLastError는 다른 호출이 바꾸기 전에 저장합니다. timeout은 특정 I/O의 실패나 취소 완료가 아닙니다.

PostQueuedCompletionStatus는 애플리케이션 값을 게시하므로 non-null 포인터라고 반드시 커널 완료는 아닙니다. 이 노트의 단순 규약은 사용자 패킷을 null OVERLAPPED와 예약된 key로 구분하는 것입니다. payload 수명과 게시 실패의 반환 책임도 정해야 합니다.

```diagram
{"kind":"class","title":"핸들 맥락과 작업 맥락의 분리","caption":"화살표는 참조·식별 관계입니다. 완료 패킷의 key와 포인터는 식별값이며 실제 소유 참조는 제출 전에 별도로 확보합니다.","rows":[[{"id":"packet","label":"완료 패킷","detail":["key · OVERLAPPED · bytes"]}],[{"id":"connection","label":"Connection","detail":["종료 상태 · 세대"]},{"id":"operation","label":"IoContext","detail":["OVERLAPPED · 작업 종류","버퍼 · 소유 참조"]}]],"edges":[{"from":"packet","to":"connection","label":"completion key"},{"from":"packet","to":"operation","label":"작업 포인터"},{"from":"operation","to":"connection","label":"완료까지 참조"}]}
```

## 즉시 성공과 완료 통지의 분리 계약

기본 IOCP 통지 모드에서 WSARecv가 0을 반환해도 완료 패킷이 올 수 있습니다. SOCKET_ERROR와 WSA_IO_PENDING은 제출이 성공해 나중 결과를 기다리는 상태입니다. 그 밖의 즉시 오류는 해당 API가 완료를 통지하지 않는 계약이면 제출자가 예약을 되돌립니다.

| 제출 결과 | 기본 모드의 종결 소유자 |
| --- | --- |
| 즉시 성공 | 완료 포트 경로 |
| pending | 완료 포트 경로 |
| 완료 통지 없는 즉시 실패 | 제출 실패 경로 |

기본 모드는 완료 포트 연결과 통지 억제 설정이 없다는 전제입니다. OVERLAPPED hEvent의 낮은 비트 등으로 포트 통지를 억제하는 기능까지 섞으면 표의 계약이 달라집니다. 처음에는 경로를 단순화하고 최적화는 측정 뒤 적용하는 편이 검증하기 쉽습니다.

## 제출 함수 반환 전 완료 워커 실행과 참조 수명

작업 참조를 호출 뒤 증가시키면 워커가 먼저 감소·해제할 수 있습니다. 또한 완료용 참조 하나만 잡아 두면 워커가 그것을 놓은 뒤 제출자가 반환 상태를 기록하려다 해제된 객체를 읽을 수 있습니다. **제출자 참조와 완료 참조를 별도로** 준비합니다.

```text
submit(connection, operation):
    acquire_submitter_reference(operation)
    atomically_check_open_and_reserve_pending(connection, operation)
    acquire_completion_reference(operation)
    result = call_overlapped_api(operation)
    if result is definite_failure_without_completion:
        finish_reserved_operation_once(operation, submission_error)
    else if result is immediate_success and confirmed_skip_mode:
        finish_reserved_operation_once(operation, success)
    # 나머지는 완료 경로가 담당
    release_submitter_reference(operation)

onCompletion(operation, result):
    finish_reserved_operation_once(operation, result)
```

finish는 실제 결과 처리·후속 버퍼 참조 이전·pending 등록 제거·완료 참조 반환을 일관되게 수행합니다. 제출 성공과 완료 사이 카운터가 잠깐 0처럼 보이지 않게 등록을 먼저 합니다. 중복 finish를 원자적으로 막는 것도 이미 해제된 포인터에 접근해도 된다는 뜻은 아닙니다.

## 성공 통지 생략 모드와 직접 종결 경로

지원되는 핸들에 FILE_SKIP_COMPLETION_PORT_ON_SUCCESS를 성공적으로 설정하면 즉시 성공한 요청의 포트 통지가 생략될 수 있으므로 직접 종결 경로가 필요합니다. pending은 나중 완료 경로를 유지합니다. 핸들에 적용된 모드를 명시적으로 저장하고 설정 실패를 성공으로 취급하지 않습니다.

공식 문서상 설정한 모드는 핸들에서 제거할 수 없고, 소켓의 경우 IFS 핸들을 반환하는 provider 지원 조건이 있습니다. 기본·skip 모드를 실행 중 추측하거나 파일 API·Winsock의 반환 규칙을 혼용하지 않습니다. 즉시 성공·pending 성공·pending 실패·즉시 오류를 모두 확인해야 합니다.

## GetQueuedCompletionStatusEx의 항목별 완료 해석

GetQueuedCompletionStatusEx의 함수 성공은 여러 항목을 수집했다는 뜻이지 모든 I/O가 성공했다는 뜻이 아닙니다. 항목별 상태와 바이트·컨텍스트를 API의 결과 해석 규칙에 따라 처리합니다. GetLastError 하나를 모든 항목의 오류로 복사하지 않습니다. 내부 상태 값과 Win32·Winsock 오류 표현을 무조건 같은 숫자로 해석하지도 않습니다.

세대 번호는 늦은 결과가 새 연결에 적용되는 것을 막지만 비교할 메모리 자체가 살아 있어야 합니다. 주소를 풀에 돌린 뒤 새 객체로 덮고 세대만 검사하는 것은 커널·worker의 오래된 포인터 접근을 안전하게 만들지 않습니다.

## 실제 API 기반 수신 경로 연결

아래는 전체 서버가 아니라 **API 경계를 보여 주는 발췌 코드**입니다. `Connection`, 연결 잠금, 참조 관리와 오류 보고는 애플리케이션이 구현할 부분입니다. 생략된 함수를 안전한 구현이 이미 있는 것처럼 가져다 쓰면 안 됩니다. 특히 제출과 소켓 종료가 같은 잠금 규칙을 따라야 합니다.

먼저 Winsock을 초기화하고 포트를 만듭니다. `WSAStartup`은 실패 코드를 반환값으로 주지만, 포트 생성 실패는 `GetLastError()`로 확인합니다.

```cpp
WSADATA wsa{};
int startupError = WSAStartup(MAKEWORD(2, 2), &wsa);
if (startupError != 0) {
    return startupError;
}

HANDLE port = CreateIoCompletionPort(INVALID_HANDLE_VALUE, nullptr, 0, 0);
if (port == nullptr) {
    DWORD error = GetLastError();
    WSACleanup();
    return static_cast<int>(error);
}
```

마지막 인자 0은 운영체제의 기본 동시 실행 수를 사용하겠다는 뜻입니다. 워커를 만들어 주는 값은 아닙니다. 앱이 별도로 스레드를 만들고 각 스레드에서 `GetQueuedCompletionStatus`를 호출해야 합니다.

소켓 생성 시에는 `WSASocketW(..., WSA_FLAG_OVERLAPPED)`로 의도를 명확히 합니다. `bind`·`listen`·접속 수락을 마친 연결 소켓을 기존 포트에 연결한 뒤 첫 수신을 제출합니다. `AcceptEx`를 사용하는 전체 접속 흐름은 [AcceptEx 노트](/tech-interview/notes/acceptex/)에서 이어집니다.

```cpp
// acceptedSocket은 접속 수락을 마친 overlapped 소켓입니다.
// connection은 소켓뿐 아니라 미완료 작업이 있는 동안에도 살아 있어야 합니다.
HANDLE associated = CreateIoCompletionPort(
    reinterpret_cast<HANDLE>(acceptedSocket), port,
    reinterpret_cast<ULONG_PTR>(connection), 0);
if (associated == nullptr) {
    DWORD error = GetLastError();
    closesocket(acceptedSocket);
    reportAssociationFailure(error);
    // connection의 생성 소유자도 여기서 자신의 참조를 정리합니다.
}
```

기존 포트를 넘겼으므로 마지막 동시 실행 인자는 무시됩니다. 소켓 하나는 하나의 포트에만 연결할 수 있고, 연결 관계는 소켓을 닫을 때까지 유지됩니다. key는 Windows가 보관하는 숫자이지 `Connection`의 수명을 늘리는 스마트 포인터가 아닙니다.

### OVERLAPPED와 수신 작업 컨텍스트

```cpp
enum class IoKind { Receive, Send };
struct Connection;

// 가상 함수나 상속 없이 표준 레이아웃으로 둡니다.
struct IoOperation {
    OVERLAPPED overlapped{};
    IoKind kind = IoKind::Receive;
    Connection* owner = nullptr;
    WSABUF buffer{};
    DWORD flags = 0;
    char storage[4096]{};
};
static_assert(std::is_standard_layout_v<IoOperation>);
```

`OVERLAPPED`는 아직 진행 중인 다른 요청에 재사용하지 않습니다. 이 예제는 매 제출마다 새로운 작업을 만들고 `buffer.buf=storage`, `buffer.len=sizeof(storage)`로 설정합니다. 나중에 풀로 최적화하더라도 이전 완료와 소비자가 끝난 뒤에만 초기화해 재사용해야 합니다. `Internal` 같은 필드를 사용자 상태 저장용으로 쓰지 않습니다.

`WSABUF` 설명자와 실제 버퍼는 구별해야 합니다. Winsock은 호출이 돌아오기 전에 설명자를 캡처하지만, 설명자가 가리키는 `storage`와 `OVERLAPPED`는 완료까지 살아 있어야 합니다. 그래서 예제는 둘을 작업 객체에 함께 두었습니다.

```cpp
// 아래 reserveOperation은 연결의 종료 검사와 pending 등록을 원자적으로 합니다.
// 성공 시 제출자 참조와 완료용 참조를 각각 확보합니다.
if (!reserveOperation(connection, operation)) {
    destroyUnsubmittedOperation(operation);
    return;
}

int rc = WSARecv(connection->socket, &operation->buffer, 1,
                 nullptr, &operation->flags,
                 &operation->overlapped, nullptr);
int error = rc == SOCKET_ERROR ? WSAGetLastError() : 0;

if (rc == SOCKET_ERROR && error != WSA_IO_PENDING) {
    // 이 요청은 시작되지 않았고 완료 통지도 오지 않습니다.
    finishSubmissionFailure(operation, error);
}
// rc==0도 여기서 수신 데이터를 처리하거나 완료 참조를 반환하지 않습니다.
// 기본 IOCP 모드에서는 완료 워커가 그 일을 합니다.
releaseSubmitterReference(operation);
```

`WSA_IO_PENDING`은 재시도하라는 오류가 아닙니다. 이미 시작된 요청이므로 같은 `OVERLAPPED`로 다시 `WSARecv`를 부르면 안 됩니다. 마지막 callback 인자는 null로 두어 APC 완료 루틴과 IOCP를 섞지 않았습니다. `hEvent`도 0이며 포트 통지 억제를 켜지 않았습니다.

### 워커의 실패 완료 수집과 종결 처리

```cpp
for (;;) {
    DWORD bytes = 0;
    ULONG_PTR key = 0;
    OVERLAPPED* overlapped = nullptr;
    BOOL ok = GetQueuedCompletionStatus(port, &bytes, &key,
                                        &overlapped, INFINITE);
    DWORD error = ok ? ERROR_SUCCESS : GetLastError();

    if (overlapped == nullptr) {
        if (ok && key == StopWorkerKey) break;
        if (!ok) {
            reportPortWaitFailure(error);
            break; // 서버 감독자가 포트 장애와 남은 작업을 처리합니다.
        }
        continue; // 이 서버가 정의한 다른 사용자 제어 패킷
    }

    auto* operation = CONTAINING_RECORD(overlapped, IoOperation, overlapped);
    // 사용자 패킷에는 non-null OVERLAPPED를 쓰지 않는 규약입니다.
    // failed I/O도 반드시 같은 종결 경로로 넘깁니다.
    finishIo(operation, bytes, error);
}
```

`finishIo`에서 수신 오류가 있으면 연결 종료 절차로, 성공한 **양수 길이 TCP 수신의 0바이트 완료**면 상대의 정상 송신 종료로 처리합니다. UDP의 0바이트 메시지나 의도적으로 제출한 0바이트 수신까지 같은 EOF 규칙으로 묶지 않습니다. 데이터가 있으면 정확히 `bytes`만 파서에 넣습니다. TCP 메시지 하나가 완성됐다는 뜻은 아니므로 [프레임 복원](/tech-interview/notes/tcp/)이 이어집니다.

파서가 버퍼를 복사해 소비했다면 연결이 열린 상태에서 다음 수신을 하나 제출합니다. 파서나 다른 실행기에 view를 넘겼다면 그 소비자가 끝날 때까지 기존 작업 버퍼를 유지합니다. 연결별 잠금이나 직렬 실행기를 사용해 다음 수신 등록과 종료가 충돌하지 않게 합니다. 한 워커가 완료를 처리하는 동안 다른 워커가 같은 연결의 송신 완료를 처리할 수도 있습니다.

## 구형 Windows 코드의 API 동작 차이

오래된 서버 코드를 볼 때는 함수가 존재하는지와 같은 함수의 동작이 달라졌는지를 나눠 보아야 합니다.

| 항목 | 확인할 차이 | 구현에 미치는 영향 |
| --- | --- | --- |
| GQCS 대기 중 포트 닫기 | XP·Server 2003에서는 이후 버전의 `ERROR_ABANDONED_WAIT_0` 반환 동작이 없고 패킷이나 timeout까지 기다릴 수 있음 | 포트 close만으로 워커를 깨우는 종료 코드를 보편 규칙으로 쓰지 않음 |
| GQCS timeout | Windows 7·Server 2008 R2까지는 절전 시간을 포함, Windows 8·Server 2012부터는 포함하지 않음 | 사용자 기한을 GQCS 대기 숫자 하나로 대신하지 않음 |
| `MSG_PUSH_IMMEDIATE` | Windows 8.1·Server 2012 R2 이후 지원 | 부분 수신 완료 지연을 줄이라는 hint이며 즉시 완료 보장이나 모든 전송의 권장 옵션은 아님 |
| overlapped 수신 timeout | `SO_RCVTIMEO`는 blocking 수신용 | overlapped 작업의 deadline은 별도 timer와 취소·완료 회수로 구현 |

SDK의 `_WIN32_WINNT`를 높이는 것은 헤더 선언을 여는 빌드 선택이지 구형 OS에 API 구현을 추가하는 일이 아닙니다. 지원 OS를 낮게 유지해야 한다면 사용하는 API의 최소 지원 버전과 동적 함수 조회·fallback을 함께 설계합니다. 현재 문서의 Requirements 표를 API의 최초 등장 연도나 현재 보안 지원 기간과 동일시하지 않습니다.

## 참조 문서와 검증 범위

[GetQueuedCompletionStatus](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-getqueuedcompletionstatus)의 반환 조합과 통지 억제, [SetFileCompletionNotificationModes](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setfilecompletionnotificationmodes)의 skip 조건을 확인했습니다. 실제 Windows 실행 테스트는 별도로 필요합니다.

테스트는 반환 전 완료, 기본 모드 즉시 성공, skip 모드 즉시 성공, pending, 취소·오류, 사용자 패킷과 GQCS timeout을 교차시킵니다. 작업 집합·연결 pending·참조 반환을 대조해 누수와 이중 해제를 각각 검출해야 합니다.

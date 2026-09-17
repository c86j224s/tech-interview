---
id: acceptex
title: AcceptEx 접속 수락
topic: 네트워크
summary: 수락 소켓과 주소 버퍼를 준비한 뒤, 새 연결을 받아 첫 수신으로 이어가는 과정을 설명합니다.
questionIds: [iocp-acceptex, acceptex-failed-socket-reuse, acceptex-pool-listen-backlog]
---

# AcceptEx 접속 수락

**IOCP 읽는 순서:** [수신과 완료](/tech-interview/notes/iocp-completion/) → [접속 수락](/tech-interview/notes/acceptex/) → [워커 구성](/tech-interview/notes/iocp-scheduling/) → [송신](/tech-interview/notes/iocp-send/) → [종료](/tech-interview/notes/iocp-shutdown/)

수신 코드를 만들었다면 이제 그 코드에 새 연결을 공급할 차례입니다. 일반적인 accept와 달리 AcceptEx는 새 연결을 받을 소켓을 서버가 미리 준비합니다. 연결이 들어오면 완료 워커가 그 소켓을 넘겨받아 통신을 시작합니다.

처음에는 **접속 수락과 첫 데이터 수신을 분리**해서 읽어 보세요. 두 일을 한 번에 처리하는 옵션은 기본 흐름을 이해한 뒤 살펴보겠습니다.

## TCP 연결과 AcceptEx 완료 대기

AcceptEx는 새 연결 수락·로컬/원격 주소·선택적인 초기 데이터 수신을 한 중첩 작업으로 묶는 Windows 확장입니다. `dwReceiveDataLength=0`이면 데이터 수신을 기다리지 않고 연결 도착으로 완료할 수 있습니다. 0보다 크면 연결 후 데이터도 읽어야 완료하므로, 연결만 하고 아무것도 보내지 않는 클라이언트가 슬롯을 붙잡을 수 있습니다.

지정 길이를 반드시 전부 채워야만 완료된다고 단정하지 말고 실제 완료 바이트와 오류를 봅니다. AcceptEx 완료는 앱 프레임 완성·인증·세션 생성 완료가 아닙니다.

## AcceptEx 사전 준비 소켓·작업

| 입력 | 요구 |
| --- | --- |
| 듣기 소켓 | listen 상태 |
| 수락 소켓 | 미리 생성, bound·connected 상태가 아님 |
| OVERLAPPED | 작업마다 독립, 종결까지 생존 |
| 출력 버퍼 | 데이터 + 로컬 주소 + 원격 주소 영역 |
| 주소 예약 길이 | 사용 transport의 최대 주소 길이보다 각각 최소 16바이트 큼 |

IPv4 sockaddr_in이 16바이트인 예에서는 주소 영역 각각 최소 32바이트가 필요합니다. 다른 주소 계열에 IPv4 크기를 그대로 쓰면 안 됩니다. 전체 버퍼 크기 합도 overflow와 실제 할당 범위를 확인합니다.

```diagram
{"title":"초기 데이터와 주소 영역은 다릅니다","caption":"화살표는 완료 후 해석 경로입니다. 데이터는 완료 바이트 수만큼 파서로, 주소는 동일 길이 인자로 GetAcceptExSockaddrs에 전달합니다.","rows":[[{"id":"buffer","label":"AcceptEx 출력 버퍼"}],[{"id":"data","label":"앞: 초기 수신 데이터","detail":["완료 바이트 수로 해석"]},{"id":"addresses","label":"뒤: 내부 주소 형식","detail":["로컬·원격 예약 영역"]}],[{"id":"parser","label":"프레이밍 파서"},{"id":"extract","label":"GetAcceptExSockaddrs"}]],"edges":[{"from":"buffer","to":"data","label":"수신 부분"},{"from":"buffer","to":"addresses","label":"주소 부분"},{"from":"data","to":"parser","label":"부분 프레임 가능"},{"from":"addresses","to":"extract","label":"공식 해석 API"}]}
```

## AcceptEx 반환값과 완료 통지의 구분

AcceptEx는 BOOL을 반환합니다. TRUE는 즉시 완료, FALSE일 때 WSAGetLastError의 ERROR_IO_PENDING은 정상 접수 후 진행 중입니다. 다른 즉시 오류와 구별해야 합니다. 비동기 완료의 바이트 수는 완료 통지에서 얻으며 동기용 출력 변수가 나중에 자동 갱신된다고 가정하지 않습니다.

기본 IOCP 통지 모드에서는 즉시 TRUE에도 완료 패킷을 받을 수 있으므로 두 경로에서 동시에 처리하지 않습니다. 제출 전에 작업·연결 참조를 예약하고, 명시적인 통지 모드에 맞는 한 종결 경로를 둡니다. AcceptEx는 듣기 핸들에 제출한 작업이고 이후 새 소켓의 WSARecv는 다른 작업 맥락입니다.

## AcceptEx 성공 후 context 설정과 소켓 준비

```text
onAcceptComplete(context, result):
    if result failed:
        close_failed_accept_socket_under_policy()
        release_context_after_last_use()
        replenish_if_accepting()
        return
    set_SO_UPDATE_ACCEPT_CONTEXT(acceptedSocket, listenSocket)
    extract_addresses_with_original_lengths()
    apply_required_socket_options()
    associate_new_socket_with_IOCP_and_connection_key()
    feed_initial_bytes_to_parser()
    submit_next_receive_if_open()
    replenish_accept_slots_if_accepting()
```

각 설정 실패는 새 연결 정리 경로로 처리해야 합니다. SO_UPDATE_ACCEPT_CONTEXT에는 듣기 소켓을 option 값으로 전달합니다. 그 전에는 듣기 소켓 속성을 자동 상속했다고 가정하지 않습니다. 주소는 버퍼의 내부 구조를 임의 오프셋 캐스팅으로 읽지 않고 GetAcceptExSockaddrs를 사용합니다.

## 실패 소켓 재사용의 별도 상태 계약

AcceptEx가 실패했다고 같은 소켓·OVERLAPPED를 곧바로 다시 사용할 수 있다고 보장되지 않습니다. 작업이 실제 종결됐는지, 소켓이 bound·connected 상태인지, 지원되는 재사용 절차로 초기화했는지 확인해야 합니다. 이해하기 쉬운 기본 정책은 실패 소켓을 닫고 새 소켓으로 보충하는 것입니다.

특정 TransmitFile의 disconnect·reuse flags처럼 문서가 정한 재사용 상태 전환은 별도 계약입니다. 그 기능이 모든 실패 소켓에 적용된다고 일반화하지 않습니다. 작업 메모리 풀 재사용과 소켓 재사용도 서로 다른 수명입니다.

## listen backlog와 AcceptEx 수락 슬롯의 차이

listen backlog는 커널의 연결 대기와 관련되고 AcceptEx 슬롯 수는 앱이 준비한 수락 소켓·작업·버퍼 수입니다. 슬롯을 늘리면 순간 연결을 받아 처리할 여유는 늘 수 있지만 인증·실제 작업 처리량이 자동 증가하지 않습니다.

초기 수신을 포함한 슬롯을 침묵 클라이언트가 오래 보유하지 않도록 첫 데이터 기한과 인증 전 연결 수를 제한합니다. 완료 보충률, 수락 지연·FD·메모리·거절률을 함께 봅니다. 서버 종료 후 완료에서 새 AcceptEx를 보충하지 않도록 제출 게이트를 공유합니다.

## AcceptEx 단일 접속의 API 실행

앞의 수신 예제에 새 연결을 공급하려면 듣기 소켓부터 포트에 연결합니다. 그다음 해당 소켓의 provider에서 확장 함수 포인터를 얻습니다. 헤더에 선언이 보인다는 사실만으로 초기화가 끝난 것은 아닙니다.

```cpp
LPFN_ACCEPTEX acceptEx = nullptr;
GUID extensionId = WSAID_ACCEPTEX;
DWORD returned = 0;
int rc = WSAIoctl(listenSocket, SIO_GET_EXTENSION_FUNCTION_POINTER,
                 &extensionId, sizeof(extensionId),
                 &acceptEx, sizeof(acceptEx),
                 &returned, nullptr, nullptr);
if (rc == SOCKET_ERROR) {
    int error = WSAGetLastError();
    // 아직 AcceptEx 작업은 제출하지 않았습니다.
    reportListenerSetupFailure(error);
    return;
}
```

이후 미리 만든 **bound도 connected도 아닌** 수락 소켓을 넘깁니다. 여기서는 첫 데이터 수신을 분리하려고 수신 길이를 0으로 정했습니다. 출력 버퍼는 그래도 주소를 받을 공간이 필요합니다.

```cpp
constexpr DWORD AddressBytes = sizeof(sockaddr_storage) + 16;
struct AcceptOperation {
    OVERLAPPED overlapped{};
    SOCKET accepted = INVALID_SOCKET;
    char addresses[AddressBytes * 2]{};
};

// op와 듣기 소켓의 수명 및 제출/완료 참조를 먼저 확보한 뒤 호출합니다.
DWORD immediateBytes = 0;
BOOL ok = acceptEx(listenSocket, op->accepted, op->addresses,
                   0, AddressBytes, AddressBytes,
                   &immediateBytes, &op->overlapped);
int error = ok ? 0 : WSAGetLastError();
if (!ok && error != ERROR_IO_PENDING) {
    finishAcceptSubmissionFailure(op, error);
}
// 기본 IOCP 모드: TRUE와 pending 모두 완료 워커가 처리합니다.
// 제출자 참조는 API 반환 뒤 별도로 놓습니다.
```

이 코드는 제출 경계의 발췌입니다. `op->accepted` 생성 실패 처리와 참조 관리 함수는 서버 구현에 필요합니다. 완료 key는 듣기 소켓에 연결한 값이고, `OVERLAPPED*`로 어떤 수락 작업인지 찾습니다. Receive 작업과 Accept 작업을 무조건 같은 구조체로 캐스팅하지 말고 공통 태그/레이아웃 또는 key별 분기 규약을 정합니다.

성공 완료 뒤에는 다음 호출로 수락 소켓의 context를 갱신합니다.

```cpp
if (setsockopt(op->accepted, SOL_SOCKET, SO_UPDATE_ACCEPT_CONTEXT,
               reinterpret_cast<const char*>(&listenSocket),
               sizeof(listenSocket)) == SOCKET_ERROR) {
    int error = WSAGetLastError();
    closeRejectedConnection(op, error);
    return;
}
```

주소는 `GetAcceptExSockaddrs`에 **제출 때의 수신 길이와 두 주소 길이 그대로** 넘겨 추출합니다. 반환 포인터는 출력 버퍼 내부를 가리키므로 주소를 연결 객체에 보관하려면 유효 길이를 확인해 복사합니다. 이후 새 소켓을 연결 key로 포트에 연결하고 첫 WSARecv를 제출합니다. 어느 단계든 실패하면 수락 슬롯의 소켓을 정리하되, 이미 제출한 다른 I/O의 완료 수명까지 즉시 끝났다고 해석하지 않습니다.

초기 수신 길이가 0이므로 Accept 완료의 bytes가 0인 것은 정상입니다. 이를 TCP 수신의 EOF와 혼동하면 접속하자마자 모든 연결을 끊게 됩니다. `kind=Accept`인지 `kind=Receive`인지 먼저 보고 바이트 수를 해석해야 하는 이유입니다.

### 서버 선행 메시지와 초기 수신 대기 회피

서버가 먼저 환영 메시지나 프로토콜 안내를 보내야 하는데 AcceptEx에 초기 수신을 요구하면, client도 server의 첫 메시지를 기다려 양쪽이 멈출 수 있습니다. 0으로 수락을 끝낸 뒤 인증 전 연결에 별도 첫 메시지 기한을 두는 구성이 이해하기 쉽습니다. 초기 수신을 묶는 최적화를 선택했다면 `SO_CONNECT_TIME`으로 연결됐지만 아직 데이터가 없는 수락 슬롯을 관찰하는 방법도 있습니다. 기한 초과로 수락 소켓을 닫아도 작업 컨텍스트는 실패 완료 회수까지 유지합니다.

## 참고 문서와 직접 검증 시나리오

[Microsoft AcceptEx 문서](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nf-mswsock-acceptex)에서 초기 수신 0의 의미, 주소 공간, 반환값과 context 설정을 확인했습니다. 해당 페이지의 예제 조각을 모든 오류·pending 경로가 완성된 운영 서버로 간주하지 않습니다.

실제 Windows에서 연결 후 무송신·부분 초기 데이터·빠른 FIN/RST·context 설정 실패·취소·수락 소켓 교체를 시험해야 합니다. 이 노트는 문서 기반 설계이며 실행 결과를 꾸며 보고하지 않습니다.

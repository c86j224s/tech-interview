---
id: acceptex
title: AcceptEx의 수락·초기 데이터·주소 수명
topic: 네트워크
summary: 미리 준비한 소켓·버퍼의 역할과 초기 수신 길이를 구분하고 완료 후 context·주소 추출·실패 소켓·수락 용량을 설명합니다.
questionIds: [iocp-acceptex, acceptex-failed-socket-reuse, acceptex-pool-listen-backlog]
---

# AcceptEx의 수락·초기 데이터·주소 수명

## TCP가 연결됐어도 수락 작업은 기다릴 수 있습니다

AcceptEx는 새 연결 수락·로컬/원격 주소·선택적인 초기 데이터 수신을 한 중첩 작업으로 묶는 Windows 확장입니다. `dwReceiveDataLength=0`이면 데이터 수신을 기다리지 않고 연결 도착으로 완료할 수 있습니다. 0보다 크면 연결 후 데이터도 읽어야 완료하므로, 연결만 하고 아무것도 보내지 않는 클라이언트가 슬롯을 붙잡을 수 있습니다.

지정 길이를 반드시 전부 채워야만 완료된다고 단정하지 말고 실제 완료 바이트와 오류를 봅니다. AcceptEx 완료는 앱 프레임 완성·인증·세션 생성 완료가 아닙니다.

## 미리 준비하는 것은 소켓과 작업입니다

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

## 반환값과 완료 통지를 나눕니다

AcceptEx는 BOOL을 반환합니다. TRUE는 즉시 완료, FALSE일 때 WSAGetLastError의 ERROR_IO_PENDING은 정상 접수 후 진행 중입니다. 다른 즉시 오류와 구별해야 합니다. 비동기 완료의 바이트 수는 완료 통지에서 얻으며 동기용 출력 변수가 나중에 자동 갱신된다고 가정하지 않습니다.

기본 IOCP 통지 모드에서는 즉시 TRUE에도 완료 패킷을 받을 수 있으므로 두 경로에서 동시에 처리하지 않습니다. 제출 전에 작업·연결 참조를 예약하고, 명시적인 통지 모드에 맞는 한 종결 경로를 둡니다. AcceptEx는 듣기 핸들에 제출한 작업이고 이후 새 소켓의 WSARecv는 다른 작업 맥락입니다.

## 성공 후 context를 설정하고 새 소켓을 준비합니다

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

## 실패 소켓의 재사용은 별도 상태 계약입니다

AcceptEx가 실패했다고 같은 소켓·OVERLAPPED를 곧바로 다시 사용할 수 있다고 보장되지 않습니다. 작업이 실제 종결됐는지, 소켓이 bound·connected 상태인지, 지원되는 재사용 절차로 초기화했는지 확인해야 합니다. 이해하기 쉬운 기본 정책은 실패 소켓을 닫고 새 소켓으로 보충하는 것입니다.

특정 TransmitFile의 disconnect·reuse flags처럼 문서가 정한 재사용 상태 전환은 별도 계약입니다. 그 기능이 모든 실패 소켓에 적용된다고 일반화하지 않습니다. 작업 메모리 풀 재사용과 소켓 재사용도 서로 다른 수명입니다.

## Backlog와 미리 제출한 개수는 다른 큐입니다

listen backlog는 커널의 연결 대기와 관련되고 AcceptEx 슬롯 수는 앱이 준비한 수락 소켓·작업·버퍼 수입니다. 슬롯을 늘리면 순간 연결을 받아 처리할 여유는 늘 수 있지만 인증·실제 작업 처리량이 자동 증가하지 않습니다.

초기 수신을 포함한 슬롯을 침묵 클라이언트가 오래 보유하지 않도록 첫 데이터 기한과 인증 전 연결 수를 제한합니다. 완료 보충률, 수락 지연·FD·메모리·거절률을 함께 봅니다. 서버 종료 후 완료에서 새 AcceptEx를 보충하지 않도록 제출 게이트를 공유합니다.

## 공식 계약과 실제 실험을 분리합니다

[Microsoft AcceptEx 문서](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nf-mswsock-acceptex)에서 초기 수신 0의 의미, 주소 공간, 반환값과 context 설정을 확인했습니다. 해당 페이지의 예제 조각을 모든 오류·pending 경로가 완성된 운영 서버로 간주하지 않습니다.

실제 Windows에서 연결 후 무송신·부분 초기 데이터·빠른 FIN/RST·context 설정 실패·취소·수락 소켓 교체를 시험해야 합니다. 이 노트는 문서 기반 설계이며 실행 결과를 꾸며 보고하지 않습니다.

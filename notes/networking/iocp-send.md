---
id: iocp-send
title: IOCP 비동기 송신
topic: 네트워크
summary: 여러 곳에서 만든 응답을 연결별 큐에 모아 보내고, 송신 완료 뒤 버퍼를 정리하는 과정을 따라갑니다.
questionIds: [iocp-send-order, wsabuf-descriptor-payload-lifetime, send-completion-versus-business-ack]
---

# IOCP 비동기 송신

이 노트는 IOCP 송신을 “WSASend를 호출하면 끝나는 작업”이 아니라 완성 프레임의 소유권, 연결별 제출 순서, overlapped 완료, 버퍼 재사용 시점이 맞물린 상태 기계로 설명합니다. TCP의 바이트 순서와 애플리케이션 메시지의 경계·업무 성공은 서로 다른 계층의 계약입니다.

**IOCP 읽는 순서:** [수신과 완료](/tech-interview/notes/iocp-completion/) → [접속 수락](/tech-interview/notes/acceptex/) → [워커 구성](/tech-interview/notes/iocp-scheduling/) → [송신](/tech-interview/notes/iocp-send/) → [종료](/tech-interview/notes/iocp-shutdown/)

채팅 메시지와 알림이 동시에 만들어졌다고 해 보겠습니다. 두 스레드가 같은 소켓으로 각각 보내기 시작하면, 메시지의 헤더와 본문이 의도한 순서대로 나간다고 장담하기 어렵습니다.

여기서는 **메시지를 만드는 일은 여러 곳에서 하되, 소켓에 보내는 일은 연결마다 한곳에서 맡기는 구성**으로 시작합니다. 이 구조를 잡으면 송신 순서뿐 아니라 남은 데이터와 버퍼 수명도 따라가기 쉬워집니다.

## TCP 스트림 순서와 프레임 혼합

메시지 A의 헤더를 보낸 뒤 다른 스레드가 B 전체를 보내고 다시 A 본문을 보낸다면 수신자는 A 헤더·B·A 본문을 받게 될 수 있습니다. TCP가 신뢰성 있게 전달해도 프레임은 깨집니다. 메시지 생성 순서·WSASend 호출 순서·완료 처리 순서를 구분해야 합니다.

Winsock 문서도 같은 stream socket에 여러 스레드가 WSASend를 동시에 호출하면 provider의 큰 요청 분할 때문에 의도하지 않은 데이터 섞임이 생길 수 있음을 경고합니다. 연결별 송신 책임을 한곳에 모으는 것이 명확한 출발점입니다.

먼저 TCP가 보장하는 것은 순서 있는 바이트 스트림이지 메시지 경계가 아니라는 점을 전제로 합니다. 따라서 A의 헤더와 본문을 별도 WSASend로 내보내는 동안 B가 끼어들면 수신 파서는 A/B/A 바이트를 하나의 잘못된 프레임으로 볼 수 있습니다. 프레임을 완성해 연결별 큐에 넣는 것이 애플리케이션 경계를 보존하는 방법입니다.

## 완성 프레임 큐와 단일 제출 소유자

```diagram
{"title":"메시지 생산과 소켓 제출의 분리","caption":"화살표는 완성 프레임의 이동입니다. 여러 생산자는 큐에 넣고, 연결의 한 송신 소유자가 순서대로 제출해 헤더·본문 혼합을 막습니다.","rows":[[{"id":"a","label":"생산자 A","detail":["완성 프레임 A"]},{"id":"b","label":"생산자 B","detail":["완성 프레임 B"]}],[{"id":"queue","label":"연결별 송신 큐","detail":["바이트·대기시간 상한"]}],[{"id":"sender","label":"송신 소유자","detail":["WSASend 순서와 in-flight 관리"]}]],"edges":[{"from":"a","to":"queue","label":"원자 enqueue"},{"from":"b","to":"queue","label":"원자 enqueue"},{"from":"queue","to":"sender","label":"논리 순서"}]}
```

처음에는 한 연결에 송신 한 개만 in-flight로 두면 다음 프레임 제출과 잔량 처리의 책임이 단순합니다. 여러 중첩 송신을 허용하려면 실제 호출 순서·완료 역순·실패 범위를 별도 상태로 관리해야 합니다. 완료를 기다린다는 사실이 상대 앱 처리를 기다린다는 뜻은 아닙니다.

송신 상태를 `queue → inFlight → completion → next`로 추적하면 생산자 동시성과 transport 동시성을 분리할 수 있습니다. 한 연결에 하나의 in-flight만 허용하면 잔량이 있는 앞 프레임이 끝나기 전에 뒤 프레임이 제출되지 않는 불변식이 단순해집니다. 더 높은 병렬성을 선택하면 제출 순서·완료 역순·부분 범위를 별도 상태로 증명해야 합니다.

## WSABUF 설명자와 실제 버퍼의 수명

| 대상 | 역할 | 수명 |
| --- | --- | --- |
| WSABUF 배열 | 각 payload 주소·길이 descriptor | overlapped provider가 반환 전 캡처하는 계약 |
| payload | 실제 보낼 바이트 | transport가 소비하는 완료까지 유효, 수정·재사용 금지 |
| OVERLAPPED | 개별 비동기 작업 | 실제 종결까지 유효 |
| 사용자 후속 참조 | 감사·재전송·파싱 등 | 그 소비가 끝날 때까지 별도 유지 |

공식 overlapped WSASend 계약상 provider는 WSABUF 구조체들을 반환 전에 캡처해 스택 배열을 사용할 수 있습니다. 하지만 배열이 가리키는 payload와 OVERLAPPED까지 스택 수명으로 끝내도 된다는 뜻은 아닙니다. 보수적으로 작업 객체 안에 descriptor를 둘 수도 있으나 불필요한 수명 주장과 실제 계약을 구분합니다.

수명 시험은 WSABUF 배열, payload, OVERLAPPED를 각각 언제 생성·수정·해제하는지 표시하는 방식으로 진행합니다. provider가 descriptor를 호출 중 캡처할 수 있다는 사실은 descriptor의 주소만 충분하다는 뜻이 아니며, payload와 OVERLAPPED는 실제 I/O 완료까지 유효해야 합니다. 감사·재시도용 참조가 남아 있다면 transport 완료 후에도 payload를 즉시 재사용할 수 없습니다.

## 제출 실패와 완료 처리의 단일화

```text
sendNext(connection):
    under_connection_serial_executor:
        if closing or inFlight or queue.empty(): return
        frame = queue.front
        operation = prepare_owned_payload_and_overlapped(frame)
        reserve_operation_references_before_call()
        inFlight = operation
        result = WSASend(...)
        if definite_failure_without_completion(result):
            finish_send_once(operation, failure)
        # 기본 모드 즉시 성공과 pending은 완료 경로에서 처리
```

실제 API 오류는 WSAGetLastError를 즉시 보존하고 통지 모드에 맞게 분기합니다. 일반 어댑터에서 부분 진행을 허용한다면 완료된 범위만 반영하고 남은 offset을 이어 제출하되, 뒤 프레임이 잔량보다 먼저 나가지 않게 합니다. Winsock 모드·오류별 부분 바이트 의미를 확인하지 않고 비동기 성공을 임의로 쪼개거나 실패 뒤 자동 재전송하지 않습니다.

큐가 비었다고 송신 활성 플래그를 내리는 순간 새 생산자가 들어오는 경쟁도 막아야 합니다. 큐 상태와 활성화·깨움은 같은 직렬 경계 또는 원자적 재확인으로 연결합니다.

## 완료와 전달·업무 성공 확인의 분리

WSASend 성공 완료는 transport가 버퍼를 소비한 경계이며 상대가 성공적으로 받았다는 보장조차 아닙니다. TCP ACK도 상대 TCP 스택의 수신 확인이지 메시지 파싱·원장 커밋 확인은 아닙니다. 중요 명령에는 요청 ID와 애플리케이션 ACK·결과 조회가 필요합니다.

연결이 끊기면 아직 미제출인 프레임, 일부 전송 또는 결과 불확정인 프레임, 상대 적용은 됐지만 응답을 잃은 프레임을 구분합니다. 새 연결에서 무조건 모든 프레임을 새 ID로 재전송하면 중복 효과가 생깁니다.

## WSASend 제출 범위의 코드 표현

수신한 프레임에 응답한다고 생각해 보겠습니다. 길이 헤더와 본문을 완성한 뒤 연결별 송신 큐에 넣습니다. 처음 구현에서는 큐 맨 앞 프레임만 진행시키면, 다음 프레임이 앞 프레임의 잔량 사이에 끼어드는 일을 막기 쉽습니다.

```cpp
// frame은 이 송신 완료까지 변경·재할당되지 않는 소유 버퍼입니다.
// offset과 길이는 연결의 직렬 실행 경로에서만 변경합니다.
std::size_t remaining = frame.size() - offset;
ULONG chunk = static_cast<ULONG>(
    std::min(remaining, static_cast<std::size_t>(ULONG_MAX)));
operation->buffer.buf = frame.data() + offset;
operation->buffer.len = chunk;

int rc = WSASend(socket, &operation->buffer, 1, nullptr, 0,
                 &operation->overlapped, nullptr);
int error = rc == SOCKET_ERROR ? WSAGetLastError() : 0;
if (rc == SOCKET_ERROR && error != WSA_IO_PENDING) {
    finishSendSubmissionFailure(operation, error);
}
```

이 발췌 앞에는 열린 연결 확인·작업 등록·제출자/완료 참조 확보가 필요합니다. 빈 프레임 처리, `offset <= frame.size()` 검증, API 호출과 소켓 close의 직렬화도 포함해야 합니다. `size_t`를 무조건 `ULONG`으로 잘라 넘기지 않도록 한 요청 크기를 제한했습니다. 기본 모드에서 즉시 0을 반환해도 여기서 프레임을 pop하지 않습니다.

### 완료 범위와 다음 송신 범위

송신 상태에는 전체 길이, 이번 제출 길이, 현재 offset을 둡니다. 성공 완료에서 반환 bytes가 이번 제출 길이보다 크면 내부 계약 오류입니다. 성공한 진행량만 offset에 더하고, 잔량이 있으면 **새 작업 또는 재사용 가능한 상태로 정리된 작업**에 다음 범위를 설정합니다. 앞 프레임 전체가 끝나야 뒤 프레임을 시작합니다.

가령 전체 6바이트 `ABCDEF` 중 완료로 확인한 범위가 4바이트인 어댑터 경로라면 다음 범위는 `EF`입니다. `ABCDEF` 전체를 다시 보내면 `ABCDABCDEF`가 됩니다. 이 예는 부분 진행을 처리하는 상태 계산이며, 특정 Winsock provider에서 성공한 overlapped 송신이 반드시 이런 크기로 나뉜다는 측정 결과는 아닙니다. 실제 provider·모드의 계약도 확인해야 합니다.

오류 완료는 이 성공 경로와 다릅니다. 오류가 나면 bytes 숫자만 믿고 같은 연결에서 무조건 이어 보내지 않고, 연결 상태와 오류 의미를 먼저 판단합니다. 새 연결에서 재시도할 때는 상대가 이미 처리했는지 모를 수 있어 애플리케이션 요청 ID·ACK·결과 조회가 필요합니다. 비어 있지 않은 송신의 0바이트 진행을 무한히 재제출하는 루프도 두지 않습니다.

### 버퍼를 Pool에 돌리는 시점

송신 완료를 꺼낸 뒤 transport가 더 이상 payload를 사용하지 않는 경계를 확인했다고 해도, 감사 기록이나 재시도용 원본을 다른 작업이 참조하면 그 참조는 남습니다. 반대로 실제 송신이 진행 중인데 큐에서 pop했다는 이유로 vector를 재사용하면 transport가 변경된 메모리를 읽을 수 있습니다. 송신 큐의 논리 항목 수와 실제 버퍼 소유권을 따로 추적합니다.

## 느린 상대에 따른 큐 메모리 점유

연결별 큐 바이트·항목 수·최대 나이·in-flight 수를 제한합니다. 최신 상태는 합칠 수 있어도 거래 명령은 임의 폐기하면 안 됩니다. 생산자 대기·빠른 거절·연결 종료 후 내구 재생 등 메시지 의미에 맞는 정책을 둡니다.

여러 생산자의 헤더·본문 교차, 완료 순서 역전, 즉시 성공·pending·실패·취소, payload 조기 재사용을 시험합니다. 수신 파서가 복원한 프레임 순서와 작업별 한 번의 정리, 최종 도메인 결과를 각각 확인해야 합니다.

[Microsoft WSASend 문서](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsasend)의 provider 캡처·동시 호출 경고·완료 의미를 확인했습니다. Windows에서 실제 I/O 실험을 수행한 결과는 아니므로 대상 provider·모드의 테스트가 별도로 필요합니다.

선택 기준은 메시지 의미별 손실 가능성입니다. 최신 상태 snapshot은 오래된 항목을 합칠 수 있지만 거래 명령·보상 event는 임의 폐기 대신 backpressure, 빠른 거절, 내구 재생 중 하나를 명시해야 합니다. 검증에서는 큐 바이트·최대 나이·in-flight·연결 종료 시 미제출/결과 불확정 프레임을 따로 관찰합니다.

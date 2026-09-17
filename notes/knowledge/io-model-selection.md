---
id: io-model-selection
title: 서버 I/O 모델 선택과 이식
topic: 네트워크
summary: 준비 통지·완료 통지·등록 I/O의 계약을 같은 상태 머신으로 비교하고, workload와 운영 제약에 맞는 선택 및 단계적 이식 방법을 설명합니다.
questionIds: []
prerequisites: [iocp-foundations]
related: [iocp-completion, iocp-scheduling, iocp-shutdown, iocp-send, tcp]
reviewedAt: '2026-09-17'
---

# 서버 I/O 모델 선택과 이식

## 선택 문제와 비교 단위

서버 I/O 모델을 고를 때 “어느 API가 가장 빠른가”부터 묻기 쉽습니다. 그러나 준비 통지(readiness notification)는 지금 작업을 시도할 조건을 알려 주고, 완료 통지(completion notification)는 앞서 맡긴 작업의 결과를 알려 줍니다. 등록 I/O는 여기에 버퍼 등록과 큐 용량이라는 별도 자원 계약을 더합니다.

따라서 kqueue·기존 IOCP·Winsock RIO를 함수 이름만 바꾸어 이식하면 안 됩니다. 비교할 최소 단위는 한 연결의 상태, 한 I/O 작업의 buffer ownership, 실제 반환값과 오류, 다음 작업을 제출할 조건입니다. 통지 자체와 데이터·프레임·업무 처리를 각각 다른 사건으로 기록해야 합니다.

이 글은 특정 플랫폼을 승자로 정하지 않습니다. 동일한 TCP 서버를 서로 다른 모델에 옮길 때 무엇을 공통 상태로 만들고, 어떤 부분을 플랫폼별 어댑터에 남길지 설명합니다. 성능 결론은 실행한 workload에서만 내릴 수 있으므로, 여기서는 선택 근거와 측정 설계를 함께 제시합니다.

## 세 모델의 기본 흐름

BSD·macOS kqueue는 `EVFILT_READ`와 `EVFILT_WRITE`로 디스크립터의 현재 준비 상태를 관찰합니다. 이벤트를 회수한 뒤 애플리케이션이 논블로킹 `recv`·`send`를 호출하고, `EAGAIN`이나 실제 바이트를 기준으로 다음 상태를 결정합니다. 필터 조건은 회수 시점에 다시 평가될 수 있고 여러 trigger가 하나로 집계될 수 있습니다.

기존 Windows overlapped IOCP는 `WSARecv`·`WSASend`에 buffer와 `OVERLAPPED`를 제출합니다. 작업이 끝나면 IOCP completion packet을 `GetQueuedCompletionStatus`로 회수하고, key·OVERLAPPED·bytes·오류를 사용해 작업을 종결합니다. 즉시 성공과 pending이 기본 통지 모드에서 같은 완료 경로로 올 수 있으므로 제출 결과만으로 payload를 처리하지 않습니다.

Winsock RIO는 `RIO_RQ`로 송수신을 제출하고 `RIO_CQ`에서 `RIORESULT`를 dequeue합니다. `RIONotify`를 IOCP에 연결하더라도 IOCP 패킷은 RIO 결과 자체가 아니라 CQ를 확인하라는 신호입니다. RIO의 등록 버퍼, 유한한 CQ, RQ의 outstanding 제한은 기존 overlapped 모델에 자동으로 존재하는 계약이 아닙니다.

| 모델 | 통지가 말하는 것 | 실제 데이터 결과 | 수명 핵심 |
| --- | --- | --- | --- |
| kqueue | 디스크립터가 읽기·쓰기를 시도할 조건 | 논블로킹 호출 반환값 | callback·local queue가 `udata` 참조를 보유 |
| 기존 IOCP | 제출한 overlapped I/O의 완료 | completion bytes·상태·작업 context | 완료까지 `OVERLAPPED`·버퍼 유효 |
| Winsock RIO | CQ completion 대기 또는 polling 상태 | `RIORESULT`의 bytes·status·context | dequeue까지 등록 버퍼와 요청 참조 유효 |

이 표의 “실제 데이터 결과”는 메시지 완성이나 업무 성공을 뜻하지 않습니다. 세 모델 모두 TCP 바이트를 프레임으로 해석하고, 상대 애플리케이션의 처리 여부를 필요하면 별도 프로토콜 응답으로 확인해야 합니다.

## 공통 상태와 플랫폼 경계

세 모델의 공통 상태를 `OPEN`, `SUBMITTED`, `NOTIFIED`, `CONSUMED`, `RELEASED`로 둘 수 있습니다. 다만 각 이름의 플랫폼 사건은 다릅니다. kqueue의 `NOTIFIED`는 read-ready event 회수이고 실제 read completion이 아닙니다. IOCP의 `NOTIFIED`는 submitted operation의 결과를 받은 상태에 가깝습니다. RIO의 notification은 다시 CQ dequeue를 해야 하는 중간 신호입니다.

어댑터가 이 차이를 숨기려면 공통 callback 이름 하나보다 입력 계약을 명시해야 합니다. 예를 들어 `ReadReady`, `ReadComplete`, `EndOfStream`, `SocketError`를 구분하고, 완료 모델에서는 buffer 반환 시점을 포함한 operation context를 전달합니다. 준비 모델에서 read-ready callback이 호출되었다고 buffer에 메시지가 이미 있다고 말하지 않습니다.

```diagram
{"title":"공통 상태와 플랫폼별 사건","caption":"상위 파서는 통지의 이름이 아니라 실제 바이트·종료·오류를 받습니다. 플랫폼 어댑터는 준비와 완료를 같은 성공 사건으로 합치지 않습니다.","rows":[[{"id":"event","label":"플랫폼 통지","detail":["kqueue ready","IOCP/RIO completion signal"]}],[{"id":"adapter","label":"플랫폼 어댑터","detail":["상태·오류·context 해석"]}],[{"id":"io","label":"실제 I/O 결과","detail":["bytes·would-block·EOF·error"]}],[{"id":"parser","label":"공통 연결 상태 머신","detail":["frame buffer·send queue·generation"]}],[{"id":"release","label":"참조·버퍼 반환"}]],"edges":[{"from":"event","to":"adapter","label":"회수"},{"from":"adapter","to":"io","label":"준비 후 호출 또는 결과 dequeue"},{"from":"io","to":"parser","label":"공통 입력"},{"from":"parser","to":"release","label":"소비 종료"}]}
```

공통 상태 머신에는 세대 번호를 둘 수 있습니다. 닫힌 연결의 늦은 event나 completion이 같은 숫자의 새 디스크립터에 적용되는 것을 논리적으로 막는 장치입니다. 그러나 세대 번호는 이미 해제한 객체를 worker가 안전하게 읽게 해 주지 않습니다. memory reclamation, 즉 마지막 참조가 끝난 뒤 메모리를 회수하는 규칙을 별도로 구현해야 합니다.

이식 경계에서 `NOTIFIED`를 `COMPLETED`와 같은 상태로 저장하지 않는 것이 중요합니다. 준비 모델은 통지 뒤 실제 호출이 다시 실패할 수 있고, RIO notification은 결과 배열을 아직 건네지 않습니다. 공통 입력에는 바이트 범위와 buffer ownership을 반드시 포함해야 합니다.

## kqueue 선택 조건

kqueue는 BSD·macOS에서 파일 디스크립터와 소켓의 준비 상태를 하나의 event loop로 다룰 때 자연스럽습니다. 현재 보내야 할 데이터가 있는 연결에만 WRITE 필터를 켜고, READ 이벤트 뒤 논블로킹 read를 진행하는 구조는 준비 통지의 의미를 직접 반영합니다. `EV_CLEAR`를 선택하면 회수 후 상태가 reset되므로 한 번 읽고 끝내지 말고 EAGAIN 또는 애플리케이션 예산까지 진행해야 합니다.

EOF 처리에서는 `EVFILT_READ`의 `EV_EOF`와 `fflags` socket error를 실제 수신 결과와 함께 해석합니다. EOF가 보이면서도 수신 버퍼에 마지막 payload가 남을 수 있으므로, bytes를 먼저 파서에 넣고 실제 `recv`가 0을 반환한 뒤 입력 종료를 확정합니다. 확보한 자료만으로 HUP를 EOF와 동일시하지 않습니다.

kqueue 이벤트는 descriptor registration을 제거해도 이미 실행 중인 callback이나 local ready queue의 `udata` 수명을 자동으로 해결하지 않습니다. close로 kevent가 제거되는 계약과 애플리케이션 object 참조 종료를 분리합니다. 현대 macOS의 모든 플래그 조합과 duplicated-FD 동시 close는 이 글의 공식 자료 범위를 넘어갑니다.

kqueue를 선택하는 것은 연결 수가 많으면 비용이 없다는 뜻도 아닙니다. 계속 readable인 연결이 하나 있으면 read 예산이 없는 loop가 다른 연결을 굶길 수 있습니다. 이벤트 배치 크기, 바이트 예산, local ready 큐, backpressure를 운영 설계에 포함합니다.

## 기존 IOCP 선택 조건

기존 overlapped IOCP는 Windows의 일반적인 비동기 소켓 흐름과 이미 연결된 생태계를 활용해야 할 때 이해하기 쉬운 출발점입니다. `OVERLAPPED` 작업 객체가 버퍼·작업 종류·연결 참조를 묶고, 완료 worker가 packet별 bytes와 오류를 처리합니다. `AcceptEx`와 `WSARecv`·`WSASend`를 같은 포트 worker 구조에 결합할 수도 있지만 작업 종류별 바이트 의미를 구분해야 합니다.

`WSARecv`에서 0은 기본 통지 모드에서 즉시 완료되거나 `WSA_IO_PENDING` 뒤 완료되는 경로와 분리해서 처리합니다. 다른 즉시 오류는 completion이 없을 수 있으므로 제출 실패 경로가 예약한 pending과 참조를 되돌립니다. `CancelIoEx`의 성공이나 `ERROR_NOT_FOUND`는 작업 메모리를 즉시 해제해도 된다는 증거가 아니며 실제 completion 종결을 기다려야 합니다.

IOCP concurrency 값은 worker를 만들어 주는 수나 요청 수의 상한이 아닙니다. 앱이 worker를 만들고 포트에서 기다리게 하며, 완료를 수집한 뒤 오래 걸리는 DB·압축 작업은 제한된 별도 실행기로 보낼 수 있습니다. 한 연결의 순서를 유지하려면 연결별 직렬 실행 경계나 송신 단일 owner를 둡니다.

기존 IOCP의 단점은 해결해야 할 수명과 종료 계약이 적다는 뜻이 아닙니다. payload와 `OVERLAPPED`는 완료 전 유효해야 하고, 완료를 dequeue한 뒤에도 parser가 buffer view를 잡고 있으면 사용자 참조를 유지해야 합니다. 종료는 새 제출 차단, outstanding 작업 회수, worker 종료, port close의 순서를 지킵니다.

## Winsock RIO 선택 조건

RIO는 등록 buffer와 CQ/RQ를 미리 설계할 수 있고 Windows 환경에서 해당 provider가 확장을 제공할 때 검토할 수 있습니다. 그러나 `RIO_EXTENSION_FUNCTION_TABLE`은 `WSAIoctl`로 런타임 획득해야 합니다. SDK 헤더나 최소 지원 OS 표기만으로 현재 provider의 가용성을 확정하지 않습니다.

RIO의 선택은 memory footprint와 queue capacity를 설계할 능력을 요구합니다. `RIORegisterBuffer`가 virtual memory pages를 물리 메모리에 lock할 수 있고, `RIOCreateCompletionQueue`의 entry 수가 유한하며, RQ의 outstanding 합이 CQ capacity를 넘지 않도록 해야 합니다. 공유 CQ라면 모든 socket의 최대 완료 수를 함께 예산화합니다.

알림 경로도 기존 IOCP와 다릅니다. `RIONotify`가 IOCP에 completion을 넣으면 `GetQueuedCompletionStatus` worker는 해당 CQ를 `RIODequeueCompletion`으로 비워야 합니다. IOCP packet의 bytes=0을 RIO 수신 EOF로 해석하지 않고 dedicated `OVERLAPPED`와 key로 RIO signal임을 구분합니다.

RIO는 같은 RQ·CQ를 여러 thread가 동시에 접근할 때 자동 synchronization을 제공하지 않습니다. CQ별 dequeue owner를 하나 정하거나 lock을 사용합니다. `RIOReceive`·`RIOSend`의 `TRUE`는 이미 또는 나중에 completion이 큐에 들어가는 성공적인 시작이고, `FALSE`는 completion 없는 제출 실패입니다. 이 분기를 기존 overlapped 반환값 표와 섞지 않습니다.

## 워크로드와 비용 모델

선택은 연결 수 하나로 결정하지 않습니다. 다음 네 가지 workload를 분리하면 모델의 비용이 보입니다.

| workload | 주요 압력 | 관찰할 결과 |
| --- | --- | --- |
| 많은 유휴 연결 | 깨움과 descriptor 상태 관찰 | idle CPU, wakeup, 메모리 |
| 작은 메시지 다수 | 호출·통지·배치 횟수 | syscalls, dequeue batch, p99 |
| 일부 연결의 지속 생산 | 공정성과 parser 시간 | 연결별 지연, starvation, queue age |
| 느린 송신자·수신자 | 사용자 큐와 buffer 점유 | bytes, in-flight, drops, close |

예를 들어 연결 10,000개 중 9,900개가 유휴이고 100개가 초당 1,000개의 작은 프레임을 만든다고 하겠습니다. kqueue에서는 readiness event 뒤 실제 `recv` 횟수와 EAGAIN 횟수를 구분하고, IOCP에서는 submitted operation 수와 completion packet 수를 기록합니다. RIO에서는 `RIONotify` wakeup과 `RIODequeueCompletion` 결과 수를 별도로 셉니다. wakeup이 적어도 CQ에 결과가 오래 쌓이면 지연이 좋아졌다고 결론 낼 수 없습니다.

메모리도 같은 단위로 비교하지 않습니다. kqueue의 사용자 버퍼, IOCP의 outstanding `OVERLAPPED`와 payload, RIO의 registered·locked memory와 CQ/RQ entry를 분리합니다. 특정 API의 함수 호출 수가 줄어도 locked memory가 제품 예산을 넘으면 선택이 부적절할 수 있습니다.

선택은 먼저 실패 비용으로 거를 수 있습니다. provider가 RIO table을 반환하지 않으면 RIO를 단독 경로로 채택할 수 없고, CQ 상한을 예산화할 수 없으면 registered I/O의 운영 모델이 아직 준비되지 않은 것입니다. 반대로 Windows의 기존 IOCP 운영 도구와 인력이 충분하면 먼저 overlapped 경로를 안정화한 뒤 RIO를 별도 실험하는 편이 이식 위험을 줄일 수 있습니다. 이는 성능 우위 주장이 아니라 확인 가능한 자원 계약에 따른 설계 순서입니다.

## 프레이밍과 송신 계약

TCP는 메시지 경계를 보존하지 않으므로 세 모델 모두 수신 바이트를 길이 헤더·본문 파서에 누적해야 합니다. 이벤트나 completion 한 건이 프레임 하나라는 가정은 kqueue의 집계와 IOCP·RIO의 부분 완료 양쪽에서 깨집니다. 파서는 `bytes` 범위만 소비하고 남은 부분을 연결 상태에 보관합니다.

송신도 모델 선택과 별개로 연결별 순서 owner가 필요합니다. 여러 producer가 만든 완성 프레임을 연결 송신 큐에 넣고, 한 owner가 앞 프레임의 잔량을 처리한 뒤 다음 프레임을 제출합니다. kqueue는 일부 write 뒤 WRITE 감시를 유지하고, IOCP·RIO는 buffer가 completion dequeue되기 전 재사용하지 않습니다.

transport 완료는 상대 애플리케이션의 업무 성공과 다릅니다. IOCP와 RIO send completion은 provider·transport가 버퍼를 소비한 경계이고, kqueue write 가능은 전송 완료조차 아닙니다. 중요한 요청에는 요청 ID와 애플리케이션 ACK 또는 결과 조회를 두며, 연결 종료 뒤 상대 적용 여부를 모르는 재전송은 중복 효과 정책과 함께 다룹니다.

## 단계적 이식 순서

기존 epoll 또는 kqueue 기반 서버를 Windows로 옮길 때 첫 단계는 API 이름 변환이 아니라 공통 연결 상태를 고정하는 일입니다. `read-ready`, `read-complete`, `would-block`, `EOF`, `socket-error`, `send-progress`, `operation-cancelled`를 플랫폼 독립 입력으로 정의합니다. 각 입력에 bytes 범위와 buffer ownership을 포함합니다.

두 번째 단계는 기존 모델에서 관측 로그를 추가하는 것입니다. connection generation, event 또는 operation ID, 제출 시각, 통지 시각, 실제 I/O 결과, parser 소비량, buffer acquire/release, next-submit 여부를 남깁니다. 정상 경로의 숫자 trace가 없으면 이식 후 누락된 completion과 중복 read를 구분하기 어렵습니다.

세 번째 단계에서 작은 연결 하나를 옮깁니다. 클라이언트가 길이 헤더 일부만 보내고 잠시 멈춘 뒤 나머지 본문과 FIN을 보냅니다. 예를 들어 2바이트 헤더와 2바이트 본문을 1바이트, 1바이트, 2바이트로 보낸다면 공통 파서는 세 번의 입력에서 각각 partial, partial, complete 상태를 거쳐야 합니다. FIN이 마지막 payload와 함께 관찰되어도 payload 소비 뒤 실제 EOF를 확정해야 합니다. 이 실험을 이 작업에서 실행한 것은 아니며 대상 OS에서 동일 trace를 확보해야 합니다.

네 번째 단계는 backpressure와 종료입니다. 수신 parser가 느릴 때 다음 read 제출을 줄이고, 송신 큐 바이트가 상한에 도달할 때 유입을 제한합니다. 종료에서는 새 제출을 막은 뒤 outstanding 작업, CQ나 IOCP packet, local ready queue, parser view의 참조를 모두 종결하고 자원을 반환합니다.

```text
의사 코드: 어댑터의 공통 계약을 보여 주며 실제 플랫폼 API 구현은 포함하지 않습니다.
run_connection_event(connection, input):
    if input.kind == READ_READY:
        result = adapter.try_read(connection)
    else if input.kind == READ_COMPLETE:
        result = input.completion_result
    else:
        result = input.control_result

    if result.bytes > 0:
        connection.parser.feed(result.buffer, result.bytes)
    if result.would_block:
        connection.read_state = WAITING
    if result.eof:
        connection.input_state = FIN_PENDING_AFTER_DRAIN
    if result.error:
        connection.input_state = FAILED
    return decide_next_submission_and_release(connection, result)
```

이 의사 코드는 `READ_READY`에서 어댑터가 실제 `recv`를 호출한다는 점과 `READ_COMPLETE`에서 이미 회수한 결과를 전달한다는 점만 보여 줍니다. EOF와 오류가 동시에 표시될 때의 우선순위, parser view의 참조, 연결 종료와 다음 제출의 직렬화는 실제 구현 계약으로 명시해야 합니다.

## 운영 진단과 실패 분류

“데이터가 가끔 중복된다”는 증상은 모델별로 다른 원인일 수 있습니다. kqueue에서는 한 이벤트를 여러 번 읽거나 local ready 큐와 kernel event를 중복 소비했는지 봅니다. IOCP에서는 동일 `OVERLAPPED`를 두 번 종결했거나 immediate success를 직접 처리하면서 completion도 처리했는지 봅니다. RIO에서는 notification을 결과로 오인하거나 같은 CQ를 조정 없이 여러 worker가 dequeue했는지 봅니다.

“연결이 가끔 일찍 닫힌다”면 kqueue `EV_EOF` 뒤 buffered bytes를 소진했는지, IOCP·RIO의 0 bytes가 해당 작업 종류에서 EOF인지, 오류 status와 혼동했는지 확인합니다. `AcceptEx`의 0 bytes는 initial receive length를 0으로 둔 접속 완료일 수 있으므로 일반 TCP receive EOF와 같지 않습니다.

“메모리 오류가 종료 때만 난다”면 취소 반환·CQ close·port close를 실제 작업 종결로 잘못 사용했는지 봅니다. RIO는 dequeue 전 registered buffer deregister가 정의되지 않은 동작이고, CQ close 뒤 새 completion이 조용히 버려질 수 있습니다. 기존 IOCP도 `CancelIoEx` 반환만으로 `OVERLAPPED`와 payload를 free할 수 없습니다.

장애 대응에는 다음 사건을 하나의 trace ID로 묶는 방법이 유용합니다. 제출 또는 등록, 통지, 실제 결과, parser 전달, 사용자 참조 반환, generation 변경, logical close, final free입니다. 어느 단계가 사라졌는지 보면 API 선택 자체와 구현 수명 버그를 분리할 수 있습니다.

## 성능 검증 범위

이 글에서 BSD·macOS·Windows 실행이나 benchmark를 수행하지 않았습니다. 공식 문서는 kqueue의 필터와 EOF, IOCP의 완료 큐와 worker scheduling, RIO의 registered buffer와 CQ/RQ 계약을 설명하지만 동일 workload의 보편적인 순위를 제공하지 않습니다.

실험할 때는 OS build와 provider, CPU 수와 affinity, compiler 설정, 연결 수, 메시지 크기와 분포, idle 비율, CQ/RQ 크기, IOCP worker 수, kqueue batch 크기, backpressure policy를 고정합니다. 모델별로 동등한 프레이밍·응답·종료 동작을 사용하지 않으면 API 비용과 업무 로직 비용이 섞입니다.

측정값은 p50·p95·p99 latency, CPU 시간, context switch, wakeup, syscall 또는 dequeue 수, in-flight bytes, queue age, dropped/rejected connection, 오류 종류, registered 또는 outstanding memory로 나눕니다. 결과는 “이 provider·이 build·이 workload에서”라는 범위와 함께 보관하며, 다른 Windows provider나 최신 macOS 전체로 일반화하지 않습니다.

## 참고 자료와 검증 범위

- [FreeBSD `kqueue(2)`](https://man.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2&manpath=FreeBSD+14.3-RELEASE): FreeBSD 14.3-RELEASE manual. 필터 평가·집계, `EV_CLEAR`, read/write, EOF·오류와 close 제거를 확인했습니다.
- [Apple `kqueue(2)` 보관 문서](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kqueue.2.html): 보관된 Mac OS X/iOS manual page, 문서상 특정 최신 릴리스 없음, 2000-04-14 표기. kqueue 핵심 의미 확인에 사용했으며 현대 macOS 릴리스 전체의 계약으로 확대하지 않았습니다.
- [I/O Completion Ports](https://learn.microsoft.com/en-us/windows/win32/fileio/i-o-completion-ports): Microsoft Learn, page date 2025-07-18, updated_at 2026-07-17로 확인된 공식 개념 문서. completion packet, FIFO queue와 LIFO wakeup, runnable-thread concurrency를 확인했습니다.
- [WSARecv](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsarecv): Microsoft Learn, page updated 2024-02-22. overlapped 반환값, `OVERLAPPED` 수명과 completion bytes를 확인했습니다.
- [WSASend](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsasend): Microsoft Learn, page updated 2024-02-22. payload 수명과 동시 송신 경계를 확인했습니다.
- [RIO extension function table](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/ns-mswsock-rio_extension_function_table): Microsoft Learn, page updated 2024-02-22. 런타임 function-table 탐색과 최소 지원 표기를 확인했습니다.
- [RIOCreateCompletionQueue](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_riocreatecompletionqueue), [RIOCreateRequestQueue](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_riocreaterequestqueue): Microsoft Learn, 각 page updated 2024-02-22. CQ/RQ capacity와 동기화·socket 자원 계약을 확인했습니다.
- [RIONotify](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rionotify), [RIODequeueCompletion](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_riodequeuecompletion): Microsoft Learn, 각 page updated 2024-02-22. RIO notification과 CQ 결과 회수의 분리를 확인했습니다.
- [RIORegisterBuffer](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rioregisterbuffer), [RIODeregisterBuffer](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rioderegisterbuffer): Microsoft Learn, page updated 2024-02-22 및 2025-08-27. 등록·deregister와 in-flight 수명을 확인했습니다.
- [RIOReceive](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rioreceive), [RIOSend](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_riosend): Microsoft Learn, 각 page updated 2024-02-22. `TRUE`·`FALSE`, buffer 수명과 CQ·RQ 용량 계약을 확인했습니다.
- [RIOCloseCompletionQueue](https://learn.microsoft.com/en-us/windows/win32/api/mswsock/nc-mswsock-lpfn_rioclosecompletionqueue): Microsoft Learn, page updated 2025-08-27. CQ close가 pending 작업의 drain 증거가 아님을 확인했습니다.
- [준비 통지와 완료 통지의 버퍼 소유권](/tech-interview/notes/io-readiness/), [IOCP 수신·완료 처리](/tech-interview/notes/iocp-completion/), [IOCP 종료 처리](/tech-interview/notes/iocp-shutdown/): 기존 저장소 노트. 실행 결과가 아닌 공통 상태·수명·종료 설계의 연결 자료입니다.

참고 자료는 2026-09-17에 확인했습니다. 실제 BSD·macOS kqueue, Windows IOCP, Windows RIO 프로그램과 benchmark를 실행하지 않았습니다. 따라서 provider 가용성, 현대 macOS의 세부 플래그 동작, 취소·drain의 provider별 순서와 성능 우열은 미확정으로 남겼습니다.

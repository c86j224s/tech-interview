---
id: io-readiness
title: 준비 통지와 완료 통지의 버퍼 소유권
topic: 네트워크
summary: epoll·IOCP·io_uring의 통지 의미를 나누고 edge-triggered 진행·oneshot 재무장·부분 I/O·공통 어댑터의 계약을 설명합니다.
questionIds: [io-readiness-vs-completion, windows-epoll-porting, epoll-oneshot-rearm-owner, portable-io-buffer-ownership, io-uring-buffer-backpressure]
---

# 준비 통지와 완료 통지의 버퍼 소유권

## 알림 뒤 읽는지, 맡긴 읽기의 결과를 받는지 다릅니다

epoll의 읽기 준비 알림은 지금 논블로킹 recv를 시도할 수 있다는 신호입니다. 이미 사용자 버퍼에 원하는 메시지가 들어왔다는 뜻은 아닙니다. IOCP의 완료는 앞서 버퍼와 작업을 제출한 I/O의 결과입니다. 완료된 바이트·오류와 제출한 작업의 수명을 처리해야 합니다.

준비 기반 구조를 Reactor, 완료 기반 구조를 Proactor라고 설명할 수 있지만 모든 API가 순수한 한 모델만 제공한다는 뜻은 아닙니다. 중요한 것은 **실제 I/O를 수행하는 단계와 버퍼를 누가 언제 사용할 수 있는지**입니다.

| 모델 | 순서 | 알림 후 책임 |
| --- | --- | --- |
| 준비 | 감시 → 준비 → recv/send 시도 | 반환값으로 진행·EOF·재대기 판단 |
| 완료 | 버퍼·작업 제출 → I/O 진행 → 결과 | 해당 작업 결과와 참조 종결 |

## Edge-triggered에서 일부만 읽고 잠들면 멈출 수 있습니다

레벨 트리거는 준비 조건이 남으면 다시 알릴 수 있습니다. 에지 트리거에서는 보통 EAGAIN까지 읽어 현재 준비를 소진해야 합니다. 처리 예산 때문에 그 전에 멈춘다면 자체 실행 큐에 다시 넣어야 남은 데이터를 놓치지 않습니다.

```text
processReadable(connection):
    while byteBudget remains:
        result = nonblockingRecv(connection)
        if result has bytes:
            parser.feed(result.bytes)
        else if result == WOULD_BLOCK:
            return wait_for_next_readiness
        else if result == EOF:
            return handle_end_of_stream
        else:
            return handle_socket_error
    enqueue_local_ready_again(connection)
```

준비 통지는 특정 worker에게 데이터 소유권을 예약하지 않습니다. 다른 읽기나 종료가 끼어들 수 있으므로 실제 반환값이 기준입니다. 송신도 일부만 보냈으면 남은 offset을 유지합니다. 보낼 데이터가 없는데 writable 감시를 계속 켜면 불필요한 반복이 생길 수 있습니다.

```diagram
{"title":"예산 종료와 EAGAIN은 다른 재개 경로입니다","caption":"화살표는 논블로킹 읽기 이후의 실행 선택입니다. 읽을 데이터가 남을 수 있는 예산 종료는 자체 재스케줄링으로 이어져야 합니다.","rows":[[{"id":"read","label":"준비 알림 후 recv"}],[{"id":"budget","label":"처리 예산 소진","detail":["EAGAIN 미도달"]},{"id":"empty","label":"EAGAIN","detail":["현재 읽을 데이터 없음"]}],[{"id":"local","label":"자체 ready 큐"},{"id":"kernel","label":"다음 준비 알림 대기"}]],"edges":[{"from":"read","to":"budget","label":"공정성 양보"},{"from":"read","to":"empty","label":"읽기 소진"},{"from":"budget","to":"local","label":"다시 실행"},{"from":"empty","to":"kernel","label":"새 준비 필요"}]}
```

## Oneshot은 연결 상태의 잠금을 대신하지 않습니다

EPOLLONESHOT은 알림 뒤 해당 등록을 재무장할 때까지 비활성화하는 기능입니다. worker가 연결을 처리하고 남은 송신·읽기 상태를 갱신한 뒤 rearm과 소유권 반환을 일관된 규칙으로 수행해야 합니다. rearm 직후 다른 worker가 실행될 수 있으므로 옛 worker가 이후 무보호로 상태를 계속 바꾸면 안 됩니다.

한 가지 구조는 연결 잠금 아래에서 최종 상태·관심 이벤트를 정하고 rearm한 뒤 더 이상 그 상태를 수정하지 않고 잠금을 놓는 것입니다. 새 worker도 같은 잠금을 얻어 처리합니다. rearm 전에 데이터가 새로 도착하거나 종료가 시작되는 경우, rearm API 실패와 FD 재사용도 처리해야 합니다. 남은 local-ready 작업과 커널 재무장을 중복 실행자로 만들지 않습니다.

## 완료 모델은 제출 시점부터 참조가 필요합니다

완료 기반 I/O에서는 OS에 맡긴 버퍼·작업 ID·컨텍스트가 실제 종결까지 유효해야 합니다. 취소 요청이나 소켓 close는 완료 처리까지 모두 끝났다는 뜻이 아닙니다. 완료가 제출 호출 반환보다 먼저 다른 스레드에서 처리될 수도 있어 참조를 나중에 확보하면 안 됩니다.

준비 모델도 recv 후 파서에 버퍼 view를 넘겼다면 그 소비가 끝날 때까지 메모리를 유지해야 합니다. 커널이 더 안 쓴다는 사실과 사용자 파서가 더 안 쓴다는 사실은 다릅니다. 공통 어댑터는 EOF·부분 진행·재대기·실패를 명시하고 read-ready와 read-complete를 같은 모호한 성공 콜백으로 숨기지 않습니다.

## io_uring에서도 작업별 종결 규칙을 확인합니다

SQ 제출·CQ 완료를 사용해도 링 크기와 실제 in-flight·버퍼 개수의 상한은 필요합니다. 제출 실패·완료 수집 지연·overflow 기능은 커널과 opcode·설정에 따라 확인해야 합니다. user_data로 작업을 식별하더라도 메모리 소유권이 자동 생기지는 않습니다.

일반 버퍼·registered buffer·provided buffer의 대여·반환 시점은 다를 수 있습니다. multishot·zero-copy처럼 한 CQE가 항상 최종 자원 사용 종료를 뜻하지 않는 연산도 있어 opcode별 완료 플래그·추가 notification을 따라야 합니다. cancel 요청의 완료와 원래 작업의 완료를 각각 식별하고 한 번만 정리합니다.

## 이식은 상태 머신과 같은 입력으로 검증합니다

부분 읽기·부분 쓰기·복수 프레임·EOF·EAGAIN·취소·늦은 이벤트·FD 또는 주소 재사용을 같은 상위 계약 테스트로 비교합니다. 준비 통지 제거가 이미 실행 중인 콜백까지 멈추는 것은 아니며 세대 번호도 해제된 메모리를 되살리지 않습니다.

실제 Windows·Linux 실행은 해당 OS에서 검증해야 합니다. 이 노트는 공통 설계 경계이며 모든 커널·provider·opcode를 실행해 확인한 결과가 아닙니다. API 이름 치환보다 진행성·공정성·수명 불변식을 맞추는 것이 이식의 핵심입니다.

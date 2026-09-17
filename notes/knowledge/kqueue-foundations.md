---
id: kqueue-foundations
title: BSD·macOS kqueue 이벤트 모델
topic: 네트워크
summary: kqueue의 필터 평가와 이벤트 집계를 출발점으로 EVFILT_READ·WRITE, EV_CLEAR, EOF·오류, close와 디스크립터 수명을 하나의 이벤트 루프로 연결합니다.
questionIds: []
prerequisites: [computer-science-foundations, iocp-foundations]
related: [iocp-foundations, iocp-completion, tcp]
reviewedAt: '2026-09-17'
---

# BSD·macOS kqueue 이벤트 모델

## 이벤트 대기와 준비 통지

kqueue는 BSD 계열 운영체제에서 파일 디스크립터와 소켓의 상태 변화를 한 큐에서 관찰하는 인터페이스입니다. 파일 디스크립터는 프로세스 안에서 소켓 같은 커널 객체를 가리키는 정수 식별자입니다. `kqueue()`는 커널 이벤트 큐를 만들고, 그 큐를 가리키는 디스크립터를 반환합니다.

kqueue의 통지는 읽기 작업 자체의 완료 결과가 아닙니다. 등록한 필터가 관찰한 조건을 보고하므로, `EVFILT_READ`를 회수한 뒤 애플리케이션은 논블로킹 `recv`를 호출해 실제 바이트 수와 오류를 확인해야 합니다. 준비 통지와 완료 통지의 차이는 [준비 통지와 완료 통지의 버퍼 소유권](/tech-interview/notes/io-readiness/)에서 설명한 공통 경계와 같습니다.

필터 조건은 등록 시점, 관련 상태가 활동한 시점, `kevent`로 결과를 회수하는 시점에 평가될 수 있습니다. 회수 시점에 조건이 더 이상 성립하지 않으면 기다리던 알림이 반환되지 않을 수 있습니다. 그러므로 `kevent` 한 건을 “반드시 한 번 실행할 읽기 작업”으로 세지 않고, 현재 상태를 다시 확인할 기회로 다루어야 합니다.

같은 조건을 일으킨 여러 변화도 하나의 `kevent`로 합쳐질 수 있습니다. 한 번의 대기 사이에 100바이트가 세 번 도착해도 이벤트 세 개를 받는다고 가정할 수 없습니다. 이벤트를 받은 뒤 수신 버퍼를 가능한 범위까지 소비하고, 실제 시스템 호출 결과로 다음 대기 상태를 정합니다.

## 변경 목록과 회수 순서

`kevent` 한 호출은 변경 목록을 커널에 적용하면서 대기 중인 이벤트를 회수할 수 있습니다. 문서 계약상 그 호출의 변경 목록은 pending event를 읽기 전에 적용됩니다. 이번 호출에서 감시를 끄면서 이미 큐에 있던 이벤트를 어떻게 다룰지 같은 경계를 설계할 때 이 순서가 중요합니다.

다음 코드는 등록과 회수의 순서를 보여 주는 C 의사 코드입니다. 완성된 서버 코드가 아니며, `EV_SET`의 인자와 주소 길이, 연결 참조의 수명, 모든 실패 경로는 대상 시스템 헤더와 애플리케이션 정책에 맞춰 완성해야 합니다. 특히 하나의 `EV_SET`에는 하나의 필터만 넣어야 하므로 읽기와 쓰기를 별도의 변경 항목으로 둡니다.

```c
/* 의사 코드: 오류 처리와 연결 참조 관리가 포함된 실제 코드가 필요합니다. */
int queue = kqueue();
if (queue == -1) {
    report_errno("kqueue");
    return FAILURE;
}

struct kevent changes[3];
EV_SET(&changes[0], listen_fd, EVFILT_READ, EV_ADD, 0, 0, listener_tag);
EV_SET(&changes[1], client_fd, EVFILT_READ, EV_ADD | EV_CLEAR, 0, 0,
       connection_tag);
EV_SET(&changes[2], client_fd, EVFILT_WRITE, EV_ADD | EV_CLEAR, 0, 0,
       connection_tag);

int changed = kevent(queue, changes, 3, NULL, 0, NULL);
if (changed == -1) {
    report_errno("kevent registration");
    close(queue);
    return FAILURE;
}
```

여기서 `ident`는 감시 대상 식별자이고 `filter`는 읽기나 쓰기 같은 관찰 종류입니다. `udata`는 이벤트를 회수할 때 함께 돌아오는 애플리케이션 값이므로 연결 객체나 별도 태그를 연결할 수 있습니다. 그러나 `udata`에 포인터를 넣었다고 kqueue가 객체의 수명을 연장해 주지는 않습니다.

실제로 보낼 데이터가 없는데 `EVFILT_WRITE`를 계속 등록하면 writable 상태가 반복해서 보고될 수 있습니다. 송신 큐가 비었을 때 쓰기 감시를 끄고, 새 프레임을 큐에 넣는 순간 다시 등록하는 식으로 커널의 관심 상태와 연결 객체의 송신 상태를 함께 갱신합니다. 읽기와 쓰기를 한 연결에 동시에 등록할 수 있지만, 두 이벤트의 처리는 각각 실제 `recv`와 `send` 결과를 기준으로 해야 합니다.

## 읽기 필터와 쓰기 필터

소켓의 `EVFILT_READ`는 읽을 수 있는 프로토콜 데이터가 있을 때 보고됩니다. `data`는 읽을 수 있는 바이트 수를 나타내며 소켓의 `SO_RCVLOWAT` 설정 영향을 받습니다. `listen` 소켓에서는 읽을 데이터 대신 대기 중인 연결이 있음을 보고하고, `data`는 listen backlog의 크기를 나타냅니다.

`EVFILT_WRITE`는 디스크립터에 쓸 수 있을 때 보고됩니다. 소켓에서는 `data`가 쓸 수 있는 버퍼 여유를 나타낼 수 있으며, 읽는 쪽이 연결을 끊으면 `EV_EOF`가 설정될 수 있습니다. 이 값은 애플리케이션 메시지의 길이나 전송 완료 바이트가 아닙니다. 실제 송신 가능 범위는 논블로킹 `send`의 반환값으로 결정합니다.

```diagram
{"title":"kqueue 이벤트와 실제 I/O의 분리","caption":"kqueue는 준비 상태를 전달하고, 연결 소유자는 논블로킹 I/O의 실제 결과를 판정합니다. 하나의 kevent가 하나의 메시지나 한 번의 recv를 의미하지 않습니다.","rows":[[{"id":"kernel","label":"커널 소켓 상태","detail":["읽기 바이트·대기 연결","쓰기 여유·EOF·오류"]}],[{"id":"kq","label":"kqueue·kevent","detail":["필터 평가·조건 집계"]}],[{"id":"owner","label":"연결 소유자","detail":["udata·세대·관심 상태"]}],[{"id":"io","label":"논블로킹 recv·send","detail":["실제 바이트·EAGAIN·오류"]}],[{"id":"parser","label":"파서·송신 큐"}]],"edges":[{"from":"kernel","to":"kq","label":"준비 조건"},{"from":"kq","to":"owner","label":"kevent 회수"},{"from":"owner","to":"io","label":"작업 시도"},{"from":"io","to":"parser","label":"유효 범위 전달"}]}
```

`EVFILT_READ`에서 `data`가 4096이라고 해도 한 번의 `recv`가 반드시 4096바이트를 반환하는 것은 아닙니다. 반대로 20바이트만 반환해도 그것이 메시지 끝이라는 뜻은 아닙니다. TCP는 바이트 스트림이므로 프레임 길이 해석과 부분 메시지 보관은 별도 파서의 책임입니다. [TCP 스트림의 프레이밍](/tech-interview/notes/tcp/)에서 이 경계를 더 자세히 다룹니다.

listen 소켓의 읽기 이벤트도 연결 하나의 완성을 뜻하지 않습니다. `data`가 대기 중 연결 수를 나타낼 수 있으므로 애플리케이션은 `accept`의 실제 반환값과 오류를 처리해야 합니다. 이벤트의 `data`를 후속 API 호출의 고정 횟수로 복사하지 않는 편이 안전합니다.

## EV_CLEAR와 상태 재확인

`EV_CLEAR`는 이벤트를 회수한 뒤 해당 이벤트 상태를 재설정합니다. 이는 조건이 현재 남아 있는 동안 계속 상태를 보고하는 모드와 다릅니다. 이벤트를 받은 뒤 `recv`를 한 번만 호출하고 돌아오면 아직 데이터가 남아 있어도 다음 알림이 자동으로 예약된다고 가정할 수 없습니다.

일반적인 처리 순서는 논블로킹 소켓을 `EAGAIN` 또는 `EWOULDBLOCK`까지 읽는 것입니다. 다만 한 연결이 계속 데이터를 생산하면 다른 연결이 굶을 수 있으므로 바이트 수나 처리 시간 예산을 둘 수 있습니다. 예산 때문에 먼저 멈췄다면 남은 작업을 애플리케이션의 ready 큐에 다시 넣어야 합니다.

```text
의사 코드: 반환값 이름은 플랫폼 래퍼의 공통 상태로 치환한 것입니다.
process_read_event(connection):
    while byte_budget_and_time_budget_remain:
        result = nonblocking_recv(connection)
        if result.bytes > 0:
            parser_feed(result.bytes_only)
            continue
        if result == WOULD_BLOCK:
            return WAIT_FOR_NEXT_EVENT
        if result == EOF:
            return EOF_PENDING_AFTER_BUFFER_CHECK
        return SOCKET_ERROR

    enqueue_local_ready(connection)
    return YIELD_FOR_FAIRNESS
```

이 의사 코드의 `EOF_PENDING_AFTER_BUFFER_CHECK`는 이벤트 플래그만 보고 곧바로 메모리를 해제하지 않기 위한 애플리케이션 상태입니다. 실제 `recv`가 0을 반환한 뒤에도 파서에 미완성 프레임이 있으면 프로토콜 정책에 따라 폐기나 오류 응답을 결정할 수 있습니다.

`EV_ONESHOT`이나 `EV_DISABLE`을 함께 사용할 때의 재활성화와 삭제 의미는 대상 운영체제와 릴리스의 man page에서 별도로 확인해야 합니다. 이번 검증 자료는 `EV_CLEAR`의 회수 후 재설정, 읽기·쓰기 필터, EOF·오류, close 제거를 확정하지만 현대 macOS의 모든 플래그 조합을 검증하지는 않습니다.

## EOF와 소켓 오류

소켓의 읽기 방향이 종료되면 `EVFILT_READ` 이벤트에 `EV_EOF`가 설정될 수 있습니다. 동시에 소켓 오류가 있으면 오류 값이 `fflags`로 전달됩니다. 중요한 경계는 EOF가 보였다고 수신 버퍼가 반드시 빈 것은 아니라는 점입니다. 마지막 payload가 커널 수신 버퍼에 남은 채 EOF가 관찰될 수 있습니다.

예를 들어 클라이언트가 길이 헤더 2바이트와 본문 `OK`를 보내 총 4바이트를 만든 뒤 FIN을 보냈다고 하겠습니다. 서버가 `EV_EOF`와 `data=4`를 회수했다면 상태는 다음처럼 진행됩니다.

1. 이벤트의 세대가 현재 연결과 일치하는지 확인합니다.
2. 논블로킹 `recv`를 호출해 반환된 4바이트를 파서에 넣습니다.
3. 파서가 길이 헤더와 본문을 사용해 `OK` 프레임을 완성합니다.
4. 다시 `recv`를 호출해 0을 확인합니다.
5. 버퍼가 소진된 뒤 입력 종료를 확정합니다.
6. `fflags`에 오류가 있었다면 정상 FIN과 구분해 오류 정책을 적용합니다.

여기서 `data=4`는 가능한 읽기 데이터의 관찰값이지 한 번의 `recv`에 대한 보장이 아닙니다. 네트워크 스택과 호출 버퍼 상태에 따라 실제 반환은 4보다 작을 수 있으므로, 1회 호출의 결과를 기준으로 반복합니다.

EOF 플래그만 보고 첫 단계에서 객체를 해제하면 마지막 메시지를 잃습니다. 반대로 EOF와 오류를 영원히 미루면 닫힌 연결을 계속 감시할 수 있습니다. 실제 `recv` 결과와 연결 상태 전이를 한 소유자가 기록해야 하며, 확보한 자료만으로 HUP를 `EV_EOF`와 동일시하지 않습니다.

## close와 디스크립터 수명

확인한 FreeBSD 문서와 Apple의 보관된 kqueue 문서는 `close()`가 해당 디스크립터를 참조하는 kevent를 제거한다고 설명합니다. kqueue 자체도 `close()`로 정리합니다. 중복 디스크립터의 등록 수명은 별도 플랫폼 계약이며 epoll의 open-file-description 규칙과 섞지 않습니다.

이 커널 계약은 애플리케이션 객체의 수명까지 해결하지 않습니다. 이벤트가 회수되어 local queue에 남아 있거나 worker가 callback을 실행 중이면 `udata`가 가리키는 연결 객체가 여전히 필요할 수 있습니다. 연결을 논리적으로 닫는 상태와 메모리를 해제하는 상태를 나누고, callback이 끝날 때까지 참조를 유지해야 합니다.

디스크립터 숫자는 재사용될 수 있습니다. 이전 연결의 이벤트가 늦게 처리되는 동안 같은 숫자로 새 소켓이 열리면 숫자만 비교하는 코드가 새 연결에 옛 결과를 적용할 수 있습니다. 연결 세대 번호는 이런 논리적 오용을 줄이지만 이미 해제된 포인터를 안전하게 만들지는 않습니다. 포인터 생존 보장과 세대 검사는 별도 장치입니다.

이 글은 duplicated descriptor와 동시 close의 세부 동작을 확정하지 않습니다. 파일 디스크립터의 기본 개념과 교체 경계는 [파일 디스크립터·매핑·내구 교체의 경계](/tech-interview/notes/file-state/)에서 이어집니다.

## 운영 관찰과 진단

운영 로그에는 디스크립터 숫자만 남기지 말고 연결 세대, 필터, `flags`, `fflags`, `data`, 실제 `recv`·`send` 반환값, local queue 재삽입 여부를 함께 기록합니다. 그러면 “이벤트가 없었다”, “읽기가 EAGAIN이었다”, “EOF 뒤 잔여 바이트를 처리했다”를 구분할 수 있습니다.

장애를 재현할 때는 한 연결에서 마지막 payload와 FIN을 같은 전송 순서로 만들고, 다른 연결에서는 송신 큐를 비운 뒤 WRITE 감시를 끕니다. 이어서 이벤트 집계, 예산 종료, `EAGAIN`, 오류, close 직전 callback, 디스크립터 재사용을 각각 관찰합니다. 아래의 제한된 로컬 시험 외에 이 전체 시나리오를 실행한 것은 아니며, 대상 BSD와 macOS 환경에서 별도 수행해야 합니다.

성능은 kqueue라는 이름만으로 판단하지 않습니다. 동일한 연결 수와 메시지 크기에서 wakeup 수, 실제 read/write 호출 수, 이벤트 배치 크기, 사용자 CPU 시간, p99 지연, local queue 체류 시간을 기록해야 합니다. 이 자료에는 BSD나 macOS에서 실행한 benchmark가 없으므로 다른 I/O 모델보다 빠르다는 결론을 내리지 않습니다.

## 참고 자료와 검증 범위

- [FreeBSD `kqueue(2)`](https://man.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2&manpath=FreeBSD+14.3-RELEASE): FreeBSD 14.3-RELEASE manual. 필터 평가 시점, 이벤트 집계, 변경 목록 적용 순서, `EV_CLEAR`, `EVFILT_READ`·`EVFILT_WRITE`, EOF·오류, close 제거를 확인했습니다.
- [Apple `kqueue(2)` 보관 문서](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kqueue.2.html): Mac OS X/iOS manual page, 문서상 특정 최신 릴리스 없음, 2000-04-14 표기. 읽기·쓰기, `EV_CLEAR`, EOF와 잔여 버퍼, close 제거를 확인했지만 현대 macOS 전체의 기능표로 사용하지 않았습니다.
- [준비 통지와 완료 통지의 버퍼 소유권](/tech-interview/notes/io-readiness/): 기존 저장소 노트. kqueue의 특정 릴리스 실행 결과가 아니라 준비·완료 모델의 공통 설계 경계입니다.
- [TCP 스트림의 프레이밍](/tech-interview/notes/tcp/): 기존 저장소 노트. TCP 바이트 스트림과 애플리케이션 프레임 경계를 연결합니다.

참고 자료는 2026-09-17에 확인했습니다. 완성된 kqueue 서버와 FreeBSD 실행은 검증하지 않았습니다. 다만 macOS 27.0 arm64에서 Python `select.kqueue`와 로컬 `socketpair`로 `EV_CLEAR` 등록, 길이 헤더를 포함한 4바이트를 1바이트씩 읽기, 잔여 payload 뒤 `recv` EOF를 확인하는 시험을 실행해 통과했습니다. 시험 코드는 [kqueue-example.py](https://github.com/c86j224s/tech-interview/blob/main/tests/kqueue-example.py)입니다. 이 시험은 TCP listen/accept, 다중 워커, FD 재사용 경쟁이나 성능을 증명하지 않습니다. 따라서 HUP 의미, duplicated descriptor와 동시 close, 특정 현대 macOS 릴리스의 세부 동작은 미확정이며 대상 환경에서 추가 검증해야 합니다.

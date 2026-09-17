---
id: epoll-foundations
title: Linux epoll 이벤트 루프
topic: 네트워크
summary: 논블로킹 소켓의 준비 상태를 epoll에 등록하고 LT·ET·EPOLLONESHOT의 진행, 재무장, 종료 경계를 하나의 실행 흐름으로 설명합니다.
questionIds: []
prerequisites: [computer-science-foundations, iocp-foundations]
related: [tcp, tcp-close, admission-control, iocp-completion]
reviewedAt: '2026-09-17'
---

# Linux epoll 이벤트 루프

## 준비 통지의 의미

`epoll`은 Linux에서 파일 디스크립터(file descriptor, 이하 FD)의 현재 입출력 준비 상태를 감시하는 인터페이스입니다. 읽기 이벤트가 왔다는 말은 지금 논블로킹 `recv`를 시도하면 진행할 가능성이 있다는 뜻이지, 완성된 메시지 하나가 버퍼에 있다는 뜻이 아닙니다. 실제 `recv`나 `send`의 반환값이 애플리케이션 상태를 결정합니다.

이 차이를 완료 통지와 섞으면 이벤트 루프의 책임이 사라집니다. 준비 기반 구조에서는 커널이 기회를 알리고 애플리케이션이 실제 I/O를 수행합니다. 따라서 부분 읽기, 부분 쓰기, `EAGAIN` 또는 `EWOULDBLOCK`, EOF, 그 밖의 오류를 각각 상태 전이로 기록해야 합니다. `epoll_wait`가 성공했다는 사실만으로 연결이 계속 살아 있다고 판단하지 않습니다.

## 논블로킹 파일 디스크립터 계약

소켓을 `O_NONBLOCK`으로 설정하면 한 번의 `recv`가 프로토콜 메시지의 경계를 보장하지 않습니다. 양수 반환값은 그만큼의 바이트를 읽었다는 뜻이고, 0은 스트림 입력의 정상적인 끝입니다. `EAGAIN` 또는 `EWOULDBLOCK`은 지금 읽을 데이터가 없다는 뜻이므로 즉시 연결 오류로 바꾸지 않습니다. 다른 `errno`는 시스템의 재시도·종료 정책에 따라 분류합니다.

읽은 바이트는 프레임 파서의 누적 영역에 넣습니다. 길이 접두사가 4바이트인 프로토콜에서 처음 `recv`가 2바이트만 반환하면 헤더가 완성되지 않았으므로 다음 읽기를 기다립니다. 반대로 1회의 `recv`가 두 프레임과 다음 프레임의 일부를 함께 반환할 수도 있습니다. 그러므로 반환 호출 수와 메시지 수를 같은 값으로 세지 않습니다.

쓰기에도 같은 계약이 있습니다. 송신 큐에 3KiB가 남았는데 `send`가 1KiB만 반환하면 offset을 1KiB로 옮기고 2KiB를 보존합니다. 송신 큐가 비었을 때까지 `EPOLLOUT`을 켜 두면 소켓이 대부분 계속 쓰기 가능하다고 알려 반복 실행이 생길 수 있으므로, 보낼 잔량이 있을 때만 writable 관심을 둡니다.

## 등록과 대기의 순서

기본 실행 순서는 감시 인스턴스 생성, 논블로킹 설정, 관심 이벤트 등록, `epoll_wait` 대기, 반환 항목 처리입니다. `epoll_create1` 또는 `epoll_ctl`이 실패하면 해당 FD를 조용히 빼지 않고 어느 단계에서 어떤 `errno`가 발생했는지 기록한 뒤 정리 경로로 보냅니다. `ADD` 중복, 미등록 FD에 대한 `MOD`·`DEL`, 잘못된 FD는 정상적인 데이터 분기가 아니라 등록 수명이나 구현 상태를 다시 확인해야 하는 신호입니다.

다음은 실행 가능한 C 프로그램이 아니라 호출 순서를 보여 주는 교육용 의사코드입니다. 실제 구현에서는 `epoll_wait`의 `EINTR`, 각 I/O의 `errno`, 이벤트 배열의 크기, 연결 객체의 수명과 동시성 규칙을 프로젝트 계약으로 보강해야 합니다.

```text
# 교육용 의사코드: 컴파일·실행 증거가 아님
loop_fd = epoll_create1(CLOEXEC)
if loop_fd < 0:
    fail_startup(errno)

set_nonblocking(listener)
if epoll_ctl(loop_fd, ADD, listener, EPOLLIN, token(listener, generation=1)) < 0:
    close(loop_fd)
    fail_startup(errno)

while not stopping:
    count = epoll_wait(loop_fd, events, MAX_EVENTS, timeout_ms)
    if count < 0 and errno == EINTR:
        continue
    if count < 0:
        fail_loop(errno)

    for event in events[0:count]:
        connection = lookup_current_token(event.data)
        if connection is missing:
            record_stale_event(event)
            continue
        dispatch(connection, event.events)
```

## 레벨 트리거 처리

레벨 트리거(level-triggered, LT)는 준비 조건이 남아 있는 동안 다음 `epoll_wait`에서도 다시 알릴 수 있는 기본 동작입니다. 처음 구현할 때는 이벤트 항목마다 정해진 바이트나 프레임 예산만 처리하고, 남은 작업은 다음 대기 또는 내부 실행 큐로 넘기는 흐름이 이해하기 쉽습니다. LT의 재통지를 공정성 정책으로 오해하지 말고 연결별 실행량을 별도로 제한합니다.

수신에서는 `EPOLLIN`을 받은 뒤 `recv` 반환값을 반복해서 상태에 반영합니다. 일부만 읽은 경우 누적 버퍼를 유지하고, `EAGAIN`이면 다시 대기합니다. EOF이면 입력 종료 상태로 전환하되 이미 만든 응답을 보낼지, 즉시 닫을지는 프로토콜 정책으로 결정합니다.

송신에서는 출력 큐와 offset을 연결 상태에 둡니다. 일부 전송이면 offset을 증가시키고 `EPOLLOUT`을 유지합니다. 큐가 완전히 비면 offset을 초기화하고 writable 관심을 제거합니다. `EPOLLERR`나 hang-up 계열 비트가 함께 왔을 때도 writable 성공을 가정하지 않고 실제 읽기·쓰기 결과와 소켓 종료 절차를 확인합니다.

## 에지 트리거 소진

에지 트리거(edge-triggered, ET)는 준비 상태의 변화에 가까운 시점에 통지하므로, 통지를 한 번 받은 뒤 데이터가 남은 상태로 대기하면 다시 통지되지 않아 정체될 수 있습니다. ET를 선택하면 논블로킹 `recv`와 `send`를 `EAGAIN` 또는 `EWOULDBLOCK`까지 반복해 현재 준비를 소진하는 것이 기본 진행 조건입니다.

그러나 한 연결이 계속 데이터를 보내는 상황에서 무한 소진을 허용하면 다른 연결이 굶습니다. 바이트 수, 완성 프레임 수, 벽시계 시간 가운데 하나 이상의 예산을 둡니다. 예산이 먼저 끝났다면 `EAGAIN`을 받은 것이 아니므로 커널 대기만 믿지 말고 내부 ready 큐에 다시 넣습니다. 반대로 `EAGAIN`으로 소진했다면 다음 커널 통지를 기다립니다.

```diagram
{"title":"ET 소진과 예산 양보","caption":"ET 통지 뒤 EAGAIN까지 갔는지, 애플리케이션 예산이 먼저 끝났는지에 따라 재개 경로가 달라집니다.","rows":[[{"id":"event","label":"EPOLLIN 통지"}],[{"id":"drain","label":"논블로킹 recv 반복","detail":["바이트·프레임 예산 적용"]}],[{"id":"again","label":"EAGAIN","detail":["현재 준비 소진"]},{"id":"budget","label":"예산 소진","detail":["데이터가 남을 수 있음"]}],[{"id":"wait","label":"다음 epoll_wait"},{"id":"ready","label":"내부 ready 큐"}]],"edges":[{"from":"event","to":"drain","label":"읽기 시도"},{"from":"drain","to":"again","label":"읽기 불가"},{"from":"drain","to":"budget","label":"공정성 양보"},{"from":"again","to":"wait","label":"커널 재대기"},{"from":"budget","to":"ready","label":"다시 실행"}]}
```

## 원샷 소유권과 재무장

`EPOLLONESHOT`은 이벤트를 한 번 전달한 뒤 `EPOLL_CTL_MOD`로 다시 활성화하기 전까지 해당 등록의 추가 통지를 막는 기능입니다. 이것은 연결을 한 시점에 한 실행 주체가 처리한다는 애플리케이션 규칙을 만들기 좋지만, 연결 객체의 메모리를 보존하거나 이미 실행 중인 callback을 취소해 주지는 않습니다.

연결을 처리한 주체는 입력 파서, 출력 offset, EOF·오류·종료 상태를 확정한 뒤 다음 관심 마스크를 계산합니다. 그 상태를 보호하는 규칙 안에서 `MOD` 재무장을 수행하고, 재무장이 성공한 뒤에는 이전 주체가 보호 없이 연결 상태를 다시 쓰지 않습니다. `MOD`가 close 과정에서 실패하면 실패 원인과 이미 종료된 연결이라는 사실을 기록하고 무한 재시도하지 않습니다.

재무장과 내부 ready 큐를 함께 사용한다면 `queued`, `running`, `armed` 같은 상태를 하나의 소유권 규칙 아래에서 직렬화해야 합니다. 그렇지 않으면 같은 연결이 커널 이벤트와 내부 큐에서 동시에 실행될 수 있습니다. 재무장은 통지 경계를 관리할 뿐, 파서와 출력 큐의 데이터 경계를 대신 관리하지 않습니다.

## FD 세대와 종료 경계

FD 정수는 연결의 영구적인 정체성이 아닙니다. 연결을 닫은 뒤 운영체제가 같은 번호를 새 소켓에 배정할 수 있으므로 이벤트 데이터에는 단순한 FD 대신 연결 token과 generation을 넣습니다. 이벤트를 꺼낸 뒤 현재 등록의 세대와 일치하는지 확인하면 오래된 이벤트가 새 연결에 적용되는 범위를 줄일 수 있습니다.

세대 검사는 애플리케이션 방어 장치이지 해제된 객체에 대한 참조를 되살리는 기능이 아닙니다. 이벤트를 읽어 둔 워커가 있다면 `DEL`이나 `close` 뒤에도 그 워커가 이미 보유한 연결 참조를 처리할 수 있습니다. 따라서 close 후보 전환, 실행 중 처리의 참조 유지, 최종 객체 해제를 나눕니다. token 조회가 포인터를 반환하는 구조라면 조회 테이블 자체를 최종 해제 시점까지 유지하거나, 재사용 가능한 정수 핸들과 세대 검사를 사용합니다.

`epoll` 인스턴스의 `close`도 마지막 등록 작업과 워커 참조가 끝난 뒤 수행합니다. 인스턴스 닫힘을 연결별 callback의 종료 신호로 사용하지 않고, 애플리케이션의 종료 장벽을 먼저 통과시킵니다.

## 실행 예제의 상태 추적

세 연결 A, B, C가 있고 `MAX_EVENTS=2`, 연결별 읽기 예산이 8KiB라고 하겠습니다. ET 상태에서 A에 12KiB가 쌓이면 첫 통지는 8KiB를 읽은 뒤 예산 소진으로 끝납니다. 아직 `EAGAIN`이 아니므로 A를 `budget_yield`로 기록하고 내부 큐에 넣습니다. 다음 실행에서 B를 처리한 뒤 A를 다시 읽어 나머지를 소진합니다.

A가 5KiB만 가지고 있어 두 번의 `recv` 끝에 `EAGAIN`을 받으면 A는 `kernel_wait`로 전환합니다. B의 출력 큐가 3KiB인데 첫 `send`가 1KiB만 보냈다면 `out_offset=1024`를 기록하고 `EPOLLOUT`을 유지합니다. 나머지 2KiB가 전송된 순간에만 writable 관심을 제거합니다.

이 숫자는 커널 실험 결과가 아니라 반환값에 따른 상태 계산 예입니다. 각 전이에 `fd`, `generation`, `interest_mask`, `input_bytes`, `output_offset`, `event_bits`, `errno`, `ready_reason`을 함께 남기면 통지 부재와 예산 양보, 잘못된 writable 유지, 실제 오류를 구분할 수 있습니다.

## 공정성과 배압

`epoll_wait`는 반환 배열의 상한을 적용하고 준비 목록이 길 때 반복 호출에서 준비 항목을 회전시켜 한정된 배열에 갇힌 FD를 완화할 수 있습니다. 이것만으로 연결별 처리 시간이나 메시지별 공정성이 보장되지는 않습니다. 서버는 연결별 바이트·프레임 예산, 내부 ready 큐의 항목·바이트 상한, accept 횟수 상한을 별도로 둡니다.

입력 큐와 출력 큐가 계속 커지면 읽기 관심을 잠시 끄거나 새 연결을 거절하는 방식으로 유입을 줄입니다. 읽기 관심을 끈다고 이미 실행 중인 `recv`가 중단되는 것은 아닙니다. 송신 큐가 상한을 넘으면 느린 소비자를 닫거나 상위 프로토콜에 실패를 알리는 정책을 명시합니다. 배압은 LT·ET 선택보다 상위의 메모리와 지연 예산입니다.

## 검증 범위와 진단 기준

실행 검증에서는 LT에서 unread bytes가 남은 뒤 다음 `epoll_wait`에 다시 반환되는지, ET에서 3개 프레임과 1프레임 예산을 주었을 때 내부 ready 큐를 거쳐 모두 순서대로 처리되는지를 확인합니다. EOF, `EAGAIN`, 부분 write, `EPOLLRDHUP`, `EPOLLERR`는 서로 다른 로그와 상태로 남깁니다. ONESHOT에서는 처리 후 `MOD` 재무장 성공과 close 중 실패를 별도 경로로 둡니다.

FD 번호를 재사용하는 상황에서는 새 연결의 generation이 예전 이벤트와 맞지 않는지 확인합니다. 기대 불변식은 한 프레임의 중복 적용 없음, 출력 offset의 단조 증가, 연결 객체가 참조 중인 동안 최종 해제 없음, 예산 양보 후 재실행 경로 존재입니다. 이 장의 의사코드와 숫자 흐름은 실행 결과가 아니라 계약을 설명하기 위한 예입니다.

## 참고 자료와 검증 범위

- [epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html): Linux man-pages 6.19, 문서 표기일 2026-02-08. readiness, LT 기본 동작, ET의 `EAGAIN` 소진, `EPOLLONESHOT` 의미를 확인한 근거입니다.
- [epoll_ctl(2)](https://man7.org/linux/man-pages/man2/epoll_ctl.2.html): Linux man-pages 6.19, 문서 표기일 2025-12-25. ONESHOT의 `MOD` 재무장과 `ADD`·`MOD`·`DEL` 오류 경계를 확인했습니다. close·FD 재사용 뒤 callback의 애플리케이션 수명은 이 문서가 보장한다고 확장하지 않았습니다.
- [epoll_wait(2)](https://man7.org/linux/man-pages/man2/epoll_wait.2.html): Linux man-pages 6.19, 문서 표기일 2026-02-08. 반환 이벤트 수, timeout, 준비 목록 회전의 범위를 확인했습니다.
- [epoll_create1(2)](https://man7.org/linux/man-pages/man2/epoll_create1.2.html): Linux 2.6.27 및 glibc 2.9 표기. epoll 인스턴스의 `close` 수명을 확인했습니다.

검증 기준일은 2026-09-17입니다. Linux 커널에서 이 장의 프로그램을 컴파일·실행하지 않았고, 성능 benchmark나 특정 배포판의 동작을 주장하지 않습니다. 위 문서 버전은 확인한 문서의 버전·날짜이고, 독자의 배포 대상 커널 버전을 뜻하지 않습니다. ET 소진과 객체 수명은 Linux API 사실에 더해 애플리케이션 상태 프로토콜로 제시한 설계입니다.

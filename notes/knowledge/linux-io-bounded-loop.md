---
id: linux-io-bounded-loop
title: Linux epoll과 io_uring 경계 실습
topic: 네트워크
summary: loopback echo 서버를 직접 따라가며 epoll의 ET·ONESHOT 준비 통지와 io_uring의 one-shot CQE 수명, partial I/O, 기능 탐색과 종료 경계를 작은 코드로 확인합니다.
questionIds: []
prerequisites: [epoll-foundations, io-uring-foundations, io-uring-lifetimes]
related: [tcp, io-readiness]
reviewedAt: '2026-09-18'
---

# Linux epoll과 io_uring 경계 실습

정본 링크: [/tech-interview/notes/linux-io-bounded-loop/](/tech-interview/notes/linux-io-bounded-loop/)

이 실습의 핵심은 “이벤트가 왔으니 메시지 하나가 끝났다”는 가정을 버리고, 바이트 이동·준비 통지·완료 통지·버퍼 반환을 각각 추적하는 데 있습니다. 같은 loopback echo를 epoll과 io_uring으로 구현하되, 제품용 네트워크 프레임워크가 아니라 읽을 수 있는 작은 bounded loop로 범위를 제한합니다. 서버는 외부 주소에 bind하지 않고, 연결 수·버퍼·작업 예산을 고정합니다.

`epoll` 경로에서 커널은 논블로킹 I/O를 시도할 준비가 되었음을 알립니다. ET에서는 읽기와 쓰기를 EAGAIN까지 진행하거나 애플리케이션 예산에서 양보해야 합니다. ONESHOT에서는 이벤트를 회수한 뒤 관심을 `EPOLL_CTL_MOD`로 재무장해야 합니다. `io_uring` 경로에서 SQE 제출은 I/O 완료가 아니며 CQE의 `user_data`와 `res`가 완료를 연결합니다. recv·send에 넘긴 operation과 버퍼는 해당 완료를 소비할 때까지 살아 있어야 합니다.

이 노트와 코드는 Linux에서 실제 실행하지 않았습니다. 작성 환경은 macOS 27 arm64이므로 Linux 실행 결과는 모두 `NOT_RUN`입니다. 아래 명령과 기대 결과는 Linux 호스트에서 검증할 계약이며, 현재 환경의 simulation을 Linux integration 실행으로 부르지 않습니다.

```diagram
{"title":"준비 통지와 완료 통지의 bounded echo","caption":"epoll은 준비 뒤 논블로킹 호출로 바이트를 얻고, io_uring은 제출 뒤 CQE에서 결과를 회수합니다. 두 경로 모두 partial I/O와 버퍼 수명을 별도로 관리합니다.","rows":[[{"id":"client","label":"loopback client","detail":["1,500바이트 전송","whole·split·halfclose"]}],[{"id":"epoll","label":"epoll ET·ONESHOT","detail":["recv/send 예산","FIFO local rerun","generation handle"]},{"id":"uring","label":"io_uring one-shot","detail":["SQE 소유권","partial send offset","cancel·target drain"]}],[{"id":"state","label":"연결 상태","detail":["입력·출력 잔량","EOF·close"]}],[{"id":"reply","label":"echo 검증","detail":["1,500바이트 회수","client exit 0"]}]],"edges":[{"from":"client","to":"epoll","label":"TCP bytes"},{"from":"client","to":"uring","label":"TCP bytes"},{"from":"epoll","to":"state","label":"recv/send 반환값"},{"from":"uring","to":"state","label":"CQE res 처리"},{"from":"state","to":"reply","label":"응답 잔량 완료"}]}
```

## 기본 모델

TCP는 메시지 큐가 아니라 순서가 있는 바이트 스트림입니다. client가 1,500바이트를 한 번의 `write`로 보냈더라도 서버의 `recv`는 그보다 작거나 크게 관찰될 수 있습니다. split 모드에서 첫 1바이트와 나머지를 나누어 보내는 이유는 “한 번의 도착 = 한 번의 메시지”라는 설명을 깨기 위해서입니다. halfclose 모드는 payload를 모두 보낸 뒤 송신 방향만 닫아 서버가 `recv == 0`을 관찰하더라도 이미 큐에 있는 echo를 끝까지 보낼 수 있는지 확인합니다. `backpressure` 모드는 echo를 읽지 않고 대량 입력을 공급하여 bounded output queue가 상한을 넘지 않는지 확인합니다.

epoll은 readiness 모델입니다. `EPOLLIN`은 지금 `recv`를 시도할 가능성이 있음을 알리는 신호이고, `recv`의 실제 반환값이 상태를 결정합니다. `EPOLLET`를 사용하면 통지 뒤 논블로킹 호출을 반복하여 EAGAIN까지 소진하는 것이 기본 진행 조건입니다. 다만 연결 하나가 계속 생산할 때 무한 drain은 다른 연결을 굶길 수 있으므로 코드에 512바이트 예산을 둡니다. 예산이 먼저 끝났다면 FIFO local ready queue에 connection generation handle을 넣고 한 번에 하나의 quantum만 다시 처리합니다. 이 방식은 같은 연결의 작업이 `epoll_wait`와 listener/new connection을 계속 가로채는 starvation을 피합니다.

`EPOLLONESHOT`은 이벤트를 한 번 전달한 뒤 추가 통지를 멈추므로, handler가 현재 상태를 확정한 다음 `EPOLL_CTL_MOD`로 다시 활성화합니다. epoll data에는 재사용 가능한 포인터 대신 slot index와 generation을 담은 64-bit handle을 사용합니다. close와 slot 재사용 뒤 이미 반환된 stale event는 generation 검증으로 폐기됩니다.

io_uring은 SQ에 작업을 준비·제출하고 CQ에서 결과를 회수하는 completion 모델입니다. SQE 제출은 I/O 완료가 아닙니다. CQE는 `user_data`로 operation을 찾고 `res`로 바이트 수 또는 음수 오류를 전달합니다. 이 lab은 accept, recv, send를 각각 one-shot으로 제출하고 CQE를 본 뒤 다음 operation을 냅니다. multishot, provided buffer, fixed resource, zero-copy를 사용하지 않습니다.

## 실행 trace

epoll 경로에서 client가 1,500바이트를 split·halfclose 모드로 보낸다고 하겠습니다.

1. 서버가 `127.0.0.1:19090`에 bind하고 listener를 `EPOLLIN`으로 등록합니다.
2. accept event가 오면 최대 8개까지 accept를 반복하고, 새 연결을 `EPOLLIN | EPOLLET | EPOLLONESHOT | EPOLLRDHUP`로 등록합니다.
3. 첫 client write가 1바이트뿐이면 연결 event의 `recv`가 1을 반환합니다. 서버는 이 바이트를 출력 큐에 복사하고 다시 `recv`를 시도합니다.
4. 두 번째 write 전에는 `recv`가 EAGAIN을 반환합니다. 서버는 출력이 남아 있으면 `EPOLLOUT`을 관심 마스크에 넣고 `MOD`로 재무장합니다.
5. client가 나머지 1,499바이트를 보내고 송신 방향을 닫으면 서버는 양수 read를 모두 queue한 뒤 `recv == 0`에서만 peer EOF를 기록합니다. `EPOLLRDHUP` 자체는 close 판정이 아닙니다.
6. writable event에서 `send`가 짧게 반환해도 offset을 그만큼만 증가시킵니다. 잔량이 0이 될 때만 `EPOLLOUT`을 끕니다.
7. 출력 큐가 비워지면 peer EOF 정책에 따라 연결을 닫습니다.

io_uring 경로에서는 같은 흐름이 다르게 관찰됩니다.

1. `io_uring_queue_init_params`가 실패하면 음수 결과를 출력하고 exit 77을 반환합니다. `params.features`는 관찰용으로만 출력합니다.
2. accept SQE의 실제 submission count가 정확히 1이 아니면 SQE에 연결된 operation을 재사용하지 않고 process exit 70으로 종료합니다. 실패 시 staged SQE와 kernel ownership을 안전하게 추론할 수 없기 때문입니다.
3. accept CQE가 양수 FD를 반환하면 client slot에 저장하고 recv operation을 제출합니다. accept가 shutdown 중 완료되면 새 FD를 즉시 닫습니다.
4. recv CQE의 양수 `res`는 수신 바이트 수입니다. 0은 EOF이고 음수는 operation 오류입니다. 양수이면 stable send operation으로 복사합니다.
5. send CQE가 짧게 완료되면 연결을 닫지 않습니다. send offset을 증가시키고 잔량만 다음 send SQE로 제출합니다.
6. SIGTERM은 새 accept를 만들지 않고 accept와 각 client의 현재 target에 대해 cancel을 별도로 추적합니다. cancel CQE가 target CQE를 대신하지 않으므로 두 completion을 모두 drain합니다. `-ENOENT`와 `-EALREADY`도 target completion을 기다리는 상태로 취급합니다.
7. graceful drain은 2초로 제한합니다. CQE wait 자체가 신뢰할 수 없거나 deadline을 넘으면 process exit 70으로 종료하여 operation을 unsafe하게 재사용하지 않습니다.

## 코드 walkthrough

`examples/knowledge/linux-io-lab/epoll_echo.c`의 `handle_read`와 `handle_write`는 syscall 반환값을 직접 상태로 바꿉니다. `EINTR`은 재시도하고, EAGAIN/EWOULDBLOCK은 현재 준비를 소진한 것으로 보고 반환하며, 0 read만 peer EOF로 저장합니다. `service_connection`은 read와 write budget을 각각 다루고, budget yield를 FIFO local queue에 넣습니다. 한 loop에서 queue의 한 항목만 실행하므로 local rerun이 `epoll_wait`, listener, 새 connection을 무한히 미루지 않습니다. epoll token은 generation handle이라 stale event가 새 slot owner를 건드리지 않습니다.

`examples/knowledge/linux-io-lab/uring_echo.c`는 SQE 확보, 정확히 하나의 제출, CQE 완료를 분리합니다. 제출 호출의 결과가 정확히 1이 아니면 operation을 free/reuse하지 않고 exit 70을 선택합니다. client는 generation을 보존한 operation을 사용하며, send는 `off`와 `len`으로 partial completion을 이어갑니다. 종료 시 accept cancel과 client cancel을 각각 추적하고, cancel completion과 target completion이 모두 소비되기 전 FD나 operation을 재사용하지 않습니다.

## 빌드와 실행

```sh
cd examples/knowledge/linux-io-lab
make
./run-local.sh
```

Linux에서 `run-local.sh`는 readiness retry와 timeout이 있는 client로 whole, split, half-close를 실행하고 두 서버를 정리합니다. 서버 startup timeout, 종료 cleanup, io_uring 초기화 실패는 로그와 exit status로 구분합니다. macOS를 포함한 비-Linux 환경에서는 `NOT_RUN`만 출력하고 Linux 실행 결과를 가장하지 않습니다. 출력 로그는 lab 디렉터리의 `epoll-echo.log`, `uring-echo.log`에만 기록합니다.

성공 기준은 epoll 서버에서 세 client case가 각각 exit 0이고 서버가 SIGTERM 뒤 정상 drain하는 것입니다. io_uring 서버도 같은 case를 통과해야 하며, queue initialization이 지원되지 않는 Linux에서는 exit 77을 feature-probe fallback으로 기록할 수 있습니다. send partial path, cancel/target completion, multi-connection fairness는 Linux host에서 별도 로그로 관찰해야 합니다.

## 실패 주입

1. split 또는 halfclose에서 `EPOLLRDHUP`만 보고 닫도록 변형합니다. `recv == 0` 전에는 EOF로 확정하지 않아야 합니다.
2. epoll의 `IO_BUDGET`을 1로 바꾸고 한 연결에 계속 입력을 공급합니다. FIFO local rerun이 한 quantum씩 처리하고 다른 ready connection과 listener를 굶기지 않는지 봅니다.
3. 새 connection slot을 재사용하면서 이전 event token을 주입합니다. generation mismatch가 stale event를 폐기해야 합니다.
4. output reader를 늦추고 send가 짧게 완료되도록 합니다. epoll은 offset을, io_uring은 send CQE의 `res`와 offset을 보존해야 합니다.
5. `io_uring_submit`이 0 또는 음수를 반환하는 주입을 합니다. staged operation을 재사용하지 않고 exit 70으로 process teardown을 선택해야 합니다.
6. SIGTERM을 recv 또는 send 중인 서버에 보냅니다. accept/client cancel과 target CQE를 분리하고, 2초 drain deadline 뒤 남은 작업은 process termination fallback으로 처리해야 합니다.

## 진단과 실제 검증 한계

중복 응답은 event나 CQE를 두 번 소비했는지, 같은 입력을 두 번 queue했는지, output offset을 증가시키지 않았는지 나눠 봅니다. 정체는 ET drain 누락, EAGAIN 처리 오류, ONESHOT MOD 누락, budget queue 부재를 나눠 봅니다. 조기 close는 `recv == 0` 전 RDHUP/HUP를 EOF로 합쳤는지 봅니다. io_uring 수명 문제는 submission count, operation 주소, generation, CQE `res`, `cqe_seen` 시점, close 시점을 함께 기록합니다.

현재 환경에서 실행한 것은 파일 정적 점검과 `test_client.c`의 macOS 문법 점검입니다. macOS에는 Linux epoll과 liburing 실행 환경이 없으므로 Linux compile/integration, partial I/O 관찰, fairness, cancel drain은 `NOT_RUN`입니다. 실제 Linux 검증 때는 `uname -a`, compiler version, liburing release, `make` 출력, client exit code, server logs, 종료 후 프로세스 상태를 보존합니다.

## 참고 자료와 범위

- [epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html): readiness, LT·ET, EAGAIN까지의 drain, ready FD fairness, EPOLLONESHOT rearm.
- [epoll_ctl(2)](https://man7.org/linux/man-pages/man2/epoll_ctl.2.html): ONESHOT 이후 `EPOLL_CTL_MOD`, RDHUP·HUP·ERR 구분.
- [io_uring(7)](https://man7.org/linux/man-pages/man7/io_uring.7.html): SQ/CQ 경계, completion 순서, `user_data`, CQE `res`, completion 전 buffer lifetime.
- [io_uring_setup(2)](https://man7.org/linux/man-pages/man2/io_uring_setup.2.html): kernel이 채우는 `params.features`와 setup error.
- [io_uring_queue_init(3)](https://man7.org/linux/man-pages/man3/io_uring_queue_init.3.html): 성공 0·실패 negative errno.
- [io_uring_prep_recv(3)](https://man7.org/linux/man-pages/man3/io_uring_prep_recv.3.html): recv SQE와 CQE result.
- [io_uring_prep_cancel(3)](https://man7.org/linux/man-pages/man3/io_uring_prep_cancel.3.html): cancel CQE와 target completion의 분리, `-ENOENT`, `-EALREADY`.

이 실습은 multishot, registered/provided buffer, zero-copy notification, fixed resource, SQPOLL, linked requests, timeout, concurrent ring access, TLS, framing protocol을 다루지 않습니다. bounded partial echo와 보수적인 제출·종료 소유권 경계를 학습하기 위한 코드이며 성능 수치나 제품 적합성의 근거가 아닙니다.

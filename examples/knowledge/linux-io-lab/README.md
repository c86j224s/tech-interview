# Linux I/O bounded lab

정본 노트: [/tech-interview/notes/linux-io-bounded-loop/](/tech-interview/notes/linux-io-bounded-loop/)

이 패키지는 Linux loopback에서 같은 작은 echo 동작을 두 모델로 비교하는 실습입니다. `epoll_echo.c`는 논블로킹 `epoll` ET·ONESHOT 루프를 사용하고, `uring_echo.c`는 liburing one-shot accept/recv/send CQE 흐름을 사용합니다. `test_client.c`는 1,500바이트를 whole, split, half-close 모드로 보내고 partial write/read를 재시도하며 payload 전체를 검증합니다. 별도의 `backpressure` 모드는 echo를 읽지 않은 채 대량 입력을 공급해 서버의 느린 reader 뒤 서버가 계속 응답하는지 관찰합니다. 큐 크기나 공정성의 계측 증거를 자동 수집하지는 않습니다.

## 범위

- 두 서버 모두 loopback 주소 `127.0.0.1`에만 bind합니다.
- epoll 서버는 연결 32개, 이벤트 배치 64개, accept 배치 8개, 연결별 read/write 예산 512바이트, 출력 큐 4KiB로 제한합니다.
- epoll local rerun은 FIFO queue에서 한 connection quantum만 처리하여 listener와 새 ready connection을 굶기지 않습니다. event token은 slot index와 generation을 함께 사용합니다.
- io_uring 서버는 연결 8개, queue depth 32, 수신 버퍼 1KiB로 제한합니다. accept·recv·send·cancel operation을 CQE까지 추적하고 send offset으로 partial send를 이어갑니다.
- TCP message framing, TLS, 멀티스레드 공유 ring, registered/provided buffer, multishot, zero-copy, splice, fixed file, SQPOLL, production logging은 범위 밖입니다.
- 성능 우열을 주장하지 않습니다. 이 코드는 교육용 bounded loop입니다.

## 의존성

Linux 환경과 C11 컴파일러, runner용 Python 3가 필요합니다. epoll 예제는 Linux headers와 libc만 필요합니다. io_uring 예제는 개발용 liburing headers와 library가 필요하며 배포판 패키지 이름은 환경에 따라 다릅니다. 예를 들어 Debian/Ubuntu 계열에서는 `liburing-dev`가 흔하지만 이 제안에서는 설치를 실행하지 않았습니다.

## 빌드와 실행

저장소 루트가 `tech-interview`인 경우 다음처럼 실행합니다. 로그 파일은 lab 디렉터리에 만들어집니다.

```sh
cd examples/knowledge/linux-io-lab
make
sh run-local.sh
```

Linux에서 `run-local.sh`는 서버 startup을 readiness 로그로 확인하고, 각 client에 poll timeout/retry를 적용하여 whole, split, split halfclose를 실행한 뒤 SIGTERM과 cleanup을 수행합니다. io_uring 초기화가 지원되지 않으면 서버는 exit 77을 반환하므로 feature-probe fallback으로 기록합니다. submit/wait ownership이 불확실하거나 drain deadline을 넘으면 서버는 exit 70으로 process termination fallback을 사용합니다.

비-Linux에서 `run-local.sh`는 `NOT_RUN`을 출력하고 성공으로 종료합니다. 이는 Linux 컴파일이나 통합 실행으로 오인되지 않도록 하기 위한 정직한 정적 환경 처리입니다.

## 기대 결과

각 client 실행은 서버가 모든 1,500바이트를 순서대로 echo했을 때 exit 0이어야 합니다. split 모드에서 서버가 첫 1바이트 뒤 다음 data를 기다리는 동안 연결을 조기 종료하지 않아야 합니다. halfclose 모드에서도 송신 방향 EOF 뒤 이미 큐에 있는 응답을 모두 flush해야 합니다. epoll은 RDHUP/HUP bit 자체가 아니라 `recv == 0`에서만 peer EOF를 확정합니다.

epoll ET read/write는 예산 또는 EAGAIN에서 반환합니다. 예산을 소진한 read/write는 FIFO local ready queue에서 다시 처리하며, 매 pass 한 quantum만 재실행합니다. ONESHOT 이벤트는 작업 후 `EPOLL_CTL_MOD`로 재무장하고, stale event는 generation handle 검증으로 폐기합니다. io_uring은 제출 호출의 정확한 제출 count와 CQE 완료를 분리하고, partial send의 offset을 보존하며, operation buffer를 해당 CQE 소비 전 재사용하지 않습니다.

## 실패 주입

1. `test_client 19090 split halfclose`에서 서버가 RDHUP만 보고 닫도록 변형하면 안 됩니다. `recv == 0`에서만 EOF를 기록하고 queued response를 flush해야 합니다.
2. epoll의 `IO_BUDGET`을 1로 바꾸고 한 연결에 계속 입력을 공급합니다. local FIFO rerun이 한 연결을 독점하지 않고 listener/new ready connection을 계속 처리하는지 확인합니다.
3. 연결 slot을 close 뒤 재사용하면서 이전 event token을 주입합니다. generation mismatch가 stale event를 폐기해야 합니다.
4. reader를 늦춰 send가 짧게 완료되도록 합니다. epoll은 output offset을, io_uring은 send CQE `res`와 offset을 보존해야 합니다.
5. `io_uring_submit`이 0 또는 음수를 반환하는 주입을 합니다. staged operation을 free/reuse하지 않고 exit 70으로 process teardown을 선택해야 합니다.
6. SIGTERM을 recv 또는 send 중인 서버에 보냅니다. accept cancel, client cancel, target completion을 각각 drain하고, 2초 뒤 남은 작업은 exit 70 fallback으로 처리해야 합니다.
7. `MAX_CONNECTIONS`보다 많은 연결을 동시에 열면 새 FD를 즉시 닫고 고정된 메모리 상한을 유지해야 합니다.

## 진단 기준

중복 echo는 같은 CQE 또는 epoll event를 두 번 종결했는지, 같은 입력을 두 번 queue했는지, partial send offset을 증가시키지 않았는지 분리해 봅니다. 정체는 ET drain 누락, EAGAIN 처리 오류, ONESHOT 재무장 누락, budget local queue 부재를 나눠 봅니다. 조기 종료는 RDHUP/HUP를 `recv == 0`과 혼합했는지 확인합니다. io_uring 수명 문제는 submission count, operation 주소, generation, CQE `res`, `cqe_seen` 시점, close 시점을 함께 기록합니다.

현재 작성 환경은 macOS 27 arm64이며 Linux kernel, epoll, liburing을 사용할 수 없습니다. 따라서 이 패키지의 Linux compile/run, runtime partial I/O, multi-connection fairness, cancellation drain 결과는 `NOT_RUN`입니다. 현재 환경에서 실행 가능한 검사는 소스·Makefile·스크립트의 정적 점검과 client source 문법 점검뿐이며 Linux integration 실행으로 표시하지 않습니다.

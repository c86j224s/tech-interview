---
id: process-signals-async-safety
title: 프로세스 신호 마스크와 async-signal-safety
topic: 운영체제
summary: >-
  pending signal·thread/process mask·handler 재진입을 구분하고 신호 처리기에서 호출 가능한 제한된 함수
  집합을 설명합니다.
questionIds: []
prerequisites:
  - execution-boundaries
  - condition-variables
related:
  - java-execution-lifetime
  - request-task-lifetime
reviewedAt: '2026-09-19'
---
# 프로세스 신호 마스크와 async-signal-safety

Unix signal에는 발생, 대상 선택, mask에 의한 보류, disposition에 따른 전달, handler 본문 실행이라는 서로 다른 단계가 있습니다. `SIGUSR1`을 block했다고 발생 사실이 없어지는 것이 아니며, 지정 대상이 현재 받을 수 없으면 pending set에 남을 수 있습니다. 반대로 process-directed signal은 여러 thread 중 하나가 받을 수 있으므로 “보낸 thread에서 handler가 실행된다”는 설명도 일반 규칙이 아닙니다. 이 글은 Linux signal delivery와 POSIX API의 범위를 나눈 뒤, handler에서 안전하게 할 수 있는 일과 정상 실행 흐름으로 넘겨야 할 일을 연결합니다.

## Signal 상태

signal disposition은 process 수준의 정책으로, default 동작·ignore·installed handler를 구분합니다. mask는 멀티스레드 process에서 각 thread가 가진 차단 집합입니다. pending은 발생했지만 아직 해당 대상에서 disposition이 실행되지 않은 상태를 가리킵니다. delivered는 handler가 호출되거나 default 동작이 진행되는 단계입니다.

따라서 한 signal을 다음처럼 분리해 기록합니다.

- **blocked**: 현재 대상 thread의 mask가 전달을 막음
- **pending**: 전달되지 않은 signal이 대상 process 또는 thread에 존재함
- **delivered**: mask와 대상 조건을 통과해 handler/default가 실행됨

일반 signal은 같은 번호가 여러 번 발생해도 모든 횟수가 실시간 signal처럼 보존된다고 가정하면 안 됩니다. Linux `signal(7)`은 standard signal과 realtime signal의 queueing 범위를 따로 설명하므로, 횟수 보장이 필요한 설계는 realtime signal 또는 별도 IPC 계약을 검토해야 합니다.

## Thread mask

`pthread_sigmask`는 호출한 thread의 mask를 바꿉니다. POSIX의 `pthread_sigmask`와 `sigaction`은 mask와 disposition을 별도 개념으로 다루며, handler 실행 중 임시로 block할 signal도 disposition의 `sa_mask`로 지정할 수 있습니다. process 전체에 하나의 mask만 있다고 가정하면 worker별 취소 경로를 잘못 분석합니다.

예를 들어 T1과 T2가 있고, T1만 SIGUSR1을 block한 상태에서 `kill(pid, SIGUSR1)`을 호출하면 process-directed signal은 Linux 규칙상 허용된 적절한 thread 중 하나를 대상으로 선택할 수 있습니다. T2가 허용 상태라면 T2에서 handler가 실행될 수 있습니다. `pthread_kill(T1, SIGUSR1)`처럼 thread-directed로 지정하면 T1의 mask가 전달을 막는 동안 그 대상 thread의 pending 상태로 남을 수 있습니다.

```diagram
{"title":"Mask와 pending의 전달 단계","caption":"signal의 발생과 delivery를 분리합니다. process-directed 신호는 허용된 thread를 선택할 수 있고, thread-directed 신호는 지정 thread의 mask를 따릅니다.","rows":[[{"id":"arrive","label":"Signal 도착","detail":["process 또는 thread 대상","발생 기록"]}],[{"id":"blocked","label":"Blocked","detail":["thread mask 차단","pending 가능"]},{"id":"ready","label":"Delivery 가능","detail":["mask 허용","대상 선택 완료"]}],[{"id":"pending","label":"Pending set","detail":["아직 전달 전","unblock 대기"]},{"id":"run","label":"Handler/default","detail":["disposition 실행","정상 흐름 중단"]}]],"edges":[{"from":"arrive","to":"blocked","label":"mask 검사"},{"from":"arrive","to":"ready","label":"mask 허용"},{"from":"blocked","to":"pending","label":"전달 보류"},{"from":"pending","to":"run","label":"unblock 후 전달"},{"from":"ready","to":"run","label":"즉시 전달 시도"}]}
```

## 대상 선택

process-directed와 thread-directed를 같은 API 범주로 뭉개면 handler 실행 thread와 취소 대상이 섞입니다. POSIX `kill`은 process 또는 process group을 대상으로 하고, `pthread_kill`은 지정 thread에 전달을 요청합니다. Linux `signal(7)`은 process-directed signal을 받을 수 있는 thread 가운데 하나가 선택되는 규칙과 thread별 pending/mask를 설명합니다. 이 세부를 signal-safety(7) 하나로 증명해서는 안 됩니다. signal-safety(7)은 handler 호출 함수 제한을 위한 문서입니다.

세 thread T1, T2, T3 중 T1·T2가 SIGUSR1을 block하고 T3만 허용한다고 하겠습니다. process-directed `kill`은 T3에서 handler가 실행될 수 있습니다. 이후 T3도 block하면 process-level pending으로 남을 수 있고, T1에 thread-directed signal을 보냈다면 T1이 unblock할 때 해당 thread에서 전달될 수 있습니다. 이는 어떤 작업을 “즉시 중단”한다는 뜻이 아닙니다. handler 진입 지점은 임의이고, 작업이 잡은 파일·락·외부 변경을 자동 rollback하지 않습니다.

## Mask 변경과 소비

종료 신호를 전용 thread가 `sigwait` 계열로 소비하게 하려면 시작 순서가 중요합니다. 먼저 모든 worker가 해당 signal을 block한 상태를 만들고, 전용 waiter가 기다리도록 해야 다른 worker handler가 먼저 실행되는 경쟁을 줄일 수 있습니다. 반대로 block을 해제한 뒤에 waiter를 만들면 signal이 다른 thread로 전달될 수 있습니다.

handler를 유지해야 한다면 최소한의 flag나 안전한 통지만 수행합니다. `volatile sig_atomic_t` 기반 표시를 쓰는 예시는 개념을 보여 주지만, compiler·libc·system call 재시작 규칙을 대상 환경에서 확인해야 합니다. self-pipe는 handler가 pipe write를 하고 event loop가 정상 문맥에서 읽는 구조이며, pipe가 가득 찰 때 `EAGAIN`이 나도 별도 flag로 종료 요청이 보존되도록 설계합니다.

## Async-signal-safe 경계

`async-signal-safe`는 같은 thread가 임의의 명령 중간에 끊긴 뒤 호출되어도 안전하다고 POSIX가 제한적으로 정의한 함수 집합입니다. `signal-safety(7)`은 `printf` 같은 stdio가 내부 buffer와 bookkeeping을 사용하므로 handler에서 안전하지 않은 대표 사례라고 설명합니다. 본문 thread가 stdio 내부 상태를 갱신하는 순간 SIGTERM이 들어오고 handler가 다시 `printf`를 호출하면 자기 자신이 lock을 기다리거나 중간 buffer를 훼손할 수 있습니다. `malloc`도 allocator의 내부 free list가 중간 상태일 수 있어 같은 이유로 피합니다.

thread-safe와 signal-safe는 다릅니다. 여러 thread의 동시 호출을 보호하는 mutex는 같은 thread가 그 mutex를 보유한 순간 handler에서 재진입하면 풀어 줄 실행 흐름이 없어질 수 있습니다. handler에서 `errno`를 확인할 필요가 있다면 진입 직후 저장하고 반환 전에 복구합니다. 이처럼 안전성은 함수의 평상시 동시성뿐 아니라 비동기 중단 지점을 포함한 계약입니다.

## 안전한 종료 구조

```c
static volatile sig_atomic_t stop_requested;

static void on_term(int signo) {
    (void)signo;
    stop_requested = 1;
}

int main(void) {
    install_sigaction_for_term(on_term);
    while (!stop_requested) {
        process_one_item();
    }
    stop_accepting();
    drain_or_cancel_workers();
    close_resources_in_normal_flow();
}
```

이 코드는 설명용이며 이 환경에서 컴파일·실행하지 않았습니다. 예상 상태는 handler가 flag만 바꾸고, main loop가 다음 안전한 경계에서 accept 중단·worker 정리·로그를 수행하는 것입니다. `process_one_item`이 EINTR을 어떻게 처리하는지, signal이 반복될 때 drain 정책이 무엇인지, pipe 통지의 포화가 종료 요청을 잃지 않는지까지 검증해야 합니다.

## 검증과 관찰

테스트는 signal을 보냈다는 사실만 기록하지 않습니다. process-directed/thread-directed 구분, 지정 thread ID, 각 thread mask, pending 관찰, handler 실행 thread, 정상 종료 시작·완료 시각을 함께 남깁니다. T1만 block한 상태에서 process-directed signal을 반복하면 T2가 소비할 수 있으며, 두 thread 모두 block하면 pending과 unblock 시점을 확인할 수 있습니다.

handler 안전성은 `printf`가 한 번 출력됐다는 결과로 증명할 수 없습니다. stdio·allocator·사용자 lock 보유 구간에 signal이 끼어들 수 있다는 정적 경계를 확인하고, handler의 호출 목록을 POSIX safe 목록과 대조합니다. 실제 shutdown에서는 signal 도착과 DB commit, 외부 메일, socket close의 순서를 관측해 signal이 외부 효과를 자동 되돌린다는 오해를 제거합니다.

## Exec 경계

`execve` 성공 시 PID는 유지되지만 image는 교체됩니다. caught handler는 새 image의 함수 주소로 이어질 수 없어 default로 재설정되고, Linux에서는 ignored disposition이 유지됩니다. 반면 calling thread의 signal mask와 pending signal은 POSIX `exec` 계약에 따라 새 initial thread에 상속됩니다. XSI/Linux alternate signal stack은 폐기되는 범주이므로 handler·mask·pending을 한 문장으로 “모두 초기화”하지 않습니다.

## 비용과 참고 범위

signal은 임의 실행 지점에 끼어들어 handler 제약을 지켜도 테스트가 어렵습니다. block을 오래 유지하면 pending 전달이 지연되고, process-directed 선택은 원하는 worker를 보장하지 않습니다. 장기 취소는 명시적 token·queue·event loop를 주 경로로 두고 signal은 최소 통지로 제한하는 편이 예측 가능합니다.

- Linux `signal(7)`: https://man7.org/linux/man-pages/man7/signal.7.html — process/thread-directed 전달, thread별 mask·pending, standard/realtime queueing 범위를 확인했습니다.
- POSIX `pthread_sigmask`: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_sigmask.html — 호출 thread mask 변경을 확인했습니다.
- POSIX `kill`, `pthread_kill`, `sigaction`: https://pubs.opengroup.org/onlinepubs/9799919799/functions/kill.html, https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_kill.html, https://pubs.opengroup.org/onlinepubs/9799919799/functions/sigaction.html — 대상과 disposition 계약을 확인했습니다.
- Linux `signal-safety(7)`: https://man7.org/linux/man-pages/man7/signal-safety.7.html — async-signal-safe 함수, stdio 재진입, errno 보존을 확인했습니다. 이 문서는 대상 선택 근거가 아닙니다.

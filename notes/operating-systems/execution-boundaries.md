---
id: execution-boundaries
title: 프로세스·스레드·커널 진입의 경계
topic: 운영체제
summary: 주소 공간과 실행 상태를 구분하고 syscall·vDSO·Ready/Blocked·문맥 전환·공유 메모리 소유자 사망의 책임을 설명합니다.
questionIds: [process-vs-thread, process-state-suspended, io-complete-ready-queue-delay, context-switch-overhead, context-switch-cache-counter, syscall-user-kernel, linux-vdso-clock-read, shared-memory-owner-death-recovery]
---

# 프로세스·스레드·커널 진입의 경계

## 스택이 따로 있어도 주소 공간은 공유합니다

같은 프로세스의 스레드는 각자의 레지스터·스택·실행 상태를 갖지만 힙·전역 메모리와 여러 자원을 공유합니다. 다른 스레드가 그 스택 주소에 절대 접근할 수 없다는 하드웨어 격리가 생기는 것은 아닙니다. 잘못된 포인터가 프로세스 전체를 손상시킬 수 있습니다.

프로세스는 별도 가상 주소 공간으로 장애 범위를 나누기 쉽지만 IPC·직렬화·중복 메모리·동기화 비용이 듭니다. 공용 DB·호스트 메모리·네트워크는 여전히 공유할 수 있으므로 프로세스를 나눴다고 전체 자원 고갈까지 격리되는 것은 아닙니다.

## 실행되지 않는 이유를 구분합니다

| 상태 모형 | 기다리는 것 | 대응 |
| --- | --- | --- |
| Ready | CPU 실행 기회 | run queue·우선순위·affinity |
| Blocked | I/O·락·조건 등 사건 | 해당 자원과 소유자 |
| Running | 현재 CPU 실행 | 계산·메모리 접근 비용 |
| Suspended | 실행 집합 제외 등의 교과서 상태 | 실제 OS의 stopped·sleep과 구분 |

I/O가 끝나면 바로 Running이 되는 것이 아니라 Ready가 되어 CPU 배정을 기다릴 수 있습니다. 평균 CPU가 낮아도 특정 코어 affinity나 단일 이벤트 루프에 작업이 몰리면 실행 대기가 남습니다. 프로세스 요약 대신 스레드별 상태와 체류 시간을 봅니다.

```diagram
{"title":"I/O 완료와 실제 재개 사이에도 대기가 있습니다","caption":"화살표는 상태 전이입니다. 완료가 Blocked를 끝내도 바로 CPU를 얻는 것은 아니므로 wakeup부터 실제 실행까지 별도로 측정합니다.","rows":[[{"id":"blocked","label":"Blocked · I/O 대기"}],[{"id":"ready","label":"Ready · 실행 큐 대기"}],[{"id":"running","label":"Running · 실제 재개"}]],"edges":[{"from":"blocked","to":"ready","label":"I/O 완료·깨움"},{"from":"ready","to":"running","label":"스케줄러 선택"}]}
```

## 시스템 호출은 권한 전환이지 반드시 스레드 전환은 아닙니다

파일·소켓처럼 커널 권한이 필요한 기능을 요청하면 정해진 진입점에서 커널이 인자·포인터·권한을 검증하고 처리합니다. 데이터가 이미 준비돼 있으면 같은 스레드가 커널 코드를 실행한 뒤 사용자 모드로 돌아올 수 있습니다. 준비되지 않아 블로킹하면 그때 다른 runnable 스레드로 바뀔 수 있습니다.

따라서 syscall 수와 context switch 수는 일대일이 아닙니다. stdio 버퍼링은 여러 작은 호출을 한 syscall로 묶을 수 있고, vDSO는 일부 시간 조회를 사용자 공간의 커널 제공 코드·데이터로 처리해 실제 커널 진입을 줄일 수 있습니다. 모든 시계·CPU·설정이 같은 빠른 경로를 지원하는 것은 아닙니다.

vDSO의 시간 데이터는 갱신 중인 값을 섞지 않도록 버전 재검사 등의 구현 계약을 따릅니다. 벽시계와 단조 시계의 목적을 구분하고 직접 공유 구조를 추측해 읽기보다 제공된 API를 사용합니다. syscall이 줄어도 실제 latency가 얼마나 줄었는지는 측정해야 합니다.

## 문맥 전환 증가가 항상 비효율은 아닙니다

I/O를 기다리는 스레드가 잠들고 다른 일을 실행하는 전환은 CPU를 활용하는 정상 동작입니다. 반대로 runnable 스레드가 너무 많거나 짧은 작업이 여러 실행기를 오가면 스케줄링과 캐시 비용이 커질 수 있습니다.

자발적·비자발적 전환을 나누되 그 분류만으로 원인을 확정하지 않습니다. 같은 요청률·작업 혼합에서 코어별 CPU·run queue·락·I/O 대기·cache miss와 p99를 비교합니다. 전환과 cache miss가 함께 늘어난 것은 상관관계이며, 작업 집합·코어 이동·worker 수를 하나씩 바꾸는 대조가 필요합니다.

바쁜 대기로 전환 수를 줄이면 CPU·전력·다른 작업의 기회를 소모할 수 있습니다. worker를 줄여 전환이 감소해도 처리량과 사용자 지연이 나빠지면 성공이 아닙니다.

## 프로세스 재시작은 작업 복구를 대신하지 않습니다

신뢰하기 어려운 플러그인·네이티브 변환을 worker process로 격리하면 크래시가 다른 주소 공간으로 직접 퍼지는 것을 줄일 수 있습니다. 그러나 worker가 DB를 바꾼 뒤 죽으면 재시작한 작업이 같은 효과를 또 만들 수 있습니다. 감독자는 작업 ID·기한·결과 커밋·재시도·멱등성을 관리해야 합니다.

공유 메모리를 쓰면 프로세스 분리에도 같은 데이터를 함께 수정합니다. 소유자가 죽었을 때 robust mutex 등으로 락을 다시 얻을 수 있어도 데이터는 반쯤 바뀌었을 수 있습니다.

```text
lock_result = acquire_shared_lock()
if lock_result == owner_died:
    inspect_recovery_marker_and_journal()
    restore_or_finish_invariant()
    mark_consistent_only_after_success()
else if lock_result == not_recoverable:
    stop_using_shared_state()
```

실제 API의 inconsistent·consistent·재사용 불가 상태를 따라야 합니다. 모든 프로세스가 같은 버전의 복구 규칙을 사용하고, 복구 중 다시 죽어도 반복 가능한 기록을 남깁니다. 락을 얻었다는 사실과 보호하던 상태가 정상이라는 사실은 다릅니다.

## 경계별 시간을 기록합니다

I/O 제출·완료·wakeup·실제 실행, syscall 진입·복귀, IPC 대기·처리를 나누어 기록합니다. 같은 파일을 작은 read 여러 번과 큰 read로 읽으며 호출 수·복사량·첫 바이트 지연을 비교합니다. 공유 메모리 갱신의 각 중단 지점도 시험합니다.

실제 OS의 상태 명칭·카운터·vDSO 지원은 대상 환경을 확인해야 합니다. 이 모형의 목적은 “CPU를 안 쓴다”나 “시스템 호출이 많다”라는 한 숫자를 원인과 해결책으로 성급하게 연결하지 않는 것입니다.

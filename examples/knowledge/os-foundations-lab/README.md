# CPU 스케줄링과 운영체제 상태 실습

실행 코드는 `examples/knowledge/os-foundations-lab/scheduler_lab.py`입니다.

## 학습 범위

` scheduler_lab.py`는 한 개 CPU와 유한한 작업 집합을 대상으로 FCFS, 비선점 SJF, 선점 SRTF, Round Robin, priority 스케줄링을 재생합니다. 각 작업의 도착 시각과 CPU burst를 입력으로 받아 timeline, completion, turnaround, waiting, response를 출력합니다. priority 정책에서는 선택적으로 단순 aging을 적용해 오래 기다린 작업의 유효 우선순위를 낮춥니다. tie-breaker는 도착 시각과 입력 순서로 고정해 결과를 재현합니다.

이 코드는 Linux의 CFS/EEVDF, CPU affinity, cgroup, 실시간 스케줄러, 멀티코어 migration, preemption disable, 실제 context-switch counter를 호출하거나 측정하지 않습니다. 스케줄 정책의 불변식과 교과서 계산을 검증하는 사용자 공간 모형입니다. 따라서 실제 Linux 스케줄러의 지연 보장이나 공정성 보장으로 해석하지 않습니다.

## 실행 명령

저장소 루트에서 실행합니다.

```sh
python3 examples/knowledge/os-foundations-lab/scheduler_lab.py --test
python3 examples/knowledge/os-foundations-lab/scheduler_lab.py --policy rr --quantum 2
```

외부 패키지는 없습니다. 실행 파일은 Python 표준 라이브러리만 사용합니다. 입력은 코드에 정의한 bounded fixture이며, 작업 수는 1,000개, 전체 burst 합은 100,000 tick으로 제한합니다. 실패 시 `SimulationError` 또는 argparse 오류를 반환하고, 파일·소켓·프로세스·외부 서비스 자원을 만들지 않습니다.

## 기대 출력

```text
PASS는 unittest 상세 출력의 각 테스트가 ok로 끝나는 상태를 뜻합니다.

Ran 5 tests
OK
```

기본 데모는 다음 형태의 timeline과 작업별 지표를 출력합니다.

```text
timeline: A[0-2] | B[2-4] | C[4-6] | A[6-8] | B[8-10] | A[10-14]
A completion=14 turnaround=14 waiting=6 response=0
B completion=10 turnaround=9 waiting=5 response=1
C completion=6 turnaround=4 waiting=2 response=2
```

정확한 timeline은 선택한 정책과 quantum에 따라 달라지며, 위 블록은 출력 형식을 설명하는 예입니다. 재현 가능한 기준 결과는 테스트 코드의 assertion입니다.

## 의존성 고정

운영체제 실습 코드는 Python 3.9 이상에서 표준 라이브러리만 사용하므로 별도 dependency pin이나 다운로드 단계가 없습니다. 이 실행은 로컬 상태 계산에 한정되며 network, container, database, credential, payment를 사용하지 않습니다.

## 실패 주입

- `--quantum 0`을 주면 양의 quantum 계약 위반으로 실패합니다.
- `validate_jobs`의 burst 상한 검사를 제거하거나 음수 burst를 전달하면 입력 불변식 테스트가 실패해야 합니다.
- `srtf`에서 미래 도착 작업을 반영하지 않으면 B가 시각 1에 도착한 뒤 A를 계속 실행해도 잘못된 turnaround 결과가 나옵니다.
- priority에서 aging을 모든 작업에 동일하게 적용하지 않으면 오래 기다린 작업의 선택이 달라지지 않는 실패를 관찰할 수 있습니다.
- Round Robin의 quantum 경계에서 현재 작업을 ready queue 뒤에 다시 넣지 않으면 응답성과 completion assertion이 깨집니다.

진단은 먼저 정책별 timeline을 출력하고, 각 작업에 대해 `completion - arrival`, `turnaround - burst`, `first_start - arrival`을 독립적으로 다시 계산합니다. `waiting`만 맞고 `response`가 틀리면 첫 실행 시각 기록을, `turnaround`가 틀리면 arrival 또는 completion 갱신을, timeline 합계가 burst 합과 맞지 않으면 quantum·preemption 경계를 확인합니다.

## 기본 모델과 구현 결정

교과서 정책은 같은 ready set을 다르게 선택합니다. FCFS는 arrival 순서, SJF는 알려진 burst가 짧은 순서, SRTF는 현재 남은 burst가 짧은 순서, RR은 quantum만큼 순환, priority는 우선순위가 높은 작업을 먼저 선택합니다. 실제 서비스에서는 burst를 미리 알 수 없으므로 SJF/SRTF는 추정치 정책으로만 이해해야 합니다.

상태 추적은 `remaining`, `ready`, `first_start`, `completion` 네 구조로 제한했습니다. `admit()`은 현재 시각까지 도착한 작업을 한 번만 ready queue에 넣습니다. CPU가 비면 다음 arrival까지 idle segment를 기록합니다. RR은 quantum을 소비한 작업을 ready 뒤에 넣고, SRTF는 실행 중 새 arrival이 들어올 때 다음 경계에서 재선택합니다. 모든 segment는 인접한 같은 작업을 합쳐 출력하지만, idle과 실행 구분은 보존합니다.

반환 지표의 정의는 다음과 같습니다.

- turnaround = completion - arrival
- waiting = turnaround - burst
- response = first_start - arrival

context switch 자체의 시간은 이 모형에 넣지 않았습니다. 실제 전환은 레지스터·주소 공간·캐시·run queue 상태와 연결되며, syscall과 context switch가 항상 일대일이라는 뜻도 아닙니다. 기존 `execution-boundaries`, `cpu-scheduling` 노트의 상태 구분을 먼저 읽고 이 lab의 논리 tick과 실제 나노초를 분리하십시오.

```diagram
{"title":"도착부터 지표 계산까지","caption":"이 모형은 한 CPU의 논리 tick만 재생하며, 실제 커널 스케줄러 계측과 구분합니다.","rows":[[{"id":"arrival","label":"도착 작업","detail":["arrival·burst·priority 입력"]}],[{"id":"ready","label":"Ready queue","detail":["현재 시각까지 admit","정책별 선택"]}],[{"id":"cpu","label":"CPU 실행","detail":["quantum·preemption 적용","remaining 감소"]}],[{"id":"metrics","label":"완료 지표","detail":["completion","turnaround·waiting·response"]}]],"edges":[{"from":"arrival","to":"ready","label":"arrival <= time"},{"from":"ready","to":"cpu","label":"policy choose"},{"from":"cpu","to":"metrics","label":"remaining = 0"}]}
```

## 운영체제 개념 경계

PCB(Process Control Block)는 교과서적으로 프로세스의 PID, 상태, 레지스터 저장 맥락, 주소 공간과 스케줄링 정보를 모아 둔 커널 관리 기록입니다. 스레드가 별도 stack·register·실행 상태를 가지면서 프로세스의 주소 공간과 자원을 공유한다는 점은 `execution-boundaries`의 모델과 연결됩니다. context switch는 한 실행 흐름에서 다른 실행 흐름으로 CPU 실행 상태를 바꾸는 일이고, user/kernel mode 전환이나 syscall과 동일한 사건이 아닙니다.

Ready는 CPU를 기다리는 상태, Blocked는 I/O·lock·condition 같은 사건을 기다리는 상태입니다. I/O 완료는 곧바로 Running을 뜻하지 않고 먼저 Ready로 돌아가 선택을 기다릴 수 있습니다. Suspended는 교과서의 실행 집합 제외 모델로 설명하되, 실제 Linux의 stopped/sleep 상태와 이름을 섞지 않습니다.

페이징은 가상 페이지를 물리 프레임에 연결하고 page table·TLB·권한을 사용합니다. swapping은 특히 anonymous page 같은 내용을 저장장치의 swap backing으로 내보내 RAM을 회수하는 경로를 가리키며, paging 전체와 동의어가 아닙니다. file-backed page reclaim, anonymous swap-out, page fault, TLB miss를 하나의 사건으로 세지 않습니다. cold first touch의 minor fault와 저장장치 읽기가 필요한 major fault도 분리합니다. 기존 `virtual-memory`, `address-translation`, `page-replacement` 노트의 작업 집합·reclaim·writeback 경계를 함께 사용합니다.

## 상호 배제와 진행성

임계 구역은 공유 불변식을 읽고 바꾸는 짧은 구간입니다. 상호 배제는 동시에 한 실행 흐름만 들어간다는 조건이고, progress는 임계 구역 밖에서 멈춘 작업이 다른 작업의 진입을 영원히 막지 않아야 한다는 선택 가능성의 조건입니다. bounded waiting은 어떤 작업이 진입을 요청한 뒤 무한히 추월당하지 않도록 대기 상한을 정책으로 제한하는 조건입니다. mutex가 상호 배제를 제공해도 FIFO 공정성·starvation freedom·bounded waiting을 자동으로 제공하지 않습니다.

`deadlock`, `condition-variables`, `semaphore` 노트와의 연결은 다음처럼 나눕니다. deadlock은 소유한 자원을 놓지 않은 채 순환 대기하는 진행성 실패이고, starvation은 다른 작업은 진행해도 특정 작업이 계속 밀리는 진행성 실패입니다. aging은 priority starvation을 완화할 수 있으나 포화된 높은 우선순위 작업·무한 burst·실행기 고갈을 단독으로 해결하지 않습니다. RR은 논리 ready queue에서 bounded turn-around 기회를 보여 주지만 실제 OS의 priority group·affinity·RT 정책에 대한 보장이 아닙니다.

## Linux 문서의 안정성과 버전 경계

**확인한 문서 모델**: Linux kernel 공식 문서의 `Memory Management Concepts`는 demand paging, page reclaim, anonymous allocation, swap-out, direct reclaim와 OOM의 개념을 설명합니다. CFS 설계 문서는 runnable task의 `p->se.vruntime`을 추적하고 가장 작은 virtual runtime을 선호하는 설계를 설명합니다. 이 사실은 문서가 표시한 7.3.0-rc3 문서 스냅샷에 대한 설명이며, 이 lab의 Python 정책을 Linux 구현으로 바꾸지 않습니다.

**역사/문서에 명시된 경계**: CFS 문서는 CFS가 Linux 2.6.23에 merge됐다고 설명합니다. 이는 도입점이지 현재 모든 Linux 배포판의 동일한 동작을 보증하는 cutoff가 아닙니다. nice 설계 문서는 v2.6.23의 scheduler redesign을 역사적 경계로 설명하지만, FIFO starvation freedom이나 모든 정책의 대기 상한을 보장하지 않습니다.

**미확정/구현 의존 범위**: 현재 문서 페이지는 EEVDF로의 전환 방향을 언급하지만, 이 실습에서는 배포판별 적용 버전이나 EEVDF 동작을 실행해 확인하지 않았습니다. 또한 CFS/EEVDF, sched_rt_group, cgroup CPU quota, affinity, NUMA, context-switch perf counter, swap device와 page fault counter의 정확한 운용값은 대상 kernel·configuration·architecture를 확인해야 합니다. 따라서 본 lab은 공식 기능 전체를 다루지 않으며 Linux 통합 실행을 주장하지 않습니다.

## 실행 검증 범위

이 환경에서 실행한 것은 Python 표준 라이브러리 모형의 unittest와 demo입니다. 실제 Linux kernel, `/proc`, `perf`, swap device, cgroup, scheduler trace는 macOS 환경에서 실행하지 않았고, 실행한 것으로 표시하지 않습니다. 같은 Python 명령으로 재현할 수 있으며, Linux 통합이 필요하면 Linux toolchain과 kernel/configuration을 별도 확보해 별도 결과로 기록해야 합니다.

실패 주입은 의도적으로 local state만 바꾸며 외부 자원을 고갈시키지 않습니다. 테스트는 수면 시간에 의존하지 않고 정수 timeline을 비교합니다. 파일 생성·삭제나 daemon teardown은 없고 Python 프로세스가 종료되면 모든 메모리 상태가 정리됩니다.

## 참고 자료

- Linux kernel documentation, CFS Scheduler, <https://docs.kernel.org/scheduler/sched-design-CFS.html>. 2026-09-18 확인. `p->se.vruntime`, smallest vruntime, Linux 2.6.23 merge와 EEVDF 방향을 설명하는 공식 문서.
- Linux kernel documentation, Memory Management Concepts, <https://docs.kernel.org/admin-guide/mm/concepts.html>. 2026-09-18 확인. demand paging, anonymous page, swap-out, reclaim, kswapd/direct reclaim, compaction, OOM 개념의 공식 문서.
- Linux kernel documentation, Scheduler Nice Design, <https://docs.kernel.org/scheduler/sched-nice-design.html>. 2026-09-18 확인. v2.6.23 redesign과 nice의 비례적 CPU allocation 설명. universal starvation-free 또는 maximum wait 보장 근거로 사용하지 않음.
- Linux kernel documentation, Real-Time group scheduling, <https://docs.kernel.org/scheduler/sched-rt-group.html>. 2026-09-18 확인. static priority 0-99, group period/runtime와 group starvation 사례의 공식 문서. 모든 priority 정책의 일반 법칙으로 확대하지 않음.
- 기존 노트 `cpu-scheduling`, `execution-boundaries`, `virtual-memory`, `address-translation`, `page-replacement`, `deadlock`, `condition-variables`, `semaphore`. 이 실습의 교육 순서와 용어 경계에 사용.

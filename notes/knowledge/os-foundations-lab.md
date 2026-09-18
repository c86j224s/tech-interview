---
id: os-foundations-lab
title: 운영체제 스케줄링과 실행 상태 실습
topic: 운영체제
summary: PCB·문맥 전환·Ready와 Blocked·페이징과 swapping·스케줄링 정책·임계 구역 진행성을 하나의 재현 가능한 Python 모형과 Linux 문서 경계로 연결합니다.
questionIds: []
prerequisites: [cpu-scheduling, execution-boundaries, virtual-memory, address-translation, page-replacement]
related: [deadlock, condition-variables, semaphore]
reviewedAt: '2026-09-18'
---

# 운영체제 스케줄링과 실행 상태 실습

## 학습 목표

운영체제의 기반 개념인 PCB, 문맥 전환, 프로세스 상태, 페이징, swapping, CPU 스케줄링, 임계 구역 진행성은 모두 “누가 어떤 상태를 보유하고 다음 실행 기회를 얻는가”라는 질문으로 연결됩니다. 다만 같은 단어가 교과서 모델과 실제 Linux 구현에서 서로 다른 범위를 가질 수 있으므로 먼저 작은 결정론적 모델을 계산한 뒤 실제 커널 문서가 보장하는 것과 보장하지 않는 것을 분리합니다.

이 실습의 코드는 한 개 CPU와 유한한 작업 집합만 재생합니다. FCFS, SJF, SRTF, Round Robin, priority와 aging을 비교하고, arrival timeline에서 completion·turnaround·waiting·response를 독립적으로 계산합니다. 코드가 CFS/EEVDF의 실행 순서, 실제 context-switch 비용, swap I/O, cgroup quota, 멀티코어 migration을 측정하거나 대체한다고 주장하지 않습니다.

## 기본 모델

### PCB와 실행 상태

PCB(Process Control Block)는 교과서적으로 프로세스의 식별자, 현재 상태, 저장된 레지스터 맥락, 주소 공간 정보, 스케줄링 관련 정보를 커널이 관리하는 기록입니다. 실제 구현은 커널과 버전에 따라 내부 구조·이름·저장 단위가 다르므로 “PCB라는 C 구조체 하나가 항상 존재한다”고 단정하지 않습니다. 스레드가 있으면 스레드별 레지스터·stack·실행 상태와 프로세스가 공유하는 주소 공간·파일 같은 자원을 함께 구분해야 합니다.

Ready는 실행 가능한 상태지만 CPU를 배정받지 못한 상태입니다. Running은 현재 CPU에서 명령을 실행하는 상태이고, Blocked는 I/O·lock·condition처럼 특정 사건을 기다리는 상태입니다. I/O가 끝나면 곧바로 CPU를 받는 것이 아니라 Ready로 wakeup되어 다시 선택을 기다릴 수 있습니다. Suspended는 교과서에서 실행 집합 밖으로 제외된 상태를 설명할 때 유용하지만, 실제 OS의 stopped·sleep 상태와 동의어로 취급하지 않습니다.

### 장기·중기·단기 스케줄러

교과서의 장기 스케줄러는 어떤 작업을 실행 집합에 받아들일지 정해 다중 프로그래밍 정도를 조절합니다. 단기 스케줄러는 Ready 집합에서 다음 CPU 실행 주체를 고르고, 중기 스케줄러는 실행 집합 일부를 일시 제외·복귀시켜 메모리 압박과 실행량을 조절하는 모형입니다. 예를 들어 작업 100개 중 10개만 수락하는 판단은 장기 진입 제한, 그 10개 중 지금 실행할 작업의 선택은 단기 선택, 메모리 부족으로 일부를 일시 제외하는 것은 중기 조정에 대응합니다.

현대 범용 OS가 이 이름의 독립 프로그램 세 개를 그대로 구현한다는 뜻은 아닙니다. 서비스의 admission control, 커널 CPU 정책, reclaim·swap·컨테이너 한도를 각각 관찰해야 합니다. 전통적인 전체 프로세스 swapping과 현대 anonymous page 단위 swap-out도 구별합니다.

### 문맥 전환

문맥 전환은 현재 실행 흐름의 필요한 실행 상태를 저장하고 다른 실행 흐름을 선택해 재개하는 사건입니다. 레지스터 저장·복원 외에 주소 공간 태그, run queue, 캐시 작업 집합, 코어 이동과 관련된 비용이 생길 수 있습니다. syscall은 현재 스레드가 커널 기능을 호출하는 권한 경계이고, syscall마다 다른 스레드로 바뀌는 것은 아니므로 syscall과 context switch를 일대일로 세지 않습니다. I/O가 즉시 완료되면 같은 스레드가 커널과 사용자 모드를 오갈 수 있고, 완료를 기다리면 Blocked가 되어 다른 runnable 작업이 선택될 수 있습니다.

```diagram
{"title":"실행 흐름의 상태 경계","caption":"I/O 완료와 CPU 선택은 분리된 사건입니다. 이 lab은 Ready queue 이후의 논리 선택만 재생합니다.","rows":[[{"id":"blocked","label":"Blocked","detail":["I/O·lock·condition 사건 대기"]}],[{"id":"ready","label":"Ready","detail":["wakeup 후 CPU 배정 대기"]}],[{"id":"running","label":"Running","detail":["현재 CPU 실행","burst 또는 quantum 소비"]}]],"edges":[{"from":"blocked","to":"ready","label":"사건 완료·wakeup"},{"from":"ready","to":"running","label":"scheduler 선택"}]}
```

### 페이징과 swapping

페이징은 가상 주소 공간을 페이지로 나누고 페이지 테이블을 통해 물리 프레임에 연결하는 메모리 관리 모델입니다. TLB는 최근 가상 페이지 변환을 캐시하므로 TLB miss가 나도 페이지 테이블에서 유효한 매핑을 찾으면 페이지 fault 없이 진행할 수 있습니다. 권한 위반·미준비 매핑·파일 page-in·anonymous first write는 각기 다른 fault 경로입니다.

Swapping은 paging 전체의 다른 이름이 아닙니다. 특히 anonymous page처럼 파일에 직접 다시 읽을 backing이 없는 내용을 swap backing으로 내보내 물리 RAM을 회수하는 경로를 말합니다. file-backed page reclaim과 anonymous swap-out을 같은 I/O로 세지 않으며, cold first touch의 minor fault와 저장장치에서 내용을 읽는 major fault를 구분합니다. reclaim이 작업 집합을 계속 밀어내면 fault·page-in·writeback이 계산보다 커지는 thrashing이 될 수 있습니다. “swap 사용량이 0이면 page fault가 없다”거나 “page fault 수가 곧 디스크 읽기 수”라는 추론은 성립하지 않습니다.

### 스케줄링 지표

작업 `J`의 도착 시각을 `a`, CPU burst를 `b`, 첫 실행 시각을 `s`, 완료 시각을 `c`라고 하면 다음을 계산합니다.

- completion = `c`
- turnaround = `c - a`
- waiting = `turnaround - b`
- response = `s - a`

예를 들어 A=(arrival 0, burst 8), B=(1,4), C=(2,2)에서 FCFS는 A→B→C이고 완료 시각은 8, 12, 14입니다. B의 turnaround는 11, waiting은 7, response는 7입니다. SJF는 A를 끝낸 뒤 C→B를 선택하여 C의 짧은 작업 응답을 앞당기지만, 도착 시각을 무시하면 잘못된 결론을 냅니다. SRTF는 B와 C가 도착할 때 남은 burst와 비교하여 A를 선점합니다. RR은 quantum 경계에서 현재 작업을 ready queue 뒤에 넣어 한 작업이 전체 CPU를 독점하지 않게 합니다.

| 정책 | 선택 기준 | 핵심 대가 |
| --- | --- | --- |
| FCFS | arrival 순서 | 긴 작업 뒤에 짧은 작업이 묶이는 convoy effect |
| 비선점 SJF | ready 중 burst가 짧은 작업 | burst 예측 오류와 긴 작업 starvation |
| SRTF | ready 중 remaining burst가 짧은 작업 | 선점·재선택·예측 비용 |
| Round Robin | quantum 순환 | quantum이 작으면 전환 비용, 크면 FCFS에 가까움 |
| priority | 우선순위와 tie-breaker | 낮은 우선순위 starvation, aging 필요 |

여기서 burst를 이미 안다는 가정은 교과서 계산의 편의입니다. 운영 환경에서는 과거 관측으로 추정할 뿐이며, aging이 오래 기다린 작업의 기회를 늘려도 계속 들어오는 상위 우선순위 작업, 무한 burst, 포화된 실행기까지 단독으로 해결하지 않습니다. bounded waiting은 정책·수락량·quantum·실행 시간의 상한을 함께 정해야 논할 수 있습니다.

## 구현 결정

`scheduler_lab.py`는 외부 의존성 없는 Python 3.9+ 모형입니다. `Job`은 name·arrival·burst·priority를 불변 데이터로 보유하고, `Segment`는 timeline 구간, `Metrics`는 지표를 보유합니다. 입력은 이름 중복, 음수 arrival, 0 burst, 과도한 burst, 1,000개 초과 작업을 거절합니다. 이 제한은 실행 안정성과 실패 재현을 위한 lab bound이지 실제 scheduler의 제한이 아닙니다.

시뮬레이션 루프는 `admit()`으로 현재 시각까지 도착한 작업을 한 번만 ready에 넣고, ready가 비면 idle segment를 기록합니다. `choose()`는 정책별 tie-breaker를 적용합니다. FCFS/SJF/priority는 선택한 작업이 완료될 때까지 실행하고, SRTF는 다음 arrival 경계에서 재선택하며, RR은 quantum 또는 남은 burst 중 작은 만큼 실행합니다. 매 구간 뒤 remaining을 감소시키고 완료되지 않은 작업은 ready 뒤에 추가합니다. 마지막에 네 지표를 계산하여 정책의 선택 순서와 결과를 분리합니다.

이 구현은 실제 커널의 PCB를 만들지 않고, PCB의 핵심 질문 중 “현재 상태·남은 실행량·첫 실행·완료를 어떻게 기록하는가”만 학습용으로 축소합니다. 따라서 Python의 정수 tick은 wall-clock nanosecond나 Linux scheduler clock이 아닙니다.

## 실행 절차

저장소에 반영될 때 다음 명령을 저장소 루트에서 실행합니다.

```sh
cd tech-interview
python3 examples/knowledge/os-foundations-lab/scheduler_lab.py --test
python3 examples/knowledge/os-foundations-lab/scheduler_lab.py --policy rr --quantum 2
```

테스트는 FCFS 기준 지표, arrival에 따른 SJF와 SRTF 차이, RR response·turnaround, aging 선택 차이, idle 구간과 입력 오류를 확인합니다. 2026-09-18 저장소 코드에서 5개 테스트를 통과했습니다. demo는 A·B·C의 RR timeline과 네 지표를 출력합니다.

## 실패 주입

### SRTF의 도착 경계 누락

SRTF에서 실행 중인 A의 남은 burst보다 짧은 B가 arrival했는데 다음 arrival 경계에서 재선택하지 않으면 B의 response·completion이 늦어집니다. 진단은 timeline에 A가 B arrival 뒤에도 계속 나타나는지 확인하고, `remaining`과 next arrival 비교가 실행되었는지 검사하는 순서입니다. 단순히 최종 평균 waiting만 보면 한 작업의 response 실패를 숨길 수 있으므로 작업별 값을 봅니다.

### Round Robin 재삽입 누락

quantum을 소비한 뒤 완료되지 않은 작업을 ready queue 뒤에 넣지 않으면 A가 다시 앞에서 선택되어 RR이 FCFS처럼 보입니다. quantum=2의 timeline에서 A[0-2] 뒤 B·C가 먼저 나오는지 확인합니다. 전환 수를 줄였다는 이유만으로 개선으로 판정하지 않고, response·turnaround와 전체 burst 보존을 같이 확인합니다.

### Aging의 무제한 보장 오해

aging이 priority 값을 올려도 실행 중인 비선점 작업이 끝나지 않거나 상위 priority 유입이 계속되면 특정 작업의 완료 기한을 보장할 수 없습니다. 진단은 오래 기다린 작업의 effective priority, ready 체류 시간, 상위 유입률, 작업량 상한을 함께 기록하는 방식입니다. aging을 starvation-free의 증명으로 표시하지 않습니다.

### Waiting과 response 혼동

작업이 여러 번 선점되어도 첫 시작이 빠르면 response는 낮고 waiting은 클 수 있습니다. 반대로 한 번도 실행되지 않은 작업은 response와 waiting이 같을 수 있습니다. `waiting = turnaround - burst`와 `response = first_start - arrival`을 별도 계산하고, 둘 중 하나만 맞으면 arrival·first_start·completion 갱신을 각각 확인합니다.

### 임계 구역의 상호 배제와 진행성 혼동

mutex는 동시에 한 작업만 들어가게 할 수 있지만 FIFO 공정성, starvation freedom, bounded waiting을 자동으로 보장하지 않습니다. 임계 구역 밖에서 멈춘 작업 때문에 안쪽 작업이 영원히 진입하지 못하면 progress가 깨질 수 있고, 다른 작업이 계속 추월하면 starvation입니다. 서로 가진 lock을 기다리면 deadlock이며, lock 순서를 통일하거나 대기 기한·복구 정책을 별도로 둬야 합니다. `condition-variables`의 predicate 재검사와 `semaphore`의 permit 반환 책임도 이 경계와 연결됩니다.

## Linux 실행 범위

Linux 공식 문서는 CFS 설계가 ideal multi-tasking CPU와 `p->se.vruntime`을 사용하고 가장 작은 virtual runtime을 선호한다고 설명합니다. 같은 문서는 CFS merge를 Linux 2.6.23으로 서술하고 EEVDF 방향을 언급합니다. 이 실습에서는 2.6.23을 역사적 도입점으로만 사용하며, 현재 모든 배포판의 scheduler 동작 cutoff로 사용하지 않습니다.

공식 Memory Management Concepts 문서는 demand paging, anonymous allocation, dirty page swap-out, page reclaim, `kswapd`와 direct reclaim, compaction, OOM을 개념적으로 설명합니다. 그러나 현재 문서 snapshot은 특정 대상 host kernel의 exact counter semantics나 swap configuration을 보증하지 않습니다. CFS/EEVDF 적용 버전, cgroup·affinity·NUMA·실시간 group 설정, perf scheduler counter, page fault와 storage I/O의 상관관계는 별도 Linux 환경에서 확인해야 합니다.

**Stable/현재 문서로 확인한 범위**는 공식 Linux 문서의 개념·설계 설명과 문서에 기재된 2.6.23 역사 경계입니다. **미확정 범위**는 이 macOS 환경에서 Linux kernel integration을 실행하지 않았으므로 CFS/EEVDF, context-switch 비용, PCB kernel layout, swap-in/out, page reclaim, cgroup quota를 실행했다고 말할 수 없다는 점입니다. lab의 Python 결과는 논리 정책 계산 결과이며 운영체제 기능 실행 결과가 아닙니다.

## 참고 연결

선행 노트 `cpu-scheduling`은 quantum·burst 추정·aging의 한계를, `execution-boundaries`는 Ready/Blocked와 syscall·context switch 경계를, `virtual-memory`와 `address-translation`은 TLB·page fault·페이지 권한을, `page-replacement`는 작업 집합·Clock·thrashing을 설명합니다. `deadlock`, `condition-variables`, `semaphore`는 임계 구역의 안전성·진행성과 종료·허가 반환을 확장합니다. 이 실습은 이 개념들을 하나의 Linux 통합 프레임워크로 합치지 않고, Python timeline과 공식 문서 근거의 적용 범위를 각각 유지합니다.

- 코드 목적지: `examples/knowledge/os-foundations-lab/scheduler_lab.py`
- 노트 canonical 링크: `/tech-interview/notes/os-foundations-lab/`

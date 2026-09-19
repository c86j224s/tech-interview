---
id: linux-interrupt-deferred-work
title: 인터럽트·softirq·지연 실행
topic: 시스템
tags:
  - Linux
  - hard IRQ
  - softirq
  - workqueue
  - IRQ affinity
summary: 하드 IRQ에서 즉시 처리할 일과 softirq·workqueue로 미룰 일을 실행 문맥과 sleep 가능성으로 나눕니다.
questionIds: []
prerequisites:
  - execution-boundaries
  - io-readiness
related:
  - execution-boundaries
  - iocp-foundations
reviewedAt: '2026-09-19'
---
# 인터럽트·softirq·지연 실행

인터럽트 처리를 빠르게 만든다는 말은 모든 일을 인터럽트 핸들러에서 즉시 끝낸다는 뜻이 아닙니다. 장치가 보낸 신호를 확인하고 다시 발생하지 않게 acknowledgement를 하며 최소 상태를 기록하는 일은 긴급하지만, 패킷 전체 파싱·메모리 할당·블로킹 I/O 같은 일은 실행 문맥과 시간 예산을 따져 뒤로 미루는 편이 안전합니다. Linux에서는 이 지연 경로를 하나의 “백그라운드 스레드”로 뭉뚱그릴 수 없습니다. hard IRQ, softirq, threaded workqueue는 잠들 수 있는지, 어떤 CPU에서 실행되는지, 동시 실행이 어떻게 제한되는지가 다릅니다.

이 장은 Linux 커널 문서의 workqueue와 IRQ affinity 설명을 기준으로 작성합니다. affinity 문서는 인터럽트가 실행될 수 있는 CPU 집합을 고르는 기능은 설명하지만, 이 문서만으로 모든 hard IRQ·softirq의 일반 규칙을 증명하지는 않습니다. 따라서 “모든 후속 처리가 같은 CPU에 남는다” 같은 넓은 주장은 하지 않고, affinity가 직접 바꾸는 hardware interrupt 경로와 후속 worker의 별도 선택을 분리합니다.

## Hard IRQ와 즉시 처리 경계

hard IRQ handler는 장치의 인터럽트가 들어온 직후 실행되는 상단 처리(top half)입니다. 일반적인 설계에서 handler는 원인을 확인하고 장치 인터럽트를 acknowledge하거나 mask하며, ring의 생산자 위치·패킷 도착 여부·완료 큐 같은 작은 상태를 기록한 뒤 더 긴 처리를 예약합니다. 이 구간을 길게 잡으면 같은 CPU에서 다른 인터럽트와 스케줄 가능한 작업이 밀리고, 장치 ring이 넘칠 수 있습니다.

여기서 “짧다”는 고정된 마이크로초 숫자가 아닙니다. 장치의 interrupt rate, 처리량, 다른 IRQ, 코어 수, 지연 목표에 따른 예산입니다. 수신 큐에 패킷이 64개 있다고 매번 모두 파싱하면 한 번의 IRQ가 CPU를 독점할 수 있습니다. 반대로 acknowledgement만 하고 도착 상태를 잃으면 후속 작업이 무엇을 처리해야 하는지 알 수 없으므로 최소한의 생산자·소비자 계약은 상단에서 보존해야 합니다.

hard IRQ에서 호출 가능한 함수의 정확한 목록은 대상 커널과 경로에 따라 확인해야 합니다. 이 문서의 범위에서는 일반 원칙을 “잠들 수 있는 처리를 hard IRQ에 넣지 않는다”로 좁힙니다. 잠금 획득이 무조건 금지라는 뜻도 아닙니다. IRQ 문맥에서 사용할 수 있도록 설계된 spin 계열과, 잠들 수 있는 mutex를 구분해야 하며 실제 API 계약을 읽어야 합니다.

## Softirq와 후속 처리 예약

softirq는 hard IRQ가 남긴 일을 커널의 지연 실행 문맥에서 처리하는 한 방식입니다. 네트워크 수신처럼 빠른 반복 처리가 필요하지만 sleep은 허용되지 않는 경로가 여기에 들어갈 수 있습니다. 커널 workqueue 문서에서 설명하는 `WQ_BH` callback은 softirq 문맥으로 실행되므로 sleep할 수 없습니다. 따라서 “hard IRQ에서 softirq로 넘겼으니 이제 메모리 할당과 블로킹 I/O를 해도 된다”는 추론은 틀립니다.

softirq에는 한 번에 처리할 일의 양을 제한하는 설계가 필요합니다. 예를 들어 NIC ring에서 8개만 처리하고 남은 항목이 있으면 다시 poll을 예약하거나 다른 실행 문맥으로 넘깁니다. 이때 run queue를 다음처럼 추적할 수 있습니다.

| 시점 | CPU 0의 상태 | CPU 0 외의 작업 | 의미 |
| --- | --- | --- | --- |
| t0 | hard IRQ 진입 | user task 실행 | 장치 신호 도착 |
| t1 | softirq 8개 처리 | user task 지연 | 한 번의 batch 예산 사용 |
| t2 | 남은 120개 | user task 재개 가능 | 후속 예약 또는 재진입 |
| t3 | 다음 batch | 다른 IRQ도 실행 기회 | 큐가 비워질 때까지 반복 |

예산은 한 번의 poll 또는 bottom-half 호출에서 처리할 항목 수와 재예약 경계를 정하는 계약입니다. 예산 자체가 선점이나 starvation 방지를 보장하는 것은 아닙니다. NAPI 문서도 poll 호출의 Rx 처리량과 예산을 다루며, 실제 starvation 완화는 대상 커널의 softirq backlog, ksoftirqd 전환, scheduler 지연을 별도로 측정해야 합니다. 핵심은 한 번의 deferred callback이 입력이 끝날 때까지 독점하는 정책을 피하도록 설계하고, 남은 일의 소유자와 재예약 시점을 명시하는 것입니다.

```diagram
{"title":"인터럽트에서 잠들 수 있는 worker까지","caption":"상단에서는 신호와 작은 상태만 처리하고, sleep이 필요한 단계에서 worker 문맥으로 경계를 넘깁니다.","rows":[[{"id":"irq","label":"Hard IRQ","detail":["acknowledge","ring 상태 기록"]}],[{"id":"soft","label":"Softirq","detail":["non-blocking batch","예산 제한"]}],[{"id":"worker","label":"Threaded workqueue","detail":["sleep 가능","긴 처리"]}]],"edges":[{"from":"irq","to":"soft","label":"defer 최소 작업"},{"from":"soft","to":"worker","label":"남은 작업 예약"}]}
```

## Threaded workqueue와 Sleep 가능성

일반 workqueue의 callback은 worker thread 문맥에서 실행되므로 sleep 가능한 작업을 배치할 수 있습니다. 예를 들어 페이지 할당이 잠들 수 있거나, 파일·네트워크 API가 블로킹할 수 있거나, 긴 변환을 수행해야 한다면 softirq callback이 아니라 threaded workqueue를 선택합니다. 단, workqueue를 사용한다고 callback이 전역적으로 한 번에 하나만 실행되는 것은 아닙니다. 일반 workqueue는 전역 순차 실행 계약이 아니며, queue와 `max_active`, ordered 구성, bound/unbound 정책을 실제 설정과 함께 봐야 합니다.

`WQ_BH`와 일반 workqueue를 비교하면 다음과 같습니다.

| 항목 | `WQ_BH` | 일반 threaded workqueue |
| --- | --- | --- |
| 실행 문맥 | softirq | worker thread |
| sleep | 금지 | 허용되는 callback 경로 |
| 처리 단위 | 짧은 non-blocking 작업 | 블로킹·긴 작업 가능 |
| 순서 | 해당 softirq 계약 | queue 유형·concurrency에 좌우 |
| 복구 고려 | IRQ 지연·재예약 | worker 고갈·reclaim |

메모리 회수 경로에서 작업을 예약한다면 `WQ_MEM_RECLAIM` 같은 속성이 왜 필요한지 확인해야 합니다. 커널 workqueue 문서는 reclaim이 worker를 기다리다 다시 worker가 필요한 교착을 피하기 위한 reserved capacity를 설명합니다. 이를 모든 큐가 자동으로 가진다고 말하면 안 됩니다.

callback의 수명도 별도입니다. work를 queue에 넣은 객체가 먼저 파괴되면 callback은 해제된 상태를 읽을 수 있습니다. 종료 시에는 새 예약을 막고, 이미 queue에 들어간 work의 취소·flush·완료 순서를 지켜 객체를 파괴해야 합니다. “notify를 호출했다”는 것과 “callback이 끝났다”는 것은 조건 변수에서처럼 다른 사건입니다.

## 실행 예산과 Starvation

패킷이 계속 들어오는 상황을 `softirq에서 매번 ring 전체를 비운다`는 정책으로 처리하면 user task와 다른 장치의 IRQ가 실행 기회를 잃을 수 있습니다. 처리율만 보면 좋아 보여도 p99 지연과 control-plane 응답이 악화될 수 있습니다. 예산을 64개로 제한하면 입력 backlog는 남지만, 남은 작업을 어디에 다시 넣을지와 worker concurrency를 함께 정해야 합니다.

가령 CPU 2개에 packet 1000개/초가 들어오고 한 패킷 처리가 20마이크로초라고 하겠습니다. 100개 batch는 한 번의 점유가 약 2ms이지만 1000개를 한 번에 비우면 약 20ms가 됩니다. 이 숫자는 설명용 계산이며 특정 커널의 실제 처리 시간 측정이 아닙니다. batch를 줄이면 호출·예약 오버헤드가 늘고, 늘리면 다른 작업의 최악 지연이 커집니다. 따라서 평균 packet/s가 아니라 batch별 CPU 점유, backlog, user task의 Ready 체류, 다른 IRQ의 지연을 함께 봐야 합니다.

workqueue로 넘기면 sleep과 스케줄링 기회를 얻지만 새로운 큐가 무한한 용량을 제공하지는 않습니다. callback 동시성을 과하게 키우면 CPU를 놓고 경쟁하고, 같은 장치 순서를 보장해야 하는 작업을 병렬로 실행해 데이터 순서가 깨질 수 있습니다. 큐마다 “몇 개까지 동시에”, “같은 장치의 순서가 필요한가”, “reclaim 중에도 진행해야 하는가”를 명시합니다.

## IRQ Affinity와 실행 경로

IRQ affinity bitmap/list는 특정 hardware interrupt가 실행될 수 있는 CPU 집합을 정합니다. CPU 0에만 NIC IRQ가 몰려 있다면 CPU 2와 3을 포함하도록 mask를 바꾸어 interrupt count와 상단 처리 부담을 분산할 수 있습니다. 문서가 말하는 직접 효과는 “그 인터럽트가 허용된 CPU에서 실행된다”는 것이지, 후속 worker, 메모리 페이지, 장치 queue가 자동으로 같은 NUMA 노드로 이동한다는 뜻은 아닙니다.

변경 전후에는 다음 사건을 따로 기록해야 합니다.

- `/proc/interrupts` 등 대상 환경에서 해당 IRQ count가 어느 CPU로 이동했는지
- hard IRQ 처리 시간과 softirq backlog가 줄었는지
- workqueue callback이 어느 CPU에서 실행됐는지
- packet buffer와 queue memory가 어느 NUMA 노드에 배치됐는지
- cache miss, cross-node 접근, p99가 함께 변했는지

affinity mask에는 최소 한 CPU가 남아 있어야 하며, mask만 넓힌다고 균등 분배가 자동으로 되는 것은 아닙니다. RSS queue, IRQ vector, worker binding, scheduler affinity가 별도 정책이면 각각 확인합니다. 한 CPU의 IRQ count가 줄었는데 latency가 악화됐다면 장치 queue와 데이터 locality가 분리됐거나 다른 CPU의 contention이 생겼을 수 있습니다.

## 구현 선택과 수명 관리

hard IRQ에서는 acknowledgement와 최소 상태 기록, softirq에서는 짧은 non-blocking batch, threaded workqueue에서는 잠들 수 있는 긴 처리를 둡니다. 이 선택은 “항상 workqueue가 더 좋다”는 계층이 아닙니다. 빈번한 작은 작업을 모두 worker로 옮기면 queueing·wakeup 비용이 커질 수 있고, 반대로 softirq에 긴 작업을 두면 starvation과 지연이 커집니다.

장치별로 다음 계약을 코드에 드러내는 편이 좋습니다.

1. IRQ가 확인하는 장치 상태와 acknowledge 순서
2. ring의 생산자·소비자 인덱스와 동시 접근 방식
3. batch 한도와 남은 일의 재예약 규칙
4. callback이 sleep 가능한지, 사용할 수 있는 잠금 종류
5. 장치 제거·종료 시 IRQ disable, work cancel/flush, buffer 해제 순서

재시도나 재예약이 중복되면 같은 packet을 두 번 처리할 수 있습니다. packet descriptor를 소비했다는 표시와 후속 작업이 소유한 buffer의 수명을 분리하지 말고, 한 경로만 소유권을 반납하도록 합니다. shutdown에서 IRQ를 막았다고 이미 예약된 work가 끝났다는 뜻이 아니므로 flush와 객체 파괴의 경계를 지켜야 합니다.

## 실패 진단과 측정

첫 번째 진단 오류는 “CPU 사용률이 낮으니 IRQ가 병목이 아니다”라고 말하는 것입니다. 한 CPU의 hard IRQ·softirq와 다른 CPU의 idle을 합친 평균은 단일 queue의 지연을 숨길 수 있습니다. 두 번째는 workqueue callback 수를 worker thread 수와 같다고 세는 것입니다. queue 종류와 active 제한에 따라 여러 callback이 worker를 공유하거나 병렬로 실행할 수 있습니다.

세 번째는 affinity를 바꾼 뒤 interrupt count만 보고 성공으로 판단하는 것입니다. count가 분산되어도 NUMA 원격 메모리와 queue lock contention이 p99를 늘릴 수 있습니다. 네 번째는 softirq에서 malloc이나 블로킹 I/O가 “가끔만” 성공한다는 실험을 계약으로 받아들이는 것입니다. sleep 가능 여부는 우연히 잠들지 않았다는 관찰이 아니라 문맥·API 계약으로 판단해야 합니다.

검증은 작은 입력으로 hard IRQ 발생, batch 제한, 남은 작업 재예약, shutdown 경쟁을 각각 재현합니다. 실제 Linux 런타임을 이 작성 환경에서 실행하지 않았으므로 이 문서의 수치와 run queue는 설명용 계산입니다. 대상 커널에서 tracepoint, IRQ count, workqueue latency, CPU별 ready 체류를 연결해 확인해야 합니다.

## 참고자료와 범위

- Linux kernel documentation, `core-api/workqueue.html`, 확인된 내용은 threaded callback의 sleep 가능성, `WQ_BH`의 softirq 실행 및 sleep 금지, 일반 workqueue의 전역 순서 부재, `WQ_MEM_RECLAIM`의 reclaim 용량입니다.
- Linux kernel documentation, `core-api/irq/irq-affinity.html`, 확인된 내용은 affinity bitmap/list가 인터럽트의 eligible CPU 집합을 선택한다는 점과 최소 한 CPU가 필요하다는 점입니다.
- Linux kernel documentation, `networking/napi.html`, 확인된 내용은 budget이 한 poll 호출의 Rx 처리량을 제한하고 full budget 반환이 후속 poll을 요청할 수 있다는 점입니다. budget만으로 scheduler fairness를 보장한다고 해석하지 않았습니다.
- 저장소의 `notes/operating-systems/execution-boundaries.md`, syscall·Ready·Blocked·Running을 하나의 사건으로 세지 않는 진단 틀을 사용했습니다.

affinity 문서만으로 모든 인터럽트 문맥의 세부 제약을 확정하지 않았습니다. hard IRQ에서 가능한 API, 특정 드라이버의 softirq 예약 방식, NAPI와 threaded IRQ의 구현 세부는 대상 커널 버전과 드라이버 문서를 추가로 읽어야 합니다.

### 참고 경로

- [https://docs.kernel.org/core-api/workqueue.html](https://docs.kernel.org/core-api/workqueue.html)
- [https://docs.kernel.org/core-api/irq/irq-affinity.html](https://docs.kernel.org/core-api/irq/irq-affinity.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.

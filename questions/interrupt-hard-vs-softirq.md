---
id: interrupt-hard-vs-softirq
title: >-
  인터럽트가 들어왔을 때 모든 처리를 hard IRQ handler에서 끝내지 않고 softirq로 미룹니다. 두 문맥의 실행 제약은
  무엇인가요?
difficulty: 하
category: 운영체제
tags:
  - interrupt
  - hard IRQ
  - softirq
  - deferred work
related:
  - io-complete-ready-queue-delay
---
# 인터럽트가 들어왔을 때 모든 처리를 hard IRQ handler에서 끝내지 않고 softirq로 미룹니다. 두 문맥의 실행 제약은 무엇인가요?

## 구두 답변

hard IRQ와 softirq의 차이는 단순히 “위와 아래”가 아니라 실행 문맥의 제약입니다. hard IRQ handler에서는 장치 원인 확인, acknowledge 또는 mask, ring producer 위치처럼 즉시 필요한 최소 상태만 기록하고 긴 처리를 예약합니다. sleep 가능한 mutex나 sleepable allocation을 이 문맥에 넣지 않으며, 그렇다고 모든 잠금과 모든 할당이 금지된다는 뜻은 아닙니다. IRQ 문맥에서 허용된 spin 계열과 GFP_ATOMIC 같은 비수면 경로도 실패 가능성을 처리해야 합니다. 정확한 API는 target kernel과 driver contract를 확인합니다.

softirq로 넘긴 뒤에도 일반 worker thread가 된 것은 아닙니다. `WQ_BH` callback은 softirq 문맥에서 실행되므로 sleep할 수 없고, 짧은 non-blocking batch와 후속 예약만 수행합니다. NIC ring에 100개가 있고 이번 예산이 8이면 hard IRQ가 상태를 확인한 뒤 softirq가 8개를 소비하고 나머지 92개를 후속 poll 또는 다른 경로로 남깁니다. 이 숫자는 설명용 trace이며, budget이 scheduler 선점이나 starvation 방지를 보장하는 것은 아닙니다. NAPI budget, softirq backlog, ksoftirqd 전환을 실제 커널에서 별도로 측정해야 합니다.

메모리 할당이 잠들 수 있거나 블로킹 I/O가 필요하면 threaded workqueue 같은 worker 문맥으로 상태 소유권을 넘깁니다. worker가 끝났다는 사실은 IRQ disable만으로 보장되지 않으므로 shutdown에서 새 예약 차단, work cancel/flush, buffer 해제 순서를 지킵니다. 성능 판단도 평균 CPU 사용률이 아니라 hard IRQ 시간, softirq batch 점유, worker queue latency, packet 순서와 p99를 함께 봅니다. 소스 확인 범위는 kernel hacking의 interrupt-context 원칙, genericirq의 threaded handler 구분, workqueue의 WQ_BH 계약으로 고정하겠습니다.

## 득점 포인트

- hard IRQ에는 acknowledge와 최소 상태만 남기고 sleepable 처리를 deferred context로 넘기는 이유를 설명합니다.
- WQ_BH softirq와 threaded worker의 sleep 가능성을 NIC 100개·budget 8 trace로 구분합니다.
- GFP_ATOMIC의 비수면 할당도 실패 가능하며 API별 문맥 계약을 읽어야 한다고 말합니다.

## 감점 포인트

- softirq를 일반 worker처럼 취급해 blocking I/O를 넣으면 문맥 규칙을 위반합니다.
- 모든 메모리 할당이나 모든 잠금을 금지한다고 말하면 sleepable operation과 IRQ-safe operation을 구분하지 못합니다.
- IRQ disable만으로 이미 예약된 work와 buffer의 종료가 완료된다고 하면 lifetime을 깨뜨립니다.

## 더 파고들 거리

- NAPI budget, softirq backlog, ksoftirqd 실행을 실제 커널에서 어떤 카운터로 확인할지 설계합니다.
- 같은 callback을 WQ_BH와 threaded workqueue에 둘 때 순서·동시성·shutdown을 비교합니다.

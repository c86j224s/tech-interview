---
id: interrupt-affinity-load
title: 한 CPU에 IRQ가 몰려 네트워크 지연이 튑니다. IRQ affinity를 바꾸면 어떤 실행 경로가 이동하고 무엇은 그대로 남나요?
difficulty: 중하
category: 운영체제
tags:
  - IRQ affinity
  - CPU
  - interrupt
  - locality
related:
  - numa-memory-locality
  - context-switch-cache-counter
---
# 한 CPU에 IRQ가 몰려 네트워크 지연이 튑니다. IRQ affinity를 바꾸면 어떤 실행 경로가 이동하고 무엇은 그대로 남나요?

## 구두 답변

IRQ affinity가 직접 바꾸는 것은 특정 hardware interrupt가 전달되고 실행될 수 있는 CPU 집합입니다. 예를 들어 CPU 0만 허용하던 NIC vector의 mask에 CPU 2와 3을 추가하면 그 IRQ의 상단 handler가 실행될 eligible CPU가 넓어집니다. affinity 문서가 보장하는 것은 이 집합과 최소 한 CPU가 남아야 한다는 제약이지, 후속 softirq·workqueue·RSS queue·NUMA 페이지가 자동으로 같은 CPU로 이동한다는 사실이 아닙니다.

설명용으로 변경 전 `/proc/interrupts`에서 한 vector가 1초 동안 CPU0에서 800,000회, CPU2와 CPU3에서 각각 1,000회 증가했다고 하겠습니다. 변경 후 CPU0 420,000, CPU2 190,000, CPU3 191,000이라면 1차로 IRQ count가 분산됐다고 말할 수 있습니다. 그러나 이것은 전체 경로의 성공이 아닙니다. softirq backlog, workqueue callback의 실제 CPU, packet buffer의 NUMA node, cross-node load, queue lock 대기, p99를 이어서 봐야 합니다. 이 숫자는 실행 결과가 아니라 확인할 산술 예시입니다.

mask를 넓히면 균등 분배가 자동으로 되지 않고, 장치 vector와 RSS queue 매핑이 한 CPU에 남을 수 있습니다. worker가 unbound면 scheduler가 다른 CPU에서 실행할 수 있고, scheduler affinity가 따로 고정되어 있으면 IRQ만 이동합니다. IRQ count가 줄었는데 p99가 악화되면 원격 메모리나 queue lock contention을 의심합니다. 따라서 변경 전후에 IRQ count, hard IRQ 시간, softirq 실행 CPU, worker latency, NUMA 위치를 함께 기록하고, affinity를 “전체 처리 경로 이동 버튼”이 아니라 상단 interrupt의 eligible set을 조정하는 제어점으로 설명하겠습니다.

## 득점 포인트

- affinity가 바꾸는 것은 hardware IRQ의 eligible CPU 집합이고 후속 worker·NUMA 위치는 별도라는 점을 답합니다.
- CPU0 800,000회에서 CPU0 420,000·CPU2 190,000·CPU3 191,000으로 이동한 예를 1차 검증으로 사용합니다.
- count 분산 뒤에도 softirq CPU·worker latency·queue lock·cross-node p99를 측정합니다.

## 감점 포인트

- mask만 넓히면 RSS queue와 worker가 자동으로 이동한다고 말하면 직접 효과를 과장한 것입니다.
- CPU 평균 사용률만 보면 한 vector의 집중과 per-queue latency를 숨깁니다.
- IRQ count 균등을 공정성과 낮은 p99의 보장으로 해석하면 locality 반례를 놓칩니다.

## 더 파고들 거리

- affinity 변경 후 softirq 이동을 tracepoint와 per-CPU backlog로 구분합니다.
- NUMA page와 device queue mapping이 어긋날 때 원격 접근과 lock contention을 함께 검증합니다.

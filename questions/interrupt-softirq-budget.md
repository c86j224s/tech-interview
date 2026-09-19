---
id: interrupt-softirq-budget
title: >-
  패킷이 계속 들어와 softirq가 CPU를 오래 점유합니다. deferred work에 실행 예산을 두지 않으면 어떤 starvation이
  생기며 workqueue는 무엇을 바꾸나요?
difficulty: 중하
category: 운영체제
tags:
  - softirq
  - workqueue
  - 예산
  - starvation
related:
  - batch-execution-fairness-budget
---
# 패킷이 계속 들어와 softirq가 CPU를 오래 점유합니다. deferred work에 실행 예산을 두지 않으면 어떤 starvation이 생기며 workqueue는 무엇을 바꾸나요?

## 구두 답변

이 질문에서 budget은 “이번 poll 또는 bottom-half 호출에서 처리할 최대 항목 수와 재예약 경계”입니다. budget 자체가 CPU 선점이나 starvation 방지를 보장한다고 말하면 과합니다. 다만 backlog 전체를 매번 비우는 설계는 입력이 계속되는 동안 한 CPU의 deferred 처리 시간이 길어져 user task, 다른 장치 IRQ, 제어 요청의 지연을 키울 수 있으므로, 남은 항목을 후속 poll이나 다른 worker로 넘기도록 설계할 수 있습니다. 실제 starvation 개선 여부는 softirq backlog, ksoftirqd 실행, scheduler latency를 target kernel에서 측정합니다.

설명용으로 패킷 하나가 20μs이고 100개가 backlog라고 하겠습니다. 한 호출에서 100개를 처리하면 계산상 약 2ms를 점유합니다. 1000개를 한 번에 처리하면 약 20ms입니다. 반대로 budget 8이면 호출당 약 160μs이지만 13회에 가까운 후속 호출과 예약 비용이 생깁니다. 이 값은 측정 결과가 아닌 산술 trace입니다. batch를 줄이면 다른 작업이 끼어들 기회와 호출 오버헤드가 함께 바뀌고, 키우면 처리량과 최악 지연이 함께 바뀝니다.

workqueue로 넘기면 worker 문맥에서 sleep 가능한 작업과 scheduler runnable 단위를 얻을 수 있지만, workqueue 하나가 전용 thread 하나이거나 전역 순서라는 뜻은 아닙니다. `max_active`, bound/unbound, ordered 여부, 같은 장치의 sequence 요구를 확인해야 합니다. reclaim 경로에서 worker 고갈과 교착 가능성이 있으면 `WQ_MEM_RECLAIM`의 reserved capacity를 검토합니다. 판단 기준은 IRQ count가 아니라 backlog 감소, user task Ready 체류, 다른 IRQ 지연, worker active 수, p99입니다. workqueue가 “기회를 보존하도록 시도”하는 설계인지와 실제 starvation이 줄었는지는 분리해서 말하겠습니다.

## 득점 포인트

- budget을 poll 호출의 처리량·재예약 경계로 정의하고 선점 보장과 구분합니다.
- 20μs 패킷 100개는 2ms, 1000개는 20ms라는 계산과 budget 8의 약 160μs 호출을 비교합니다.
- workqueue가 sleep과 runnable 단위를 제공하지만 scheduler fairness·전역 순서를 자동 보장하지 않는다고 설명합니다.

## 감점 포인트

- budget 하나가 starvation을 반드시 해결한다고 단정하면 softirq backlog와 ksoftirqd 경로를 검증하지 않은 것입니다.
- workqueue 하나를 전용 thread 하나나 전역 순차 큐로 가정하면 `max_active`와 ordered 정책을 놓칩니다.
- IRQ count만 줄어든 것을 latency 개선으로 해석하면 backlog·Ready 지연·p99를 빠뜨립니다.

## 더 파고들 거리

- batch 크기별 처리시간·예약 오버헤드·user Ready 지연을 함께 기록해 전환점을 찾습니다.
- softirq backlog와 worker active 증가를 CPU 포화와 순서 경합으로 나눠 계측합니다.

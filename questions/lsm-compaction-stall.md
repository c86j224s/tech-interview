---
id: lsm-compaction-stall
title: LSM compaction이 생산 속도를 따라가지 못할 때 write stall과 backpressure를 어떤 지표로 판단하나요?
difficulty: 중하
category: 인프라
tags:
  - LSM
  - compaction
  - backpressure
  - stall
related:
  - bounded-queue-backpressure
---
# LSM compaction이 생산 속도를 따라가지 못할 때 write stall과 backpressure를 어떤 지표로 판단하나요?

## 구두 답변

pending compaction bytes, flush backlog, immutable 수, L0 파일 수를 시간축으로 보고, foreground write delay와 실제 stall 이벤트를 함께 확인하겠습니다. 다만 이 지표들이 모든 LSM에서 같은 이름과 의미를 갖는다고 말하지 않고, 선택한 release의 statistics/write-stall 문서로 semantics를 고정합니다. 먼저 backlog가 증가하는지, 정체하는지, 감소하는지를 분리해야 합니다.

설명 모델에서 입력이 200MB/s이고 compaction이 120MB/s라면 독립적인 처리율이라고 가정할 때 debt 증가율은 `200-120=80MB/s`입니다. 10초면 800MB가 쌓입니다. compaction이 220MB/s로 회복되는 구간이 있어야 backlog가 줄어듭니다. 실제로는 foreground와 background가 같은 장치를 공유하므로 120MB/s를 고정 용량으로 간주하면 안 됩니다. storage queue latency, CPU utilization, disk free와 함께 측정해야 합니다.

처방은 원인에 따라 다릅니다. memtable을 키우면 stall까지의 시간을 늘릴 뿐 pending bytes와 space peak를 해결하지 못할 수 있습니다. worker를 늘리면 backlog는 줄어도 CPU·I/O 경합으로 write p99가 악화될 수 있습니다. 입력률 제한은 foreground delay를 낮추는 대신 logical throughput을 희생합니다. 각 조치 전후에 backlog 회복률, stall duration, write p50/p99, disk free, compaction CPU를 같은 window로 비교해 admission 결정을 내리겠습니다. 평균 latency 하나로 “정상”이라 하지 않습니다.

## 득점 포인트

- backlog 증가와 foreground delay/stall을 time series로 연결하되 metric semantics는 release별로 확인합니다.
- 200-120=80MB/s와 10초 800MB를 설명용 산술로 구분합니다.
- memtable 확대, worker 증가, input throttling의 서로 다른 비용을 비교합니다.

## 감점 포인트

- memtable을 키우면 compaction 부족이 해결된다고 합니다.
- write latency 평균 하나로 stall을 판단합니다.
- 장치 경합과 disk headroom을 보지 않고 worker 수만 늘립니다.

## 더 파고들 거리

- backlog가 줄어도 가장 오래된 compaction age가 증가한다면 어떤 위험이 남을까요?
- disk 여유가 high-water mark에 가까울 때 throttle과 compaction 우선순위를 어떻게 바꿀까요?

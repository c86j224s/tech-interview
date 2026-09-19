---
id: lsm-tiered-burst-tradeoff
title: 쓰기 폭주 workload에서 tiered compaction이 leveled보다 유리할 수 있는 조건과 읽기 비용을 말해 보세요.
difficulty: 중하
category: 데이터베이스
tags:
  - LSM
  - tiered-compaction
  - write-amplification
related:
  - database-log-lock-pressure-priority
---
# 쓰기 폭주 workload에서 tiered compaction이 leveled보다 유리할 수 있는 조건과 읽기 비용을 말해 보세요.

## 구두 답변

tiered compaction은 비슷한 크기의 sorted run을 당장 큰 level에 반복 rewrite하지 않고 쌓아 두었다가 조건이 맞는 시점에 묶습니다. 그래서 ingestion이 폭주하고 누적 중 point read가 적다면 foreground write가 compaction에 빼앗기는 시간이 줄 수 있습니다. 대신 run이 쌓이는 동안 같은 key range가 여러 파일에 존재하고, point lookup 후보·임시 output·disk space peak가 커집니다. “tiered가 항상 WA가 낮다”가 아니라 쓰기 burst와 읽기 지연 중 어느 목표가 먼저인지의 문제입니다.

100MB 입력을 10MB run 열 개로 나누는 설명 trace를 보겠습니다. leveled는 일부 run을 다음 level과 조정해 overlap을 빠르게 낮출 수 있지만 그 과정에서 이미 기록한 bytes를 반복해서 읽고 씁니다. tiered는 10개를 보유하다 한 번에 100MB merge를 하므로 그 전까지 write path가 가벼울 수 있지만, k lookup은 여러 run의 filter와 index를 확인할 수 있습니다. 동일한 key update가 많으면 각 run의 최신 sequence와 tombstone도 merge해야 합니다.

따라서 비교 시 read/write 비율, append/update/delete, cold p99, run 수, temporary headroom, compaction peak를 고정합니다. 95% append에 조회가 거의 없고 disk 여유가 충분하면 tiered가 후보가 될 수 있지만, 조회가 갑자기 늘어나는 순간 누적 run을 읽는 tail을 별도로 측정합니다. tombstone drop은 run 개수만으로 결정하지 않고 엔진의 file-range·snapshot contract를 확인합니다. 이 질문은 run 누적 상태 trace에 집중하고, universal-vs-leveled 질문은 동일 workload 실험 설계에 집중합니다.

## 득점 포인트

- run 누적이 즉시 rewrite를 줄이는 경로와 overlap 증가를 함께 설명합니다.
- 10MB run 10개의 보유·일괄 merge 상태를 leveled와 대비합니다.
- write throughput뿐 아니라 cold lookup, 공간 peak, temporary headroom을 비교합니다.

## 감점 포인트

- tiered가 모든 workload에서 write amplification과 latency가 낮다고 단정합니다.
- 겹치는 run과 point lookup 후보 증가를 설명하지 않습니다.
- tombstone과 disk headroom을 무시하고 평균 쓰기 처리량만 선택 기준으로 씁니다.

## 더 파고들 거리

- run이 많은 상태에서 tombstone을 안전하게 줄이려면 어떤 serving-range 조건이 필요한가요?
- 조회가 폭증하는 순간 backlog와 cold cache를 어떤 단계별 부하로 재현할까요?

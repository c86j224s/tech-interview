---
id: lsm-universal-vs-leveled
title: >-
  point lookup과 순차 쓰기가 모두 있는 LSM에서 universal과 leveled compaction을 비교할 때 어떤
  workload를 고정해야 하나요?
difficulty: 중하
category: 성능
tags:
  - LSM
  - universal-compaction
  - leveled-compaction
related:
  - database-hash-bucket-skew
  - external-merge-fanin-buffer-budget
---
# point lookup과 순차 쓰기가 모두 있는 LSM에서 universal과 leveled compaction을 비교할 때 어떤 workload를 고정해야 하나요?

## 구두 답변

정책 이름을 먼저 고르지 않고 동일 dataset과 seed를 만든 뒤 key popularity, sequential/random write 비율, read/write 비율, value 크기, update/delete율, 동시 writer, cache cold/warm, codec, disk headroom을 고정하겠습니다. point lookup이 많은 실험에서는 overlap과 cold p99가 핵심이고, 순차 쓰기가 많은 실험에서는 physical write bytes, compaction CPU, foreground stall이 핵심입니다. 90% append·10% read와 50% read·50% write는 같은 정책 순위를 만들지 않을 수 있습니다.

측정표에는 logical input bytes, WAL·flush·compaction physical bytes, lookup당 file/block read 수, cache miss, compaction CPU, 공간 high-water mark, write p50/p99, stall duration을 넣습니다. leveled는 L1 이상 overlap을 낮추는 대신 rewrite가 커질 수 있고, universal은 run을 묶어 rewrite를 줄이는 대신 누적 run과 read/space amplification을 키울 수 있습니다. 따라서 “A가 빠르다” 대신 append-heavy에서는 어느 비용을 줄였고, read-heavy에서는 어떤 tail을 희생했는지를 조건으로 기록합니다.

장애와 회복도 protocol에 넣습니다. 동일한 compaction 단계에서 강제 종료하고 restart time, orphan output, serving file set을 비교해야 합니다. warm cache 평균만 측정하면 첫 조회의 disk read와 compaction burst를 숨깁니다. 이 질문은 비교 실험 설계가 중심이고, tiered-burst 질문의 10MB run 상태를 반복하지 않습니다. RocksDB moving wiki는 trade-off의 출발점일 뿐 exact release default와 threshold의 근거로 사용하지 않겠습니다.

## 득점 포인트

- key 분포부터 cache 상태와 disk headroom까지 비교 변수를 고정합니다.
- append-heavy와 read-heavy에서 서로 다른 1차 지표를 설정합니다.
- amplification, p99, 공간 peak, stall, restart protocol을 같은 dataset으로 비교합니다.

## 감점 포인트

- universal 또는 leveled가 항상 우월하다고 정책 이름만 보고 결론 냅니다.
- warm-cache 평균 TPS 하나로 cold lookup과 burst를 대표합니다.
- moving wiki의 설명을 특정 release 기본값이나 threshold로 단정합니다.

## 더 파고들 거리

- value 크기와 update율만 바꿨을 때 physical rewrite와 read amplification 해석이 어떻게 달라질까요?
- compaction 중 장애 복구 시간이 운영 정책 선택의 비용인 이유는 무엇인가요?

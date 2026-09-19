---
id: lsm-compaction-strategy
title: Leveled·tiered compaction 선택
topic: 데이터베이스
summary: >-
  leveled와 tiered/universal compaction의 파일 겹침, 쓰기·읽기·공간 증폭과 지연 변동을 workload 조건으로
  선택합니다.
questionIds: []
prerequisites:
  - data-system-foundations
related:
  - query-plan-evidence
  - external-sort
reviewedAt: '2026-09-19'
---
# Leveled·tiered compaction 선택

compaction 정책은 파일을 막연히 “정리”하는 기능이 아니라, 어떤 run을 어느 시점에 합치고 결과를 어느 범위로 나눌지 정하는 admission 정책입니다. leveled 계열은 L1 이상에서 key-range overlap을 제한해 point lookup 후보를 줄이는 대신 기존 바이트를 여러 번 rewrite할 수 있습니다. tiered 또는 universal 계열은 비슷한 크기의 run을 쌓아 한 번에 합치므로 폭주 쓰기의 즉시 rewrite를 줄일 수 있지만 누적 중 파일 수, overlap, 공간 peak가 커질 수 있습니다. 정책 이름만 비교하지 않고 동일한 workload와 disk headroom을 고정해야 합니다.

## 범위 모델

파일 내부가 key 정렬이라는 사실과 파일 사이 범위가 겹치지 않는다는 사실은 다릅니다. `[a,m]`, `[n,z]`는 서로 disjoint이므로 point lookup이 한 파일로 좁혀질 수 있지만 `[a,t]`, `[h,z]`가 겹치면 같은 key의 후보가 둘입니다. LevelDB implementation notes는 level-0 파일은 overlap할 수 있고, level 1 이상은 distinct non-overlapping ranges를 갖는다고 설명합니다. 이는 한 구현의 구조 설명이므로 모든 LSM의 보장으로 확대하지 않습니다.

## Leveled 병합

선택된 상위 파일 범위가 `[40,60]`이고 다음 level의 `[30,50]`, `[51,70]`와 교차하면 compaction 입력에는 세 범위가 들어갑니다. 정렬 merge는 sequence가 최신인 항목을 남기고 output을 여러 SSTable로 나눕니다. output이 target level의 범위 규칙을 지키면 다음 point lookup은 범위로 후보를 예측할 수 있습니다. 그러나 `[30,50]` 전체를 다시 읽고 쓰는 비용이 발생하며, level size ratio와 output splitting 규칙에 따라 rewrite량이 달라집니다.

```diagram
{"title":"Leveled 범위 병합","caption":"선택 범위와 겹치는 target 파일을 함께 읽고 비겹침 output으로 게시하는 개념입니다.","rows":[[{"id":"pick","label":"선택 파일","detail":["L1 [40,60]"]}],[{"id":"a","label":"Target A","detail":["L2 [30,50]"]},{"id":"b","label":"Target B","detail":["L2 [51,70]"]}],[{"id":"merge","label":"정렬 merge","detail":["sequence·delete 정리"]}],[{"id":"out","label":"분할 output","detail":["범위 overlap 제한"]}]],"edges":[{"from":"pick","to":"a","label":"range 교차"},{"from":"pick","to":"b","label":"range 교차"},{"from":"a","to":"merge","label":"input"},{"from":"b","to":"merge","label":"input"},{"from":"merge","to":"out","label":"publish"}]}
```

## Tiered 누적

tiered 사고방식에서는 10MiB 안팎의 run을 여러 개 보유하다 size ratio나 picker 조건이 맞을 때 묶습니다. 100MiB logical input을 10MiB run 열 개로 만든다면 leveled는 일부 run을 빠르게 다음 level과 조정할 수 있고, tiered는 열 개를 잠시 유지한 뒤 큰 merge를 수행할 수 있습니다. 전자는 lookup 후보를 일찍 줄이는 대신 반복 rewrite를 부담하고, 후자는 write path의 즉시 부담을 줄이는 대신 누적 중 candidate file과 temporary output이 커집니다. 정확한 선택 조건은 엔진별 picker와 옵션을 확인해야 합니다.

## 증폭과 지연

compaction debt를 설명하는 작은 모델로 입력 200MB/s, compaction output 120MB/s를 놓으면 다른 비용을 무시한 backlog 증가율은 `200-120=80MB/s`입니다. 10초 동안 800MB가 쌓이고 compaction 처리율이 입력률보다 커지는 구간이 없으면 backlog는 회복되지 않습니다. 그러나 실제 device bandwidth를 foreground와 background가 공유하면 120MB/s를 독립 처리율로 볼 수 없습니다. 이 숫자는 설명용 계산이며 장치 성능 측정값이 아닙니다.

확인한 RocksDB Compaction wiki는 style에 따른 read/write/space amplification trade-off와 delay/stall 가능성을 설명하지만, 그 페이지만으로 pending bytes의 exact semantics나 write-stall threshold를 확정할 수는 없습니다. 운영에서는 backlog의 증가·정체·감소를 time series로 보고, 실제 foreground write delay와 함께 상관관계를 검증해야 합니다. “metric 이름이 증가했다”만으로 인과를 단정하지 않습니다.

## Tombstone 공간

overlapping run이 남아 있으면 tombstone은 더 오래된 value를 가리는 동안 필요할 수 있습니다. LevelDB notes는 higher-numbered level에 key range를 덮는 파일이 없을 때 deletion marker를 drop할 수 있다고 설명합니다. 이는 file-range 조건입니다. snapshot, replica, backup이 tombstone 수명에 미치는 효과는 제품의 MVCC와 retention contract를 추가로 읽어야 하며, RocksDB wiki 확인 범위에서는 일반 규칙으로 확정하지 않았습니다.

## Stall 관찰

입력률과 compaction output의 차이는 backlog 가설을 만드는 데 유용하지만, admission delay, immutable 수, level-0 파일 수, disk free, compaction age, foreground p99를 함께 봐야 합니다. memtable을 크게 하면 더 많은 pending bytes를 숨긴 채 stall을 늦출 수 있습니다. worker를 늘리면 backlog는 줄어도 CPU와 disk queue가 foreground를 압박할 수 있습니다. 따라서 조치 뒤에 backlog 회복률과 p99가 동시에 좋아졌는지 확인합니다.

## 비교 설계

leveled와 universal을 비교할 때 dataset, seed, key popularity, sequential/random 비율, value 크기, update/delete 비율, read/write 비율, 동시 writer, cache cold/warm, codec, disk free, 장애·재시작 절차를 고정합니다. 동일 logical bytes를 넣고 physical write bytes, read file/block count, compaction CPU, space high-water mark, foreground p50/p99, stall duration, restart recovery time을 기록합니다. tiered 질문은 run 누적 trace에, universal-vs-leveled 질문은 비교 protocol과 조건부 선택에 초점을 둬 서로의 결론을 반복하지 않습니다.

## 결정 기준

cold point lookup p99와 read amplification이 최우선이면 overlap 제한을 강하게 두는 leveled의 비용을 감수할 수 있습니다. append 비중이 높고 쓰기 burst를 흡수해야 하며 충분한 disk headroom이 있으면 tiered/universal을 검토할 수 있지만, 조회가 재개될 때의 run 수와 merge pause를 부하에 넣어야 합니다. 평균 TPS 하나로 결론을 내리지 않고, 목표 지연·공간 상한·recovery budget을 모두 만족하는 후보만 남깁니다.

## 참고 자료

- LevelDB implementation notes, https://raw.githubusercontent.com/google/leveldb/main/doc/impl.md, 2026-09-19 읽음. level range, L0 overlap, compaction input/output, marker drop 조건을 직접 확인했습니다.
- RocksDB Compaction wiki, https://github.com/facebook/rocksdb/wiki/Compaction, 2026-09-19 읽음. moving wiki라 exact release default와 stall metric threshold는 확정하지 않았습니다.
- RocksDB Universal Compaction wiki, https://github.com/facebook/rocksdb/wiki/Universal-Compaction, 2026-09-19 접근 출발점으로 기록했습니다. 이 batch에서 raw 본문을 재확보하지 못해 release별 picker 규칙의 근거로 사용하지 않았습니다.

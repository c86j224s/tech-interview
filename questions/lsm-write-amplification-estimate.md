---
id: lsm-write-amplification-estimate
title: 하루에 같은 key를 반복 갱신하는 LSM workload에서 write amplification을 어떤 바이트 단위로 측정하겠습니까?
difficulty: 중하
category: 성능
tags:
  - LSM
  - write-amplification
  - compaction
  - I/O
related:
  - group-commit-checkpoint-tradeoff
---
# 하루에 같은 key를 반복 갱신하는 LSM workload에서 write amplification을 어떤 바이트 단위로 측정하겠습니까?

## 구두 답변

먼저 분모를 logical payload bytes인지, encoded logical record bytes인지 고정하고, WAL·flush output·compaction output·장치 write bytes를 분리한 counter로 수집하겠습니다. 설명 모델에서 logical payload가 1GB이고 WAL 1GB, flush output 1GB, compaction output 3GB라면 WAL 포함 합계는 `1+1+3=5GB`, logical 대비 5배입니다. WAL을 storage write amplification에서 제외하는 정의라면 `(1+3)/1=4배`입니다. 두 값 중 하나가 절대적으로 맞는 것이 아니라 대시보드의 포함 범위를 명시해야 합니다.

같은 key를 하루에 반복 갱신하면 매 update가 log와 memtable에 들어가고, flush 때 중간 version이 SSTable에 쓰이며, compaction이 뒤늦게 가려진 version을 읽고 새 output에 다시 씁니다. 따라서 logical update bytes가 작아도 physical rewrite는 커질 수 있습니다. flush와 compaction의 값은 압축 전 logical output인지, 압축 후 파일 bytes인지, filesystem/device가 실제 쓴 bytes인지 구분해야 합니다. device counter에는 metadata와 writeback이 섞일 수 있으므로 system 간 5배를 그대로 비교하지 않습니다.

평균 하루 WA만 보지 않고 1분 window와 1시간 window를 모두 계산합니다. 동일한 5GB가 고르게 기록되면 foreground p99가 낮을 수 있지만, compaction output 3GB가 짧은 구간에 몰리면 disk queue와 write stall이 급증할 수 있습니다. 각 window에 logical throughput, WAL bytes, flush bytes, compaction input/output, device bytes, pending backlog, disk free, foreground delay를 저장하고 compression·cache·key distribution을 고정해 비교하겠습니다.

## 득점 포인트

- logical payload와 각 stage의 bytes를 분자·분모로 명시합니다.
- 1GB 예에서 WAL 포함 5배와 WAL 제외 4배를 재현합니다.
- 압축 전 logical bytes, 파일 bytes, 장치 write bytes를 별도 metric으로 둡니다.

## 감점 포인트

- 사용자 payload만 physical write로 간주합니다.
- WAL 포함 여부를 숨긴 채 다른 엔진의 WA와 비교합니다.
- 평균 WA가 낮으면 compaction burst와 p99 stall도 안전하다고 단정합니다.

## 더 파고들 거리

- compaction input bytes와 output bytes를 둘 다 저장해야 하는 이유는 무엇인가요?
- 같은 평균 WA인데 burst 모양이 다른 두 시간 window를 운영 판단에 어떻게 반영할까요?

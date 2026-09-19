---
id: parquet-page-vs-rowgroup
title: >-
  Parquet row group과 page의 크기를 너무 작게 또는 크게 잡았을 때 scan과 predicate pushdown 비용이
  어떻게 달라지나요?
difficulty: 중하
category: 성능
tags:
  - Parquet
  - row group
  - page
  - scan
related:
  - external-merge-fanin-buffer-budget
---
# Parquet row group과 page의 크기를 너무 작게 또는 크게 잡았을 때 scan과 predicate pushdown 비용이 어떻게 달라지나요?

## 구두 답변

row group은 여러 column chunk를 묶는 큰 작업·통계 경계이고, page는 한 column chunk 안의 encoding·압축·읽기 세분화 단위입니다. row group을 작게 하면 날짜나 tenant가 한 group에 모여 min/max skip과 worker 분할이 쉬워질 수 있지만 footer metadata, 파일 open, task scheduling 수가 늘어납니다. 너무 크게 만들면 순차 throughput과 compression context에는 유리해도 조건이 일부만 맞을 때 큰 column chunk가 후보로 남습니다.

page도 같은 방식으로 균형을 잡습니다. 작은 page는 page header/index와 range 요청, decompression 호출이 늘고, 큰 page는 한 page의 min/max 범위가 넓어져 필요한 몇 행을 위해 더 많은 compressed bytes를 읽을 수 있습니다. 예를 들어 1억 행을 4 group으로 두어 날짜 조건이 1 group만 남겼는데 그 안의 100 page가 섞여 있으면 100 page가 후보입니다. page index로 3개만 남으면 read 범위가 3/100 수준으로 줄 여지가 있지만 실제 절감은 codec·reader 지원으로 검증해야 합니다. page와 row group을 partition과 같은 논리 단위로 부르지 않고, 실제 bytes·decode rows·task 시간을 함께 봅니다.

선택은 파일 크기와 질의의 선택도에 맞춥니다. 시간 범위 질의가 대부분이라면 시간순 row group이 min/max를 좁혀 주지만, tenant와 시간이 함께 무작위라면 한 축을 정렬한 이득이 다른 질의를 악화시킬 수 있습니다. page를 줄여도 reader가 page index를 사용하지 않으면 header와 decompression 호출만 늘어날 수 있으므로, writer 설정을 바꾼 뒤 실제 range bytes와 CPU를 같은 데이터셋에서 비교해야 합니다.

## 득점 포인트

- row group의 병렬·통계 역할과 page의 encoding·압축 역할을 분리합니다.
- 4 group → 1 group → 100 page → 3 page 후보라는 중간 상태를 추적합니다.
- 작은 단위의 metadata/request 비용과 큰 단위의 skip·decode 비용을 함께 비교합니다.

## 감점 포인트

- 작게 만들수록 pushdown과 throughput이 항상 좋아진다고 말합니다.
- page와 row group을 동일한 partition 계층으로 설명합니다.
- page index가 있으면 모든 reader에서 100 page가 3 page로 줄어든다고 확정합니다.

## 더 파고들 거리

- row group을 키워 compression을 얻었지만 tenant 조건이 나빠지는 경우의 비교 실험을 설계해 보세요.
- 많은 작은 파일과 하나의 파일 안 많은 작은 row group에서 open·footer·scheduling 비용을 분리해 보세요.

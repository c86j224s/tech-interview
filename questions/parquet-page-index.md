---
id: parquet-page-index
title: row group 통계만으로 충분하지 않은 경우 Parquet page index가 줄일 수 있는 읽기는 무엇인가요?
difficulty: 중하
category: 데이터베이스
tags:
  - Parquet
  - page index
  - predicate pushdown
  - metadata
related:
  - db-partition-pruning
---
# row group 통계만으로 충분하지 않은 경우 Parquet page index가 줄일 수 있는 읽기는 무엇인가요?

## 구두 답변

row group 통계는 group 전체의 min/max만 제공하므로 group 안에 값이 넓게 섞이면 group 자체를 제거하지 못합니다. page index가 page별 통계와 offset 정보를 제공하고 reader가 그 구조를 사용하면 row group은 후보로 둔 채 predicate와 겹치지 않는 page의 read와 decode를 줄일 수 있습니다. 즉 page index는 row group을 3개로 쪼개는 기능이 아니라, 남은 column chunk 안에서 물리 offset 범위를 더 세밀하게 고르는 기능입니다.

한 group에 100 page가 있고 date 조건과 겹치는 page가 3개라고 하겠습니다. row group min/max만 있으면 100 page가 후보라 전체 chunk를 읽은 뒤 filter할 수 있습니다. index-aware reader가 3개 page의 offset만 range read하면 compressed bytes와 decode rows가 줄어들 가능성이 있습니다. 그러나 writer가 index를 생성하지 않았거나 connector가 무시하거나, null·collation·timestamp 비교가 안전하지 않으면 page skip은 보수적으로 포기됩니다. 그래서 파일에 metadata가 있다는 사실이 효과의 증거가 아니며 page read count, range bytes, decoded/filter rows, footer/index 크기를 전후 비교합니다.

예를 들어 page 1~100의 날짜가 무작위로 섞여 각 page 범위가 `[1,12]`라면 query `[10,11]`은 모든 page와 겹쳐 index가 있어도 pruning이 거의 없습니다. 반대로 page가 시간순으로 정렬되어 10, 11을 포함하는 3개만 `[10,11]`을 덮으면 offset index가 유효합니다. 이때 footer를 읽는 비용, 세 번의 remote range request, 세 page의 decode 비용을 합쳐 index metadata가 절약한 bytes와 비교해야 합니다.

## 득점 포인트

- group 전체 범위와 page별 범위의 해상도를 구분합니다.
- 100 page 중 3개 후보가 되는 read trace를 제시합니다.
- metadata 존재, writer 생성, reader 활용, 비교 안전성을 각각 조건으로 둡니다.

## 감점 포인트

- page index가 있으면 row group 자체가 3 page로 저장된다고 말합니다.
- 모든 connector가 자동으로 index를 사용한다고 가정합니다.
- page min/max가 넓거나 안전하지 않아도 skip해 결과를 바꿀 수 있다고 주장합니다.

## 더 파고들 거리

- 값이 page마다 랜덤하게 섞일 때 min/max가 왜 전체 범위를 넓게 덮는지 작은 배열로 계산해 보세요.
- footer/index metadata와 원격 range 요청 절감 사이의 손익분기점을 어떤 측정으로 정할지 설계해 보세요.

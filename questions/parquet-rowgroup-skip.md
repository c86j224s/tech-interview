---
id: parquet-rowgroup-skip
title: Parquet에서 WHERE date BETWEEN 조건이 row group을 건너뛸 수 있는 전제와 건너뛰지 못하는 경우를 설명해 보세요.
difficulty: 하
category: 데이터베이스
tags:
  - Parquet
  - row group
  - predicate pushdown
  - statistics
related:
  - db-partition-pruning
---
# Parquet에서 WHERE date BETWEEN 조건이 row group을 건너뛸 수 있는 전제와 건너뛰지 못하는 경우를 설명해 보세요.

## 구두 답변

Parquet reader가 row group의 date min/max를 predicate와 같은 의미로 안전하게 비교할 수 있고, 통계가 보존되어 있으며, connector가 조건을 reader까지 전달할 때만 겹치지 않는 group을 건너뛸 수 있습니다. 예를 들어 네 group 범위가 `[1,3]`, `[4,6]`, `[7,9]`, `[10,12]`이고 조건이 `[10,11]`이면 앞의 세 범위는 교집합이 없어 네 번째만 후보입니다. 이것은 DB partition pruning이 아니라 file footer metadata를 이용한 보수적 skip입니다.

통계가 없거나 truncate되어 안전하지 않으면 reader는 결과를 바꾸지 않기 위해 group을 읽고 필터합니다. `[1,12]`처럼 넓은 범위는 네 group 모두 후보이고, null·NaN·timezone 변환·문자열 비교가 physical type과 어긋나도 pruning이 제한될 수 있습니다. 진단은 “WHERE가 있다”거나 plan에 pushdown 문구가 있다는 사실로 끝내지 않고 예상 후보 1개와 실제 row group·column chunk·bytes read를 비교합니다. 실제로 4개를 읽었다면 통계 부재, 표현 변환, connector 미지원, 파일 배치를 순서대로 확인하고, 1개만 읽었는데 느리면 remote I/O·decompression·materialization을 분리합니다.

중요한 것은 skip이 결과를 바꾸지 않는 보수적 최적화라는 점입니다. row group의 min/max가 `[10,12]`라도 null 행의 처리와 timestamp timezone 변환이 predicate와 같은 의미인지 확인해야 합니다. 예측 후보가 한 개라는 계산은 footer 통계를 읽은 뒤의 논리 결과이고, 실제 reader가 네 group을 열었다면 connector가 필터를 전달하지 않았거나 통계를 사용하지 않은 것입니다. 두 경우 모두 결과 correctness는 유지하되 성능 기대만 낮춰야 합니다.

## 득점 포인트

- min/max 교집합이 없는 세 group과 후보 group 하나를 숫자로 보여 줍니다.
- metadata 안전성, null/truncate, physical type, reader 전달을 함께 전제합니다.
- Parquet file skip과 DB partition pruning을 다른 계층으로 설명합니다.

## 감점 포인트

- WHERE가 있으면 모든 engine이 자동으로 row group을 skip한다고 말합니다.
- 불완전한 min/max 통계로 skip해도 결과가 같다고 가정합니다.
- pushdown 표시만 보고 실제 bytes와 row group 수를 확정합니다.

## 더 파고들 거리

- timestamp timezone을 정규화한 뒤 통계를 만들지 않았을 때 어떤 보수적 fallback이 필요한지 검토해 보세요.
- 한 group 내부에 날짜가 섞여 page index가 없을 때 남는 읽기와 page index가 있을 때의 차이를 연결해 보세요.

---
id: parquet-rowgroup-page-pushdown
title: Parquet Row Group·Page·Predicate Pushdown
topic: 데이터베이스
summary: >-
  파일·row group·column chunk·page 메타데이터의 계층과 통계 기반 predicate pushdown, 압축·페이지 크기
  trade-off를 연결합니다.
questionIds: []
prerequisites:
  - query-plan-evidence
related:
  - external-sort
  - object-publication
reviewedAt: '2026-09-19'
---
# Parquet Row Group·Page·Predicate Pushdown

Parquet은 파일 하나를 통째로 읽는 대신 row group, column chunk, page라는 계층으로 분석 데이터를 배치합니다. 파일 metadata는 row group과 column chunk의 위치·크기·통계를 알려 주고, page 수준 metadata가 지원되면 한 column chunk 안에서도 필요한 page를 더 세밀하게 고를 수 있습니다. predicate pushdown은 SQL 문장에 WHERE가 적혀 있다는 뜻이 아니라, 실제 reader가 predicate를 파일 통계와 비교해 읽지 않아도 되는 단위를 증명하는 과정입니다.

## 파일 계층과 읽기 단위

하나의 Parquet file에는 보통 여러 row group이 있고, row group마다 컬럼별 column chunk가 있습니다. column chunk는 한 row group의 한 컬럼 데이터이며 encoding과 compression이 적용된 page들의 연속으로 저장됩니다. footer와 metadata는 reader가 각 영역의 offset·compressed size·uncompressed size·통계·codec 정보를 찾을 수 있게 합니다. page는 row group이나 테이블 partition과 같은 논리 분할이 아니라 encoding·압축·읽기 세분화를 위한 물리 단위입니다.

이 계층을 혼동하면 튜닝 방향이 틀어집니다. row group을 너무 크게 만들면 병렬 처리와 전체 scan throughput에는 유리할 수 있어도 날짜 predicate가 group 전체를 후보로 남길 수 있습니다. page를 작게 만들면 page 단위 선택이 세밀해질 수 있지만 header와 metadata, 작은 I/O 요청이 증가할 수 있습니다. 실제 default page size와 writer 정책은 구현·버전에 따라 확인합니다.

## row group 통계와 predicate skip

`WHERE date BETWEEN '2026-01-10' AND '2026-01-11'`을 4개 row group에 적용한다고 하겠습니다. 각 group의 date min/max가 각각 `[1,3]`, `[4,6]`, `[7,9]`, `[10,12]`이고 쿼리 범위가 `[10,11]`라면 첫 세 group은 범위와 겹치지 않아 후보에서 제외할 수 있고 네 번째만 읽으면 됩니다. 이때 통계가 실제 값 범위를 안전하게 나타내며 reader가 날짜 표현을 같은 의미로 비교할 수 있다는 전제가 필요합니다.

통계가 없거나 null 처리·통계 truncate 때문에 안전한 min/max를 제공하지 못하면 skip할 수 없습니다. 범위가 `[1,12]`처럼 넓으면 모든 group이 후보입니다. 날짜에 함수를 씌워 timezone·문자열 변환이 predicate와 metadata의 physical type을 어긋나게 하면 pushdown이 제한될 수 있습니다. SQL planner가 조건을 가지고 있어도 모든 engine·connector·reader가 같은 pushdown을 수행한다고 보지 않습니다.

```diagram
{"title":"Parquet의 계층별 predicate pruning","caption":"파일 footer가 row group 후보를 줄이고, page index를 지원하면 남은 column chunk 안에서도 page를 줄입니다. 통계가 안전하지 않으면 상위 단위를 읽고 필터합니다.","rows":[[{"id":"file","label":"Parquet file","detail":["footer metadata"]}],[{"id":"groups","label":"row groups","detail":["각 min/max 비교"]}],[{"id":"chunks","label":"column chunks","detail":["필요 컬럼만"]}],[{"id":"pages","label":"pages","detail":["page stats·offset index"]}],[{"id":"decode","label":"decode·filter","detail":["남은 값만 실행"]}]],"edges":[{"from":"file","to":"groups","label":"footer 위치·통계"},{"from":"groups","to":"chunks","label":"후보 group 선택"},{"from":"chunks","to":"pages","label":"page index 지원"},{"from":"pages","to":"decode","label":"offset로 읽기"}]}
```

## row group과 page 크기의 trade-off

row group은 병렬 task와 column chunk 통계의 큰 경계입니다. 작은 row group은 날짜·tenant 범위가 잘 나뉘어 skip 가능성이 높고, 여러 worker가 나눠 처리하기 쉽지만 footer metadata와 파일 open·task scheduling overhead가 커집니다. 너무 큰 row group은 순차 throughput과 compression context에 유리할 수 있지만, 한 조건이 group의 일부만 맞아도 전체 column chunk를 읽어야 할 수 있습니다.

page는 더 작은 encoding·compression 단위입니다. page가 지나치게 작으면 page header와 page index가 많아지고, range read와 decompression 호출이 잘게 나뉩니다. 너무 크면 한 page 안의 통계가 넓어져 page-level skip이 약해지고 필요한 몇 행을 위해 더 많은 compressed bytes를 읽을 수 있습니다. 두 크기를 같은 “partition size”로 부르지 말고, row group은 작업·통계 경계, page는 encoding·읽기 경계로 설명합니다.

설명용 비교를 숫자로 두면 1억 행을 4개 row group으로 나눌 때 날짜 쿼리가 1개 group만 후보로 만들면 25%의 row group 단위가 남습니다. 그러나 그 group 안의 100 page 중 날짜가 넓게 섞여 있으면 100 page를 모두 읽을 수 있습니다. page index가 있고 3개 page만 범위에 걸리면 같은 group 안에서 compressed read 범위가 3/100으로 줄어들 여지가 있습니다. 실제 byte 감소는 encoding, compression, reader의 page index 사용에 따라 측정해야 합니다.

## page index와 reader 지원

row group 통계는 group 전체의 최소·최대 범위만 말합니다. 한 group 안에 날짜가 섞여 있으면 group min/max가 넓어져 skip이 불가능합니다. page index가 page별 min/max와 offset 정보를 제공하고 reader가 이를 읽으면, group은 후보로 남겨 두면서 page 일부를 건너뛸 수 있습니다. 이것이 page index의 역할입니다.

하지만 파일에 metadata가 존재하는 것과 reader가 실제로 활용하는 것은 다릅니다. writer가 page index를 생성하지 않았거나, reader/connector가 해당 index를 지원하지 않거나, predicate 변환이 안전하지 않으면 모든 page를 decode한 뒤 필터할 수 있습니다. 실행 계획의 “predicate pushdown” 표기만 보지 말고 실제 bytes read, page read count, decode rows, filter rows를 비교합니다.

또한 page index가 모든 문제를 해결하지 않습니다. 값이 한 page에 랜덤하게 섞여 min/max가 전체 범위를 포함하면 skip이 어렵고, string collation·null·NaN·timestamp timezone의 비교 규칙을 잘못 적용하면 안전한 pruning이 아닙니다. 통계를 이용한 skip은 결과를 바꾸지 않는다는 보수적 조건 아래에서만 허용되어야 합니다.

## encoding과 압축의 위치

Parquet의 plain, dictionary, RLE, bit-packing과 같은 encoding은 physical type과 page 데이터 분포에 따라 적용될 수 있으며, 어떤 encoding을 선택하고 fallback하는지는 writer와 reader 구현의 계약을 확인해야 합니다. dictionary page와 data page의 구조는 읽기·압축·메모리 비용에 영향을 주지만, predicate skip은 먼저 metadata가 후보를 줄이는지의 문제입니다. 압축률이 좋아도 통계를 이용해 page를 생략하지 못하면 compressed bytes를 풀어야 하고, 반대로 skip이 잘 되면 압축 codec의 전체 throughput보다 읽지 않은 bytes의 절감이 더 중요할 수 있습니다.

저카디널리티 상태값이 dictionary로 잘 압축되더라도 하나의 거대한 row group에 모든 날짜가 섞이면 날짜 predicate의 skip 경계는 약합니다. 반대로 날짜 순서로 묶은 row group은 압축과 pruning 모두에 도움이 될 수 있지만, 다른 query의 tenant 조건이나 최신 데이터 append 패턴이 불리해질 수 있습니다. 저장 배치와 질의 혼합을 함께 선택해야 합니다.

## 구현 선택과 실패 진단

writer에서는 row group 크기, page 크기, sort/order, statistics 생성, codec을 workload와 함께 정합니다. 날짜 범위 질의가 많다면 row group이 시간 범위를 어느 정도 유지하도록 작성하는 편이 통계를 유효하게 만들 수 있습니다. 그러나 특정 engine이 page index를 읽는다는 확인 없이 metadata를 추가하는 것만으로 성능 개선을 약속하지 않습니다.

진단 순서는 file footer에서 예상 후보 group을 계산하고, 실행된 reader가 실제로 읽은 row group·column chunk·page·bytes를 비교하는 것입니다. 예상은 1 group인데 실제 4 group을 읽으면 pushdown 미지원·표현 변환·통계 불안전·partition/file layout을 조사합니다. 예상 1 group과 실제 1 group인데 시간이 느리면 compression decode, remote I/O, CPU, row materialization을 분리합니다.

## 검증 trace와 운영 비용

합성 파일을 만들 때 4개 row group의 date min/max를 `[1,3]`, `[4,6]`, `[7,9]`, `[10,12]`로 두고 query `[10,11]`를 실행하는 설명 테스트를 작성할 수 있습니다. 기대 결과는 group 4만 후보가 되는 것입니다. 다음에는 group 4 내부에 100 page를 두고 page index 없음, index 있음·3 page 일치, reader가 index를 무시하는 세 실행을 비교합니다. 이 문서에서는 Parquet writer/reader를 실제 실행하지 않았으므로 예상 결과를 측정 결과로 위장하지 않습니다.

비용 계산에는 footer 크기, page index metadata, remote range request 수, decompression CPU, task parallelism, file open 수를 넣습니다. 많은 작은 파일·row group은 metadata와 scheduling 비용을 키우고, 하나의 큰 파일·group은 skip과 병렬 분배를 악화시킬 수 있습니다. object storage에서 파일을 공개할 때도 완성된 footer와 metadata가 검증되기 전에는 독자에게 최종 version으로 노출하지 않는 것이 안전합니다.

## 참고자료와 근거 범위

Apache Parquet overview는 column-oriented bulk storage/retrieval과 encoding·compression의 목적을 설명하고, file-format metadata 문서는 file metadata와 page header metadata의 위치·크기·탐색 구조를 근거로 제공합니다. encoding 종류와 적용성은 별도의 Data Pages/Encodings 문서로 확인합니다. 참고 URL: https://parquet.apache.org/docs/overview/, https://parquet.apache.org/docs/file-format/metadata/, https://parquet.apache.org/docs/file-format/data-pages/encodings/.

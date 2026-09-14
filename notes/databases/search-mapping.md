---
id: search-mapping
title: Elasticsearch Mapping·역색인·Doc Values·Shard
topic: 데이터베이스
summary: 정확 값과 분석 text를 분리하고 검색 후보·문서별 값 접근·fielddata·mapping 폭증·shard fan-out·복구 비용을 설명합니다.
questionIds: [elasticsearch-shard-mapping, elasticsearch-docvalues-inverted-index]
---

# Elasticsearch Mapping·역색인·Doc Values·Shard

## 정확한 ID와 본문 단어 검색은 같은 표현이 아닙니다

상품 ID `AB-123`을 정확히 비교하려는데 text 분석기로 나누면 원문 전체와 다른 token들이 검색됩니다. mapping은 필드 타입·분석·색인·정렬·집계의 표현을 정합니다. shard 수를 늘려도 잘못된 token화가 올바른 검색 의미로 바뀌지 않습니다.

ID·tenant·분류의 정확 값은 보통 keyword, 본문은 적절한 analyzer를 쓰는 text가 출발점입니다. 같은 제목에 본문 검색과 정확 정렬이 필요하면 multi-field로 별도 표현을 둘 수 있습니다. 실제 ID GET의 `_id`와 일반 keyword 필드 조회는 API 경로가 다릅니다.

| 요구 | 표현·접근 후보 | 확인할 것 |
| --- | --- | --- |
| 본문 단어·언어 검색 | text·analyzer·역색인 | token·동의어·형태소·정확성 |
| 정확 일치·집합 필터 | keyword | 정규화·길이·대소문자 |
| 숫자·시각 범위 | numeric·date | 정밀도·형식·시간대 |
| 정렬·집계 | 지원 타입 doc values | cardinality·메모리·응답량 |

## 역색인은 Term에서 문서로, Doc Values는 문서에서 값으로 갑니다

역색인은 term→문서 목록 같은 구조로 검색 후보를 좁힙니다. doc values는 문서별 필드 값을 열 지향 형태로 읽는 데 적합해 sort·aggregation·script 등의 접근에 쓰입니다. 같은 필드의 index와 doc_values 설정은 다른 책임입니다.

```diagram
{"title":"질의 방향에 따라 필요한 저장 표현이 다릅니다","caption":"화살표는 조회 방향입니다. term에서 후보 문서를 찾는 것과 각 문서의 정렬·집계 값을 읽는 것은 다른 접근입니다.","rows":[[{"id":"term","label":"검색 term"},{"id":"doc","label":"후보 문서 ID"}],[{"id":"inverted","label":"역색인 · 문서 후보"},{"id":"values","label":"doc values · 필드 값"}]],"edges":[{"from":"term","to":"inverted","label":"term → documents"},{"from":"doc","to":"values","label":"document → value"}]}
```

text의 fielddata를 무심코 켜서 정렬·집계를 가능하게 하면 heap 비용이 커질 수 있습니다. keyword multi-field처럼 목적에 맞는 표현을 검토합니다. index:false여도 일부 타입은 doc values를 통한 제한된 검색이 가능할 수 있으나 지원 연산·성능이 같지 않으므로 실제 버전 계약을 확인합니다. doc values가 모든 필드 타입에 같은 방식으로 존재하는 것도 아닙니다.

## 동적 필드와 큰 집계는 저장·메모리를 키웁니다

사용자 ID를 필드 이름으로 계속 추가하면 mapping 필드 수·cluster state·메모리 관리가 커질 수 있습니다. 허용 schema·dynamic template·적합한 flattened 등의 자료형을 실제 질의 요구와 비교합니다. 타입이 잘못 자동 추론된 뒤 기존 필드 타입을 자유롭게 바꿀 수 있다고 가정하지 않습니다.

고카디널리티 terms 집계·긴 keyword·큰 문서·정렬 후보 수는 coordinator·shard 메모리·CPU에 영향을 줍니다. 단순 전체 문서 수 외에 값 분포·최대 크기·검색 선택도·aggregation bucket 수를 제한하고 측정합니다.

## Shard는 병렬 실행 단위이면서 복구 단위입니다

shard가 많으면 일부 작업을 분산할 수 있지만 검색 fan-out·각 shard의 segment·파일 핸들·heap·coordinator 병합 비용이 늘어납니다. 작은 shard를 과도하게 만들면 overhead가 크고 너무 큰 shard는 이동·복구 시간이 길어질 수 있습니다. primary와 replica의 저장·가용성·읽기 비용을 함께 봅니다.

고정된 권장 GB나 shard 개수를 모든 환경에 적용하지 않습니다. 문서·색인률·node heap·disk·복구 목표·대표 query로 검증합니다. 생성 후 shard 수 변경은 split·shrink·reindex 등 기능의 제한과 비용을 따르며 단순 설정 숫자 수정이 아닐 수 있습니다.

custom routing은 일부 조회 fan-out을 줄일 수 있지만 tenant 편중·hot shard·ID GET 때 같은 routing 필요·삭제 경로 계약이 생깁니다. routing이 데이터 접근 인가를 대신하지도 않습니다.

## Mapping 변경은 새 표현의 의미를 먼저 대조합니다

새 index에 바꾼 mapping으로 대표 문서를 넣고 분석 token·정확 ID·정렬·NULL·집계 결과를 비교합니다. old/new query가 같은 사용자 요구를 만족하는지 확인한 뒤 reindex·동시 쓰기·삭제 추적·alias 전환을 설계합니다.

현재 작업에서는 Elasticsearch를 실행하지 않았습니다. 이 노트는 표현과 비용의 학습 설명이며 shard 크기·query p99·fielddata 메모리 측정 결과가 아닙니다.

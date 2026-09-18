---
id: search-mapping
title: Elasticsearch Mapping·역색인·Doc Values·Shard
topic: 데이터베이스
summary: 정확 값과 분석 text를 분리하고 검색 후보·문서별 값 접근·fielddata·mapping 폭증·shard fan-out·복구 비용을 설명합니다.
questionIds: [elasticsearch-shard-mapping, elasticsearch-docvalues-inverted-index]
---

# Elasticsearch Mapping·역색인·Doc Values·Shard

검색 시스템의 mapping은 저장 형식 설정을 넘어 “이 필드를 어떤 질문에 답하게 할 것인가”를 선언하는 질의 계약입니다. 본문을 찾는 표현, 정확히 같은 값을 필터링하는 표현, 문서별 값을 정렬·집계하는 표현을 먼저 나누면 역색인과 doc values, shard 비용을 한 기능으로 오해하지 않게 됩니다.

## 정확 값과 본문 검색 표현의 분리

`mapping`은 필드마다 어떤 타입으로 저장하고 분석·색인·정렬·집계를 허용할지 정하는 색인 스키마입니다. 상품 ID `AB-123`에 `text` analyzer를 적용하면 문자열을 여러 `token`으로 나누어 검색할 수 있으므로 원문 전체와 같은 값인지 확인하는 ID 조회에는 맞지 않을 수 있고, shard(데이터를 나누어 저장하는 단위) 수를 늘려도 이 tokenization 의미는 바뀌지 않습니다.

선택을 검증할 때 `AB-123` 한 문서를 넣고 `text` 분석 결과의 token 목록, `keyword`의 단일 값, 두 필드의 exact query 결과를 나란히 확인합니다. 이어 같은 문서 집합에서 제목 검색·ID 필터·가격 정렬·tenant 집계를 각각 실행해, 후보를 찾는 단계와 문서 값을 읽는 단계 중 어느 표현이 필요했는지 기록합니다. 한 필드에 모든 목적을 몰아 fielddata를 켜는 것은 편리해 보여도 메모리 실패 경로를 숨길 수 있습니다.

알려진 문서의 `_id`를 GET하는 경로와 일반 `keyword` 필드를 query하는 경로도 서로 다르므로 API 사용 목적을 먼저 나눕니다.

| 요구 | 표현·접근 후보 | 확인할 것 |
| --- | --- | --- |
| 본문 단어·언어 검색 | text·analyzer·역색인 | token·동의어·형태소·정확성 |
| 정확 일치·집합 필터 | keyword | 정규화·길이·대소문자 |
| 숫자·시각 범위 | numeric·date | 정밀도·형식·시간대 |
| 정렬·집계 | 지원 타입 doc values | cardinality·메모리·응답량 |

## 역색인과 Doc Values의 조회 방향

`역색인`은 검색어인 `term`에서 그 term을 포함한 문서 ID 목록으로 가는 표라서 검색 후보를 먼저 좁힙니다. `doc values`는 반대로 문서에서 특정 필드의 값을 읽기 쉽도록 저장한 열 지향 표현이라 정렬·집계·스크립트에 쓰입니다. 따라서 같은 필드의 `index` 설정은 검색 후보를 만들 수 있는지, `doc_values` 설정은 문서별 값을 읽을 수 있는지와 관련된 별도 책임입니다.

```diagram
{"title":"질의 방향에 따라 필요한 저장 표현이 다릅니다","caption":"화살표는 조회 방향입니다. term에서 후보 문서를 찾는 것과 각 문서의 정렬·집계 값을 읽는 것은 다른 접근입니다.","rows":[[{"id":"term","label":"검색 term"},{"id":"doc","label":"후보 문서 ID"}],[{"id":"inverted","label":"역색인 · 문서 후보"},{"id":"values","label":"doc values · 필드 값"}]],"edges":[{"from":"term","to":"inverted","label":"term → documents"},{"from":"doc","to":"values","label":"document → value"}]}
```

`text`에 `fielddata`(분석된 text 값을 메모리에 올려 정렬·집계에 쓰는 표현)를 켜면 heap 비용이 커질 수 있습니다. 그래서 정확 값과 집계가 필요하면 `keyword` multi-field처럼 목적에 맞는 표현을 먼저 검토합니다. `index:false`인 일부 타입도 doc values를 이용한 제한된 접근이 가능할 수 있지만 지원 연산과 성능이 같다는 뜻은 아니며, doc values가 모든 필드 타입에 같은 방식으로 존재하는 것도 아니므로 실제 버전 계약을 확인해야 합니다.

## 동적 필드·대규모 집계의 저장·메모리 비용

사용자 ID를 필드 이름으로 계속 추가하면 mapping 필드 수·cluster state·메모리 관리가 커질 수 있습니다. 허용 schema·dynamic template·적합한 flattened 등의 자료형을 실제 질의 요구와 비교합니다. 타입이 잘못 자동 추론된 뒤 기존 필드 타입을 자유롭게 바꿀 수 있다고 가정하지 않습니다.

고카디널리티 terms 집계·긴 keyword·큰 문서·정렬 후보 수는 coordinator·shard 메모리·CPU에 영향을 줍니다. 단순 전체 문서 수 외에 값 분포·최대 크기·검색 선택도·aggregation bucket 수를 제한하고 측정합니다.

## Shard의 병렬 실행·복구 단위 역할

shard가 많으면 일부 작업을 분산할 수 있지만 검색 fan-out·각 shard의 segment·파일 핸들·heap·coordinator 병합 비용이 늘어납니다. 작은 shard를 과도하게 만들면 overhead가 크고 너무 큰 shard는 이동·복구 시간이 길어질 수 있습니다. primary와 replica의 저장·가용성·읽기 비용을 함께 봅니다.

고정된 권장 GB나 shard 개수를 모든 환경에 적용하지 않습니다. 문서·색인률·node heap·disk·복구 목표·대표 query로 검증합니다. 생성 후 shard 수 변경은 split·shrink·reindex 등 기능의 제한과 비용을 따르며 단순 설정 숫자 수정이 아닐 수 있습니다.

custom routing은 일부 조회 fan-out을 줄일 수 있지만 tenant 편중·hot shard·ID GET 때 같은 routing 필요·삭제 경로 계약이 생깁니다. routing이 데이터 접근 인가를 대신하지도 않습니다.

## Mapping 변경 시 새 표현의 의미 대조

새 index에 바꾼 mapping으로 대표 문서를 넣고 분석 token·정확 ID·정렬·NULL·집계 결과를 비교합니다. old/new query가 같은 사용자 요구를 만족하는지 확인한 뒤 reindex·동시 쓰기·삭제 추적·alias 전환을 설계합니다.

장애 진단 시 먼저 `mapping`과 실제 query를 함께 고정한 뒤, 결과 누락이면 analyzer·정확값·refresh 상태를, 정렬·집계 실패면 doc values와 타입을, p99 상승이면 shard fan-out·bucket 수·coordinator 메모리를 분리해 봅니다. 이 순서를 지키면 shard 수를 늘리는 조치가 토큰화나 잘못된 필드 의미를 해결한다고 착각하는 일을 줄일 수 있습니다.

현재 작업에서는 Elasticsearch를 실행하지 않았습니다.

---
id: "elasticsearch-docvalues-inverted-index"
title: "Elasticsearch의 역색인과 doc values는 본문 검색·정렬·집계에서 각각 어떤 접근을 지원하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Elasticsearch","shard","mapping","심화 질문"]
related: ["elasticsearch-shard-mapping","composite-index-column-order"]
promotedFrom: {"id":"elasticsearch-shard-mapping","prompt":"doc values와 역색인의 검색·집계 역할을 비교해 보세요."}
---

# Elasticsearch의 역색인과 doc values는 본문 검색·정렬·집계에서 각각 어떤 접근을 지원하나요?

## 구두 답변

역색인은 term에서 문서 후보를 찾는 데, doc values는 문서별 필드 값을 읽어 정렬·집계하는 데 사용됩니다. 같은 필드라도 text 분석과 keyword의 정확 값 표현이 다르므로 질의 의미에 맞춰 mapping합니다.

text fielddata를 무심코 켜면 heap 비용이 커질 수 있어 keyword·multi-field 등 적합한 구조를 검토합니다. index:false와 doc_values 설정의 지원·질의 범위를 버전별 확인합니다. 검색 정확성·고카디널리티 집계·메모리·색인 비용을 함께 봅니다.

## 득점 포인트

- 역색인은 term에서 문서 후보를 찾는 데, doc values는 문서별 필드 값을 읽어 정렬·집계하는 데 사용됩니다. 같은 필드라도 text 분석과 keyword의 정확 값 표현이 다르므로 질의 의미에 맞춰 mapping합니다.
- 검색 정확성·고카디널리티 집계·메모리·색인 비용을 함께 봅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 역색인은 term에서 문서 후보를 찾는 데, doc values는 문서별 필드 값을 읽어 정렬·집계하는 데 사용됩니다.

## 더 파고들 거리

- [기본 상황과 비교: 검색용 데이터에 정확한 ID 조회와 본문 검색이 함께 있습니다. Elasticsearch의 mapping과 shard 수를 어떻게 정해야 하나요?](/tech-interview/questions/elasticsearch-shard-mapping/)

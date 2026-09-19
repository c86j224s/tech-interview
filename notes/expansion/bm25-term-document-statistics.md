---
id: bm25-term-document-statistics
title: BM25의 용어·문서 통계와 길이 정규화
topic: 머신러닝 검색
summary: >-
  TF saturation·IDF·document length normalization이 lexical score를 만드는 과정과
  analyzer·k1·b의 경계를 설명합니다.
questionIds: []
prerequisites:
  - search-mapping
  - indexes
  - classification-metrics
related:
  - search-mapping
reviewedAt: '2026-09-19'
---
# BM25의 용어·문서 통계와 길이 정규화

BM25는 “term이 많이 나온 문서가 좋다”를 그대로 점수화하지 않습니다. 먼저 analyzer가 문서를 term sequence로 바꾸고, corpus 안에서 term이 얼마나 흔한지 `document frequency`를 계산하며, 한 문서 안의 빈도는 포화시키고 문서 길이는 보정합니다. 따라서 같은 BM25 파라미터라도 analyzer, corpus, shard 통계와 field length가 바뀌면 ranking이 바뀝니다. 점수는 최종 순서를 위한 신호이지 확률이나 서로 다른 query 간의 절대 등급으로 바로 읽어서는 안 됩니다.

## 검색 필드와 통계 단위

`text` 필드에 원문을 색인하면 analyzer가 소문자화·토큰화·필터링을 거쳐 term을 만듭니다. “Running Shoes”가 `[running, shoes]`가 될 수도 있고, stemming을 사용하면 `[run, shoe]`가 될 수도 있습니다. stopword 제거가 있으면 토큰 수가 줄어듭니다. 이 시점의 결과가 BM25가 보는 입력입니다. 원문 글자 수와 BM25의 문서 길이는 같은 값이 아닙니다.

문서 수를 `N`, term `t`를 한 번 이상 포함하는 문서 수를 `df(t)`라고 하겠습니다. `tf(t,d)`는 문서 `d`에서 term이 등장한 횟수입니다. 같은 term을 열 번 반복해도 `df`는 그 문서에 대해 한 번만 증가하지만 `tf`는 증가합니다. 이 구분을 놓치면 희귀 term의 구분력과 반복 term의 포화를 서로 뒤바꿔 설명하게 됩니다.

## IDF와 희귀 term의 구분력

Elasticsearch의 reference는 BM25가 TF/IDF, TF 포화, field-length normalization을 결합한다고 설명합니다. 아래 IDF 식은 해당 페이지가 직접 제시한 식이라고 주장하지 않는 일반적인 설명 모델입니다.

```text
idf(t) = ln(1 + (N - df(t) + 0.5) / (df(t) + 0.5))
```

문서가 1,000,000개인 corpus에서 주문번호 `ORD-7K9`가 10개 문서에만 있다면 `df=10`이고 IDF는 대략 `ln(1 + 999990.5/10.5) ≈ 11.46`입니다. “상품”이 900,000개 문서에 있으면 대략 `ln(1 + 100000.5/900000.5) ≈ 0.105` 수준입니다. 이 계산은 설명용으로 숫자를 중간 상태까지 추적한 것이며, 실제 엔진의 shard 통계·discount_overlaps·유사도 설정에 따라 세부 값은 달라질 수 있습니다.

희귀 term이 큰 IDF를 갖는 것은 검색어와 문서가 일치했을 때 그 단어가 문서를 구분하는 데 유용하다는 뜻입니다. 그러나 희귀함이 의미 있는 관련성을 보장하지는 않습니다. 오타, 추적 ID, 한 번만 등장한 boilerplate도 희귀합니다. synonym이나 analyzer가 term을 어떻게 만들었는지, query가 실제 어떤 field에 들어갔는지와 함께 확인해야 합니다.

## TF 포화와 k1

BM25의 한 term 기여는 보통 다음 꼴입니다.

```text
tfPart = tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / avgdl))
score ≈ idf * tfPart
```

`k1=1.2`, 길이 보정 분모의 길이 항을 1로 두면 `tf=1`일 때 `1×2.2/(1+1.2)=1`, `tf=5`일 때 `5×2.2/(5+1.2)=1.774`, `tf=20`일 때 `20×2.2/(20+1.2)=2.075`입니다. TF가 1에서 20으로 20배가 되어도 이 항은 1에서 약 2.08로만 증가합니다. 반복이 어느 정도 의미를 주지만, term을 20배 복사했다고 점수가 20배가 되지 않는 이유가 여기 있습니다.

`k1`은 포화가 시작되고 증가하는 모양을 조절합니다. 큰 `k1`은 높은 TF가 더 오래 영향력을 갖게 할 수 있지만, 정확한 최적값은 field와 질의 분포의 실험 대상입니다. `k1=0` 같은 극단값을 일반 설정으로 권하지 않는 이유도, TF 차이를 거의 무시하게 되어 field의 반복 정보가 사라질 수 있기 때문입니다. analyzer가 같은 term을 중복 생성하면 tf가 의도보다 커질 수 있으므로, 파라미터 튜닝 전에 `_analyze` 같은 실제 token stream 확인이 선행돼야 합니다.

## 길이 정규화와 b

길이 항 `dl/avgdl`은 현재 문서의 token 길이와 평균 field 길이의 비율입니다. `b=0`이면 분모의 길이 영향이 사라지고, `b=1`에 가까울수록 평균보다 긴 문서의 동일 TF를 더 강하게 보정합니다. “긴 문서가 항상 불리하다”가 아니라, 동일한 term 빈도가 긴 문서 안에서 차지하는 밀도가 낮다는 휴리스틱을 반영하는 것입니다.

`k1=1.2`, `b=0.75`, `tf=3`인 두 문서를 계산해 보겠습니다. 문서 A는 `dl=100`, 평균 길이 `avgdl=100`이므로 길이 항은 1이고 `tfPart=3×2.2/(3+1.2)=1.571`입니다. 문서 B가 `dl=1000`이면 길이 항은 `0.25+0.75×10=7.75`이고 분모는 `3+1.2×7.75=12.3`, `tfPart=6.6/12.3≈0.5366`입니다. 7.5·12·0.55라는 계산은 산술 오류이므로 사용하지 않습니다. 같은 세 번의 term이라도 긴 문서에서 term의 상대적 밀도가 낮다고 보고 큰 보정을 받습니다. `b=0`으로 바꾸면 두 문서 모두 길이 항이 1이어서 같은 TF 부분점수가 됩니다.

반대로 field가 제목처럼 짧고 길이 자체가 의미를 거의 갖지 않거나, 긴 문서가 상세 설명일수록 더 관련 있을 수 있는 분야라면 높은 b가 적합하지 않을 수 있습니다. b를 올리기 전에 길이와 relevance label의 관계를 검증해야 하며, score만 보고 긴 문서를 무조건 제외하는 식의 해석은 금물입니다.

## Analyzer와 통계 재구성

같은 `k1`, `b`여도 analyzer가 바뀌면 `tf`, `df`, `dl`이 동시에 변합니다. 가상의 문서가 `Running shoes for running`이고 query가 `running shoes`라고 하겠습니다. whitespace analyzer라면 토큰은 `[Running, shoes, for, running]` 또는 대소문자 처리가 별도이고, lowercase analyzer라면 `[running, shoes, for, running]`입니다. stopword `for`를 제거하면 길이는 3이 됩니다. stemming까지 적용해 `running→run`, `shoes→shoe`가 되면 query analyzer도 같은 규칙이어야 매칭됩니다.

index analyzer만 바꾸고 search analyzer를 고정하면 query token과 index token이 어긋나 ranking과 recall이 함께 변할 수 있습니다. analyzer A에서 `running`이 2회였던 문서가 stemming 뒤 `run` 2회가 되고, synonym graph가 추가되면 term 수와 overlap 처리도 달라질 수 있습니다. 따라서 변경 실험은 파라미터 실험과 분리해 token stream, 문서 길이, term df, 결과 순위를 함께 저장합니다.

```diagram
{"title":"BM25 점수의 입력 흐름","caption":"BM25의 score는 analyzer가 만든 통계에서 출발해 TF·IDF·길이 보정 항을 결합합니다.","rows":[[{"id":"text","label":"원문","detail":["문서·질의"]}],[{"id":"tokens","label":"analyzer token","detail":["tf · dl"]}],[{"id":"stats","label":"corpus stats","detail":["df · avgdl"]}],[{"id":"score","label":"BM25 score","detail":["IDF × TF 부분"]}],[{"id":"rank","label":"ranking","detail":["query 내부 비교"]}]],"edges":[{"from":"text","to":"tokens","label":"분석"},{"from":"tokens","to":"stats","label":"통계 집계"},{"from":"stats","to":"score","label":"정규화"},{"from":"score","to":"rank","label":"정렬"}]}
```

## Query score와 해석 경계

BM25 score는 같은 query, 같은 field, 같은 유사도 설정에서 문서의 상대 순위를 비교하는 데 적합합니다. query가 바뀌면 term 수와 IDF 합이 달라질 수 있어 query A의 12.0이 query B의 8.0보다 더 관련 있다고 단정하면 안 됩니다. 여러 query의 score를 임계값으로 합치거나 dense score와 원시 합산할 때는 별도의 calibration 또는 rank fusion 설계가 필요합니다.

분산 shard 환경에서는 term 통계를 shard별로 계산하거나 coordination 방식으로 보정할 수 있어, 동일 문서 집합도 shard 배치에 따라 score가 달라질 수 있습니다. 정확한 IDF가 필요하면 실제 검색 API의 `dfs` 계열 옵션처럼 global term statistics를 사용하는 경로가 있는지, 그 비용과 버전을 확인해야 합니다. 여기서 특정 서버의 기본 동작을 고정하지 않고, 운영 버전 문서와 profile 결과로 확인해야 합니다.

## 구현 선택과 점검 절차

첫째, field 목적을 정합니다. 본문 relevance용 `text`, 정확한 값·정렬·집계용 `keyword`를 분리하고, 동일 원문에 두 요구가 있으면 multi-field를 검토합니다. 둘째, 대표 문서와 query의 analyzer token stream을 저장합니다. 셋째, 작은 corpus의 `N`, `df`, `tf`, `dl`, `avgdl`을 손으로 계산해 엔진의 설명 API 결과와 대조합니다. 넷째, relevance label이나 query-click set으로 analyzer와 `k1`,`b`를 비교하며 NDCG·MRR 같은 ranking metric과 latency를 함께 봅니다.

예를 들어 상품 제목 100만 개에서 주문번호 검색과 자연어 검색을 동시에 처리한다면, 주문번호에 BM25만 적용해 희귀 term 보너스를 기대하기보다 정확 ID field를 별도로 두는 것이 안전합니다. 긴 상품 설명에서 term 3회가 제목의 term 1회보다 항상 높아야 하는지 제품 의미를 먼저 정하고, 그 목적에 맞춰 b와 field boost를 실험해야 합니다. 설명 API에서 term별 score 항을 읽되 내부 구현의 모든 수를 수동 재현할 수 있다고 약속하지는 않습니다.

## 실패 사례와 검증 지표

흔한 실패는 stopword·lowercase 변경을 mapping 수정 없이 배포하거나, analyzer가 만든 field length와 원문 글자 수를 혼동하는 것입니다. 또 한 shard에서는 희귀했던 term이 전체 corpus에서는 흔할 수 있으며, 짧은 query와 긴 query의 raw score를 같은 threshold에 넣을 수도 없습니다. score가 갑자기 바뀌면 문서 자체보다 analyzer, shard 배치, corpus size, similarity 설정, boost 변경을 함께 diff합니다.

검증 표에는 최소한 query ID, analyzer 설정, 결과 문서 ID, term별 tf·df, dl·avgdl, score, rank, p95/p99를 넣습니다. b=0과 b=.75, `tf=1/5/20`, 짧고 긴 문서, 희귀·흔한 term을 고정한 synthetic corpus를 만들면 각 항의 방향을 검증할 수 있습니다. 본문은 특정 Elasticsearch 버전을 실행한 결과가 아니라 공식 similarity reference의 BM25 구성 요소를 읽고 만든 설명이며, exact default와 shard 통계 동작은 운용 버전에서 별도 확인이 필요합니다.

## 비용·한계와 참고 자료

BM25는 token 통계에 의존하는 lexical 신호라 동의어·의미적 유사성·철자 오류를 자동으로 해결하지 않습니다. analyzer와 corpus 통계를 재계산하는 색인 비용이 있고, global statistics 보정은 분산 검색 비용을 늘릴 수 있습니다. `k1`,`b`를 데이터셋 밖에서 외우는 것보다 판단 라벨과 대표 query로 비교하는 것이 낫습니다.

주요 근거는 [Elasticsearch의 `index-modules-similarity` reference](https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules-similarity.html)입니다. 해당 페이지에서 직접 확인한 것은 TF/IDF 구성, k1 포화, b 정규화와 설정 경계이며, 위 IDF 식 자체는 설명용 모델로 범위를 좁혔습니다. 해당 문서의 current URL은 서버 릴리스를 고정하지 않으므로 특정 기본값·버전 동작을 이 글의 불변 사실로 확대하지 않았습니다. BM25의 기본 수식과 analyzer·통계 관계를 이해한 뒤 실제 버전의 `explain`, `_analyze`, mapping 결과를 읽는 순서가 안전합니다.

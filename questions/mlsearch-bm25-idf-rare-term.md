---
id: mlsearch-bm25-idf-rare-term
title: 희귀 term과 흔한 term의 BM25 기여가 다른 이유는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - BM25
  - document frequency
  - IDF
related:
  - elasticsearch-docvalues-inverted-index
  - elasticsearch-shard-mapping
---
# 희귀 term과 흔한 term의 BM25 기여가 다른 이유는 무엇인가요?

## 구두 답변

BM25는 term이 몇 개 문서에 등장했는지인 `df`를 IDF로 바꿔, 희귀 term이 문서를 구분하는 신호가 되도록 합니다. 예를 들어 100만 문서 중 10개에만 있는 주문번호는 `df=10`이라 IDF가 크고, 90만 문서에 있는 “상품”은 IDF가 작습니다. 그래서 같은 TF라도 주문번호의 기여가 클 수 있습니다. 다만 희귀함이 관련성을 보장하지는 않으며, 오타·임의 ID·boilerplate일 수 있고 analyzer와 shard 통계가 결과를 바꿉니다.

설명용 IDF `ln(1+(N-df+.5)/(df+.5))`로 `N=1,000,000`을 계산하면 df=10은 약 11.46, df=900,000은 약 0.105입니다. 이는 BM25 전체 score가 아니라 IDF 항의 비교입니다. 문서 길이, tf, boost와 query term 수는 별도입니다. 실제 엔진에서는 shard-level/global 통계 옵션과 similarity 설정을 확인하겠습니다.

검증할 때는 corpus와 analyzer를 고정하고 희귀 주문번호, 흔한 일반어, 오타 term을 넣어 `df`, `tf`, `dl`, term별 score를 `explain`과 대조합니다. shard를 바꾸면 한 shard에서만 희귀한 term의 score가 달라질 수 있으므로 동일 문서 결과를 global score로 당연시하지 않습니다.


희귀 term의 반례도 필요합니다. `ordr-7k9`가 한 문서에만 있으면 큰 IDF는 얻지만 오타일 수 있어 relevance를 보장하지 않습니다. 또 shard A에는 해당 term이 1개, shard B에는 99개라면 local 통계에서 A의 문서가 더 큰 기여를 받을 수 있습니다. 문서를 shard에 재배치한 전후 `N,df,tf,dl,score,rank`를 저장해 score 변동을 확인하고, 주문번호 검색이라면 BM25 임계값 대신 keyword exact 필드의 일치 여부를 우선하는지 결정합니다. 이 작은 corpus trace는 설명용이며 특정 shard 실행 결과가 아닙니다.
## 득점 포인트

- df가 term을 포함하는 문서 수이고 tf와 다르다는 점을 설명한다.
- 100만 문서에서 df=10과 900,000의 IDF 차이를 계산한다.
- 희귀 term의 높은 기여와 실제 관련성, analyzer·shard 통계를 분리한다.

## 감점 포인트

- term이 한 문서에서 많이 반복되면 df도 그만큼 커진다고 말한다.
- 희귀 term은 반드시 중요한 검색어라고 단정한다.
- shard-local score를 corpus 전체의 고정 IDF로 오해한다.

## 더 파고들 거리

- synonym이나 stemming이 df와 idf를 어떻게 바꾸는지 작은 corpus로 추적해 보세요.
- shard 배치에 따른 score 변동을 줄이기 위한 global statistics 옵션의 비용을 어떻게 검증하겠습니까?
- 주문번호를 BM25가 아닌 keyword exact query로 분리하는 기준은 무엇입니까?

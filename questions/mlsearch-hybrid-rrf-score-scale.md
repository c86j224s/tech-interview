---
id: mlsearch-hybrid-rrf-score-scale
title: BM25와 cosine score를 단순 합산하면 왜 불안정하고 RRF는 무엇을 피하나요?
difficulty: 중하
category: 머신러닝
tags:
  - hybrid retrieval
  - RRF
  - score scale
related:
  - ranking-global-topk
  - elasticsearch-docvalues-inverted-index
---
# BM25와 cosine score를 단순 합산하면 왜 불안정하고 RRF는 무엇을 피하나요?

## 구두 답변

BM25와 cosine은 score의 범위와 의미가 다르기 때문에 raw score를 그대로 더하면 query마다 한 retriever가 결과를 지배할 수 있습니다. 예를 들어 lexical 12와 dense .8을 더하는 것과 lexical 2와 dense .79를 더하는 것은 숫자상 lexical 차이가 과도하게 반영됩니다. RRF는 score가 아니라 각 목록의 rank에 `1/(k+rank)` 기여를 더해 raw scale 비교를 피합니다. 다만 RRF가 calibration, 중복 identity, 후보 누락, 권한 필터를 자동 해결하는 것은 아닙니다.

`k=60`일 때 lexical 1위·dense 10위 문서는 `1/61+1/70≈.03065`입니다. lexical 20위·dense 2위는 `1/80+1/62≈.02863`입니다. 두 목록에서 모두 상위권인 문서를 비교적 안정적으로 합치지만, cutoff 밖 문서는 기여가 0인 “검색되지 않은 문서”이지 실제 51위 점수로 넣을 수 없습니다. 동일 document ID는 union 후 dedupe해 두 rank 기여를 합칩니다.

raw weighted sum을 쓰려면 score calibration을 query 분포와 label로 학습하고 drift를 감시해야 합니다. RRF를 쓰더라도 lexical exact match나 권한·tenant 필터처럼 반드시 지켜야 하는 조건을 fusion 전후 어느 단계에 둘지 정합니다. 품질은 candidate recall과 NDCG, 운영성은 p95/p99와 QPS로 따로 확인하겠습니다.


두 문서 전체를 계산하면 raw sum의 문제를 더 잘 볼 수 있습니다. query A에서 D1=(12,.80), D2=(10,.79)이면 동일 가중치 합은 6.40과 5.395로 D1이 앞섭니다. query B에서 D1=(2,.80), D2=(1.9,.79)이면 1.40과 1.345로 같은 .1 lexical 차이가 다른 비중을 차지합니다. RRF k=60에서는 D1이 lexical 1위·dense 10위일 때 약 .03065, D2가 lexical 20위·dense 2위일 때 약 .02863입니다. cutoff 밖 문서를 임의의 51위로 넣지 않는 missing convention은 구현 선택이며 이번 PDF에서 직접 확인한 규칙이 아닙니다.
## 득점 포인트

- raw score scale과 query별 분포 차이를 구체적인 12/.8, 2/.79 예로 설명한다.
- RRF 식, rank constant, ID dedupe와 cutoff 경계를 설명한다.
- RRF의 장점과 calibration·filter·candidate miss를 해결하지 못하는 한계를 구분한다.

## 감점 포인트

- BM25와 cosine이 같은 단위라고 보고 가중합을 고정한다.
- RRF가 relevance score를 calibration하거나 누락된 후보를 복원한다고 말한다.
- 제목이 같은 문서를 무조건 하나로 dedupe하거나 권한 필터를 최종 rank 뒤로 미룬다.

## 더 파고들 거리

- RRF k가 작고 큰 경우 상위 rank 차이와 긴 목록의 영향이 어떻게 달라지는지 비교해 보세요.
- raw score calibration을 percentile로 할 때 query language bucket별 drift를 어떻게 감시하겠습니까?
- lexical과 dense가 서로 다른 document version을 반환할 때 canonical ID와 freshness를 어떻게 고정하겠습니까?

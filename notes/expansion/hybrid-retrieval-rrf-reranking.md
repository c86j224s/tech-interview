---
id: hybrid-retrieval-rrf-reranking
title: 하이브리드 검색의 RRF와 재랭킹
topic: 머신러닝 검색
summary: >-
  lexical·dense 결과의 score scale이 다를 때 rank fusion으로 합치고 cross-encoder 후보 비용을
  배분합니다.
questionIds: []
prerequisites:
  - search-mapping
  - top-k-ranking
  - classification-metrics
related:
  - top-k-ranking
reviewedAt: '2026-09-19'
---
# 하이브리드 검색의 RRF와 재랭킹

하이브리드 검색은 서로 다른 신호를 한 순위로 만드는 문제입니다. BM25는 term 일치와 corpus 통계를 반영하고, dense retriever는 임베딩 공간의 의미적 근접성을 반영하므로 원시 score의 단위와 분포가 대개 같지 않습니다. 이때 단순 합산은 query별로 어느 retriever가 숫자 범위가 넓은지에 따라 결과가 흔들릴 수 있습니다. Reciprocal Rank Fusion(RRF)은 각 결과 목록의 순위에서 기여를 계산해 scale 의존성을 줄이고, 이후 cross-encoder reranker는 제한된 후보에 더 비싼 쌍별 판단을 적용합니다.

## 서로 다른 retriever의 후보 의미

첫 단계 lexical retriever는 query term과 문서 term의 일치를 이용해 후보를 만듭니다. dense retriever는 query와 문서 embedding의 cosine 또는 inner product 같은 유사도를 사용합니다. 한 query에서 BM25 score가 12, dense score가 0.80일 수 있고, 다른 query에서는 BM25가 2, dense가 0.79일 수 있습니다. `0.5*BM25 + 0.5*dense`는 두 숫자의 의미와 범위를 정규화하지 않으므로 첫 query에서는 lexical이 압도하고 두 번째 query에서는 weight가 전혀 다른 효과를 낼 수 있습니다.

이 문제는 “BM25가 옳고 dense가 틀렸다”가 아니라, raw score를 동일 좌표계로 놓았다는 가정이 검증되지 않았다는 뜻입니다. 점수 calibration을 한다면 query 분포와 label로 변환 함수를 학습하고 drift를 감시해야 합니다. calibration을 하지 않으면서 가중치만 손으로 정하면 특정 query 유형에만 맞는 결과가 될 수 있습니다.

## RRF 순위 기여 계산

RRF는 각 retriever가 문서에 부여한 raw score 대신 rank를 사용합니다. 흔히 다음 형태로 설명합니다.

```text
RRF(d) = Σ_i 1 / (k + rank_i(d))
```

여기서 `i`는 retriever, `rank_i(d)`는 해당 목록에서의 1-based rank, `k`는 rank constant입니다. 문서가 lexical 1위와 dense 10위이고 `k=60`이면 기여는 `1/61 + 1/70 ≈ 0.03065`입니다. 다른 문서가 lexical 20위와 dense 2위라면 `1/80 + 1/62 ≈ 0.02863`입니다. 첫 문서가 조금 앞서지만, 두 목록 모두에서 상위권인 문서를 우대하는 방식으로 읽을 수 있습니다.

문서가 한 목록에만 있을 때 다른 목록의 기여를 0으로 두는 것은 이 문서에서 채택한 union 구현 convention입니다. 제공된 Waterloo PDF는 이번 검토에서 redirect 후 본문을 읽지 못했으므로 이 convention을 논문의 직접 문장으로 인용하지 않습니다. 동일 문서 ID가 두 목록에 나오면 ID 기준으로 dedupe하고 각 rank 기여를 합쳐야 합니다. 제목이 같다는 이유만으로 서로 다른 문서를 합치면 안 되며, canonical document ID와 index version을 사용합니다.

```diagram
{"title":"하이브리드 검색 단계","caption":"각 retriever의 후보를 ID로 합친 뒤 rank fusion과 비싼 재랭킹을 분리합니다.","rows":[[{"id":"lexical","label":"BM25 후보","detail":["term rank"]},{"id":"dense","label":"Dense 후보","detail":["vector rank"]}],[{"id":"union","label":"union · dedupe","detail":["문서 ID"]}],[{"id":"rrf","label":"RRF 순위","detail":["rank constant"]}],[{"id":"rerank","label":"cross-encoder","detail":["후보 K개"]}],[{"id":"final","label":"최종 top-k","detail":["정밀도"]}]],"edges":[{"from":"lexical","to":"union","label":"목록 전달"},{"from":"dense","to":"union","label":"목록 전달"},{"from":"union","to":"rrf","label":"rank 결합"},{"from":"rrf","to":"rerank","label":"후보 절단"},{"from":"rerank","to":"final","label":"재정렬"}]}
```

## RRF의 rank constant와 경계

`k`가 작으면 1위와 2위 차이의 상대적 영향이 커지고, `k`가 크면 긴 순위 구간의 기여가 완만해집니다. 다만 어떤 `k`가 보편적으로 옳다는 뜻은 아닙니다. retriever별 cutoff가 서로 다르면 50위 밖 문서는 목록에 존재하지 않는 것으로 처리되며, rank와 “검색되지 않음”을 같은 값으로 넣는 실수를 피해야 합니다.

RRF는 raw score scale을 맞추지 않아도 된다는 장점이 있지만, relevance의 의미를 자동으로 calibration하지는 않습니다. lexical 목록이 동의어·정확 ID에서 강하고 dense 목록이 자연어 paraphrase에서 강하다면, 둘의 union을 충분히 유지해야 상호 보완이 일어납니다. 반대로 한 목록이 독성·권한·tenant 필터를 통과하지 못한 문서를 포함하면 fusion 전에 필터를 적용하거나, 보안 조건을 최종 rank보다 앞에 두어야 합니다.

## 후보 pool과 coverage

최종 reranker는 first-stage가 반환한 후보만 볼 수 있습니다. 정답 문서가 lexical 80위, dense 15위라면 lexical top-50과 dense top-50의 union에는 들어오므로 reranker가 볼 기회가 있습니다. 반대로 dense top-10만 사용하면 해당 문서가 빠져 reranker가 아무리 정확해도 복구할 수 없습니다. 이 성질을 candidate recall 또는 first-stage recall로 측정합니다.

`K_l=50`, `K_d=50`일 때 union의 최대 크기는 100이지만 같은 ID가 겹치면 더 작습니다. 실제 union이 72개라면 dedupe 이후 cross-encoder에 72개를 모두 보낼지, RRF top-30만 보낼지 선택합니다. 정답이 union 밖에 있으면 final NDCG가 낮아진 원인은 reranker가 아니라 candidate miss입니다. 따라서 최종 클릭률이나 NDCG만 보고 first-stage 누락을 숨기지 말고, exact 또는 충분히 큰 pool과 비교해 단계별 recall을 기록합니다.

후보 폭을 키우면 recall은 늘 가능성이 있지만 네트워크, embedding lookup, reranker 시간과 메모리가 증가합니다. 특히 cross-encoder는 query-document 쌍마다 토큰화와 attention을 수행하므로 후보를 50에서 200으로 늘리면 단순히 최종 k가 같아도 rerank workload가 네 배 방향으로 커질 수 있습니다. 실제 배수는 batch, sequence length, accelerator와 padding에 좌우됩니다.

## Cross-encoder 재랭킹 예산

Bi-encoder dense retrieval은 문서 임베딩을 미리 계산하고 query와 빠르게 비교할 수 있지만, query와 문서의 세밀한 상호작용을 제한된 표현에 압축합니다. Cross-encoder는 두 텍스트를 함께 입력해 relevance score를 계산하므로 더 표현력이 있을 수 있으나 문서마다 다시 모델을 실행해야 합니다. 따라서 모든 corpus가 아니라 first-stage union 후보에만 적용하는 단계적 구조가 일반적입니다.

예를 들어 lexical/dense 각각 100개를 union해 최대 200개가 나오고, RRF 상위 50개만 cross-encoder에 보낸다고 합시다. `recall@200`은 후보 단계가 정답을 얼마나 포함했는지, `NDCG@10`은 rerank 후 상위 10개 순서가 얼마나 좋은지 나타냅니다. 200개 전체의 candidate recall은 높지만 rerank 50에서 정답이 잘릴 수 있으므로, RRF cutoff 전후의 metric을 나눠 보아야 합니다.

실무 trace에는 `retrieve_ms`, `dedupe_count`, `rrf_ms`, `rerank_count`, `rerank_ms`, `total_ms`, p95/p99, query timeout, first-stage recall, NDCG@10을 넣습니다. 평균 latency만 보면 긴 query나 accelerator queue에서 발생한 tail이 숨습니다. 후보 수를 고정했더라도 문서 길이가 길어 batch padding 비용이 늘 수 있으므로 token count도 함께 기록합니다.

## 점수 결합과 재현성

RRF 결과를 정렬할 때 동일한 RRF 점수의 문서에 canonical ID 같은 deterministic tie-breaker를 둡니다. retriever가 결과 순서를 보장하지 않거나 동일 점수 순서를 임의로 반환하면 같은 query의 최종 결과가 흔들릴 수 있습니다. union 과정에서 alias version이 섞이면 문서 본문과 embedding version이 서로 다를 수 있으므로 index version을 trace에 붙입니다.

raw weighted sum을 선택하는 경우에는 calibration set에서 BM25와 dense score를 같은 확률·percentile·z-score 공간으로 변환했는지, 변환이 query length와 language bucket에서 안정적인지 확인합니다. RRF는 이런 학습을 요구하지 않지만, score semantics와 business constraints를 해결하지 않습니다. 예를 들어 특정 필드 exact match를 반드시 위로 올려야 한다면 RRF 결과 뒤에 무조건적인 업무 규칙을 덧대기보다, 정답 계약과 tie policy를 먼저 정의합니다.

## 실패 사례와 검증 설계

첫 번째 실패는 서로 다른 cutoff를 사용하면서 누락을 0점으로만 계산하지 않고 실제 rank처럼 취급하는 것입니다. 두 번째는 duplicate document를 ID가 아닌 제목으로 제거하는 것입니다. 세 번째는 candidate recall을 측정하지 않고 reranker의 NDCG만 보고 cross-encoder 모델을 교체하는 것입니다. 네 번째는 p50만 보고 rerank K를 키워 p99와 throughput을 악화시키는 것입니다.

검증용 query set에는 lexical-only 정답, dense-only 정답, 두 목록에 공통으로 있는 정답, 50위 밖 정답, 중복 문서, 긴 문서를 포함합니다. exact 또는 매우 큰 candidate pool을 oracle처럼 사용하되, 그것이 제품의 정답 라벨과 동일하다고 과장하지 않습니다. `K_l`, `K_d`, RRF `k`, rerank K를 grid로 sweep하면서 candidate recall, NDCG/MRR, p95/p99, QPS, 비용을 표로 남깁니다.

## 비용·한계와 참고 자료

RRF의 핵심 장점은 서로 비교하기 어려운 raw score를 직접 합산하지 않고 rank contribution을 결합한다는 점입니다. 그러나 목록의 cutoff 밖에 있던 정답을 되살리지 못하고, duplicate identity·필터·권한·시간 버전·tie-breaker 계약을 대신하지 않습니다. Cross-encoder는 정밀도를 높일 여지가 있지만 후보마다 실행 비용이 있어 first-stage recall과 latency 예산을 함께 설계해야 합니다.

RRF의 출발점은 [Cormack, Clarke, Buettcher의 SIGIR 2009 논문](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)이지만, 이번 환경에서는 PDF 본문을 readable하게 확인하지 못했습니다. 따라서 식·missing-rank 처리는 명시적 구현 모델이며 특정 API의 확인 결과가 아닙니다. 논문은 rank-based fusion의 원리를 제공하지만 특정 Elasticsearch/OpenSearch/vector engine의 최신 RRF API나 cross-encoder runtime 기본값을 고정하지 않습니다. 실제 배포에서는 사용 중인 엔진 버전과 모델 serving 계약을 읽고, 위 단계별 trace로 품질·지연·비용을 검증합니다.

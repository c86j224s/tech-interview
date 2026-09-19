---
id: mlsearch-hybrid-rrf-candidate-coverage
title: 각 retriever top-50만 RRF에 넣을 때 최종 top-10 recall이 낮아지는 조건은 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - hybrid retrieval
  - candidate recall
  - RRF
related:
  - distributed-topk-merge-complexity
  - ml-classification-metrics
---
# 각 retriever top-50만 RRF에 넣을 때 최종 top-10 recall이 낮아지는 조건은 무엇인가요?

## 구두 답변

RRF와 reranker는 입력 후보만 재정렬할 수 있으므로 relevant 문서가 lexical·dense 두 목록의 top-50 union에 없으면 최종 top-10에서 복구할 수 없습니다. 정답이 lexical 80위, dense 15위라면 dense top-50에 들어와 후보가 되지만, dense cutoff가 10이면 first-stage에서 사라집니다. 그래서 per-retriever recall, union recall, RRF cutoff 뒤 recall을 단계별로 측정해야 합니다.

`K_l=50`, `K_d=50`이면 union 최대는 100개입니다. 위 정답은 lexical에는 없지만 dense에는 있어 union에 포함되고, RRF가 상위 30개만 rerank로 보내면 그 30개 안에 남았는지 다시 확인해야 합니다. 반대로 relevant 문서가 lexical 80위·dense 80위면 두 top-50 밖이라 RRF가 아무리 정확해도 누락입니다. 이때 최종 NDCG 하락을 reranker 모델 탓으로 돌리면 first-stage miss를 숨깁니다.

검증은 exact 또는 큰 pool을 기준으로 query bucket별 candidate recall@50/union recall@100/rerank recall과 NDCG@10을 기록합니다. lexical-only, dense-only, 공통 정답, 긴 문서, filter 희소 query를 포함하고 K를 늘릴 때 p95/p99·전송량·rerank 비용이 어떻게 증가하는지도 함께 봅니다.


단계를 숫자로 분리하겠습니다. 정답 R이 lexical 80위·dense 15위이면 top-50별 recall은 0과 1, union recall은 1입니다. union이 overlap 때문에 70개이고 RRF cutoff가 30이면 R이 30위 안에 남을 때만 rerank coverage가 1입니다. R이 lexical 80위·dense 80위면 두 list recall과 union recall이 모두 0이어서 RRF가 복구할 수 없습니다. 그래서 final NDCG 하락을 reranker 탓으로 돌리기 전 per-list, union, cutoff, final 분모를 각각 기록합니다. 후보 K 증가에 따른 network와 p99도 함께 봅니다.
## 득점 포인트

- reranker가 후보 밖 문서를 복구할 수 없다는 단계적 한계를 설명한다.
- lexical 80위·dense 15위와 두 목록 80위 반례를 비교한다.
- per-list, union, RRF cutoff, final ranking의 recall을 분리 측정한다.

## 감점 포인트

- 최종 top-10 결과만 보고 first-stage recall도 높다고 말한다.
- top-50 union이면 모든 relevant 문서를 포함한다고 가정한다.
- 후보 K를 키울 때 recall만 보고 network·rerank tail 비용을 무시한다.

## 더 파고들 거리

- lexical과 dense 후보가 80% 중복될 때 union coverage를 높일 K 배분을 어떻게 정하겠습니까?
- relevant 문서가 filter 후에만 희소해지는 query bucket을 어떤 방식으로 별도 평가하겠습니까?
- RRF top-30 절단이 후보 recall을 떨어뜨릴 때 rerank K와 모델 batch를 어떻게 조절하겠습니까?

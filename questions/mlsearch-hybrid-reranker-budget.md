---
id: mlsearch-hybrid-reranker-budget
title: cross-encoder reranker에서 1차 K와 rerank K를 어떻게 정하고 어떤 지표를 고정하나요?
difficulty: 중하
category: 머신러닝
tags:
  - hybrid retrieval
  - reranking
  - latency
related:
  - ranking-global-topk
  - observability-histogram-aggregation
---
# cross-encoder reranker에서 1차 K와 rerank K를 어떻게 정하고 어떤 지표를 고정하나요?

## 구두 답변

1차 K는 relevant 문서를 후보에 포함하는 first-stage recall 예산으로, rerank K는 cross-encoder가 실제로 처리할 비용 예산으로 정합니다. 두 값은 같을 필요가 없습니다. 예를 들어 lexical/dense union 200개를 만들고 RRF 상위 50개만 재랭킹한다면, candidate recall@200과 rerank recall@50, NDCG@10, p95/p99, throughput을 같은 query set에서 함께 기록해야 합니다. NDCG만 좋아지고 후보 누락이나 tail latency가 악화되면 그 설정을 채택하지 않습니다.

cross-encoder는 query와 문서를 함께 입력해 후보마다 score를 계산하므로 rerank K를 50에서 200으로 늘릴 때 대략 처리 쌍이 네 배 방향으로 커집니다. 실제 latency는 token length, batch padding, accelerator queue에 좌우됩니다. union 후보 수·dedupe 수·rerank count·모델 token 수를 trace에 넣겠습니다. relevant 문서가 RRF top-50 밖에 있으면 모델이 좋아도 복구할 수 없습니다.

선택은 오프라인 label query로 K grid를 돌리고, candidate recall/NDCG와 운영 SLA를 함께 보는 방식입니다. p99가 초과하면 무조건 first-stage K를 줄이지 않고, 후보 overlap·query length bucket·reranker batch를 나눠 비용 원인을 찾습니다. 특정 모델·엔진 기본값은 고정하지 않고 실제 serving 버전에서 측정합니다.


후보와 처리량을 한 trace로 묶습니다. union 200개에서 rerank 50개를 고르면 candidate recall@200은 높을 수 있지만 정답이 RRF 51위면 rerank coverage는 0입니다. 128 token 문서라면 50개는 6,400 token, 200개는 25,600 token이므로 네 배 방향의 입력입니다. 실제 p99는 batch padding과 accelerator queue에 따라 달라집니다. timeout으로 50개 중 37개만 처리되면 상태를 partial로 표시하고 미처리 후보를 기존 RRF 순서로 유지할지 정책을 정해야 합니다. complete 결과와 섞어 NDCG를 계산하면 운영 품질을 과대평가합니다.
## 득점 포인트

- first-stage recall용 K와 cross-encoder 비용용 rerank K를 구분한다.
- candidate recall@200, rerank recall@50, NDCG@10, p95/p99, throughput을 단계별로 기록한다.
- 50→200 후보 증가의 모델 workload와 token/batch tail을 추적한다.

## 감점 포인트

- 최종 NDCG 하나만 보고 K를 선택한다.
- 후보 밖 정답을 cross-encoder가 다시 찾을 수 있다고 말한다.
- 평균 latency만 보고 p99·timeout·throughput을 무시한다.

## 더 파고들 거리

- query 길이별로 같은 rerank K의 비용이 달라질 때 SLA를 어떻게 분리하겠습니까?
- 후보 overlap이 큰 두 retriever에서 union K를 줄여도 recall을 유지하는지 어떤 실험으로 확인하겠습니까?
- reranker timeout으로 일부 후보만 처리되었을 때 결과 상태와 metric을 어떻게 표시하겠습니까?

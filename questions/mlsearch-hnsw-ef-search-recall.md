---
id: mlsearch-hnsw-ef-search-recall
title: HNSW efSearch를 늘리면 recall과 latency에 어떤 변화가 생기나요?
difficulty: 중하
category: 머신러닝
tags:
  - HNSW
  - efSearch
  - recall
related:
  - graph-representation
  - ranking-global-topk
---
# HNSW efSearch를 늘리면 recall과 latency에 어떤 변화가 생기나요?

## 구두 답변

`efSearch`를 키우면 HNSW가 질의 중 유지하고 확장하는 후보 폭이 넓어져 exact top-k를 포함할 가능성이 커집니다. 대신 더 많은 정점의 distance를 계산하고 후보 heap을 갱신하므로 CPU·메모리 접근과 특히 tail latency가 늘어날 수 있습니다. 다만 ef가 커진 만큼 recall이 정확히 단조 증가하거나 latency가 선형 증가한다고 단정하지는 않겠습니다. 같은 query set, 필터, index, warm-up 조건에서 exact baseline과 `ef=32,128,512`를 비교해 판단합니다.

예를 들어 `k=10`인 1M vector index에서 exact 결과를 먼저 저장한 뒤 각 ef를 측정합니다. ef=32에서 평균 distance 계산 10,000회, recall@10 0.94, p99 18ms이고 ef=128에서 계산 30,000회, recall 0.98, p99 31ms가 나왔다면 품질과 tail을 함께 보고 128을 선택할 수 있습니다. 숫자는 설명용 측정 계획이지 실행 결과가 아닙니다. p50만 좋아 보이고 p99가 SLA를 넘으면 후보 폭을 줄이거나 admission·캐시·필터 설계를 다시 봅니다.

필터가 있으면 unfiltered recall을 그대로 믿지 않습니다. 허용 문서가 희소하면 graph 상 가까운 후보가 필터에서 제거되어 ef를 늘려도 필요한 문서까지 못 갈 수 있습니다. tenant·언어·기간별 recall과 candidate count를 분리해 보겠습니다.


작은 상태를 직접 그리면 차이가 분명합니다. k=2이고 시작 후보가 u(거리 0.20), v(0.35), w(0.40)라면 visited에는 entry와 이웃이 들어가고 result heap 경계는 0.35입니다. u를 확장해 x(0.18)를 발견하면 경계가 0.20으로 바뀌지만, ef가 작아 v만 유지한 구현에서는 x로 이어지는 경로를 확장하지 못할 수 있습니다. ef를 넓히면 후보가 더 오래 살아남아 이 경로를 발견할 기회가 커집니다. 운영 판단은 `ef=32,128,512`를 같은 query set에서 실행해 exact filtered oracle 대비 recall@10, 거리 계산 수, p95/p99, QPS를 함께 보는 것입니다. 필터가 0.1%만 허용하면 unfiltered recall을 보고 안심하지 않고 tenant별 oracle을 다시 만듭니다. 아래 수치는 측정 결과가 아닌 설명용 trace입니다.
## 득점 포인트

- efSearch가 후보 유지·확장 예산이며 k나 결과 개수와 같은 값이 아님을 설명한다.
- exact top-k를 기준으로 recall@k를 계산하고 p95/p99와 distance 계산량을 함께 측정한다.
- 필터 selectivity, cache 상태, query set을 고정하지 않으면 recall 비교가 왜곡됨을 짚는다.

## 감점 포인트

- efSearch를 두 배로 하면 recall과 latency가 반드시 두 배가 된다고 단정한다.
- ANN score만 보고 recall을 계산하거나 exact baseline 없이 품질을 말한다.
- 평균 latency만 보고 p99와 필터별 누락을 숨긴다.

## 더 파고들 거리

- `efConstruction`이 다른 두 index에서 같은 efSearch를 비교할 때 어떤 교차 실험을 구성하겠습니까?
- 삭제 tombstone이 후보 traversal에는 남아 있을 때 최종 결과와 recall을 어떻게 분리 측정하겠습니까?
- 필터 결과가 전체의 0.1%뿐일 때 탐색 폭 외에 어떤 index 구조를 검토하겠습니까?

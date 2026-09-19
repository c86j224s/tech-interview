---
id: mlsearch-bm25-analyzer-stats
title: 같은 BM25 파라미터인데 analyzer를 바꾸면 ranking이 달라지는 이유는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - BM25
  - analyzer
  - tokenization
related:
  - elasticsearch-shard-mapping
  - elasticsearch-refresh-visibility
---
# 같은 BM25 파라미터인데 analyzer를 바꾸면 ranking이 달라지는 이유는 무엇인가요?

## 구두 답변

BM25가 받는 입력은 원문이 아니라 analyzer가 만든 token과 그로부터 계산한 `tf`, `df`, `dl`, `avgdl`입니다. 따라서 lowercase, stemming, stopword, synonym을 바꾸면 같은 `k1`, `b`라도 term 일치 여부와 통계가 달라져 ranking이 달라집니다. `Running Shoes`를 lowercase하면 `[running, shoes]`가 되고, stemming을 쓰면 `[run, shoe]`가 될 수 있으며, stopword 제거는 field length도 바꿉니다. index analyzer와 search analyzer의 token stream도 맞춰야 합니다.

예를 들어 문서가 `Running shoes for running`이고 query가 `running shoes`라면 whitespace·lowercase analyzer에서는 running이 2회, shoes가 1회이고 `for`까지 길이에 포함될 수 있습니다. stopword 제거 후 길이가 줄고, stemming은 query와 document를 같은 root로 바꿔야 매칭됩니다. synonym이 graph를 만드는 경우 term overlap과 score 해석은 엔진 계약을 읽어야 하므로 파라미터 튜닝으로 숨기지 않겠습니다.

변경 실험은 `_analyze`로 index/search token stream, corpus의 df·평균 길이, 대표 query의 결과 rank와 score를 before/after 표로 저장합니다. analyzer가 바뀌었는데 기존 BM25 결과와 같은지 기대하는 것이 아니라, 왜 바뀌었고 recall·precision에 어떤 방향인지 label로 검증하겠습니다.


중간 통계를 표로 고정하면 원인이 분명합니다. lowercase 뒤 문서 token은 `[running,shoes,for,running]`, stopword 제거 뒤는 `[running,shoes,running]`이어서 dl이 4에서 3으로 줄어듭니다. stemming이 여러 문서의 running을 run으로 합치면 해당 term의 df가 커져 IDF가 낮아질 수 있습니다. index analyzer만 stemming하고 search analyzer를 그대로 두면 query token `[running]`과 index token `[run]`이 달라져 recall이 0이 될 수 있습니다. 변경 전후 token·tf·df·dl·rank를 저장하고 k1/b 실험과 분리합니다.
## 득점 포인트

- analyzer가 tf·df·dl을 바꿔 BM25 입력 자체를 바꾼다는 인과를 설명한다.
- Running Shoes 예에서 lowercase·stemming·stopword의 중간 token 상태를 제시한다.
- index/search analyzer와 token stream, relevance metric을 함께 검증한다.

## 감점 포인트

- BM25 파라미터가 같으면 analyzer가 달라도 같은 순위라고 말한다.
- 원문 글자 수만 보고 field length가 같다고 한다.
- index analyzer와 search analyzer의 불일치를 단순한 query boost 문제로 본다.

## 더 파고들 거리

- synonym graph가 tf·position·length에 미치는 영향을 어떤 explain 항목으로 확인하겠습니까?
- analyzer 변경과 k1/b 변경을 동시에 배포하지 않으려면 실험 설계를 어떻게 나누겠습니까?
- 다국어 field에서 한 analyzer로 모든 언어를 처리할 때 df와 길이 통계를 어떻게 비교하겠습니까?

---
id: mlsearch-embedding-hubness
title: 소수 문서가 많은 query의 top-K에 반복 등장할 때 cosine 오류인지 어떻게 진단하나요?
difficulty: 중하
category: 머신러닝
tags:
  - embedding
  - hubness
  - retrieval quality
related:
  - ml-classification-metrics
  - ranking-global-topk
---
# 소수 문서가 많은 query의 top-K에 반복 등장할 때 cosine 오류인지 어떻게 진단하나요?

## 구두 답변

반복 등장만으로 cosine 오류나 ANN bug라고 결론내리지 않고 exact 기준, 벡터 분포, 데이터 중복을 순서대로 분리합니다. 10,000 query의 top-10이면 전체 이웃 출현은 100,000회입니다. 문서 X가 8,000회, Y가 6,000회, 나머지가 넓게 분산된다면 X/Y의 빈도를 norm, 평균 각도, duplicate rate, query domain과 함께 기록합니다. cosine은 norm 차이를 제거하지만 모든 벡터가 특정 방향에 몰리는 anisotropy나 중복 문서까지 제거하지는 않습니다.

먼저 작은 query 표본에 exact brute-force를 실행해 X/Y가 같은 비율로 반복되는지 봅니다. exact와 ANN이 모두 반복되면 공간·데이터 현상을 먼저 의심하고, ANN에서만 반복되면 graph 탐색 파라미터, ef, shard routing, filter, quantization을 exact 결과와 대조합니다. ANN top-K와 exact top-K의 recall@K, overlap, score 차이를 domain별로 저장합니다. 인기 문서가 실제 relevance가 높을 수도 있으므로 frequency만으로 실패를 정의하지 않습니다.

보편적인 “출현률 몇 퍼센트면 hubness” 임계값은 없습니다. labeled query의 nDCG·recall과 slice별 결과가 악화됐는지, ANN이 oracle을 놓치는지에 따라 조치합니다. exact에서도 성능이 나쁘면 mean-centering·whitening·hard negative·diversity reranking을 baseline과 비교하되, 각각 relevance 의미와 계산 비용을 바꾼다는 점을 기록합니다.

예를 들어 exact 결과에서 X가 8,000회인데 labeled relevance가 높고 ANN도 같은 결과라면 빈도는 인기와 품질이 함께 만든 현상일 수 있습니다. 반대로 exact는 균등한데 ANN만 X에 8,000회 몰리면 탐색 파라미터나 shard 문제의 우선순위가 올라갑니다. 이처럼 빈도와 oracle 차이를 함께 보아야 모델 완화와 인덱스 수정을 잘못 선택하지 않습니다.

## 득점 포인트

- 전체 출현 수 100,000과 X/Y 빈도 예시를 계산해 반복 현상을 정량화합니다.
- exact brute-force와 ANN 결과를 비교해 공간 현상과 index 오류를 분리합니다.
- hubness·anisotropy를 진단 개념으로 두고 보편적 cutoff가 없음을 명시합니다.

## 감점 포인트

- 반복 top-K만으로 ANN bug 또는 relevance 성공을 단정합니다.
- cosine이 anisotropy와 중복을 자동 제거한다고 합니다.
- 읽은 cosine 문서만으로 hubness 임계값을 발명합니다.

## 더 파고들 거리

- 정확 검색에서 반복되는 허브를 완화할 때 recall·diversity·latency trade-off를 비교해 보세요.
- tenant·언어·문서 길이별 frequency와 labeled metric을 어떤 대시보드로 감시할지 설계해 보세요.

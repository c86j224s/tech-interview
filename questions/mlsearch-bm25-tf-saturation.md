---
id: mlsearch-bm25-tf-saturation
title: 같은 term이 1번과 20번 나와도 BM25 점수가 20배가 되지 않는 이유는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - BM25
  - TF saturation
  - IDF
related:
  - elasticsearch-docvalues-inverted-index
  - ranking-global-topk
---
# 같은 term이 1번과 20번 나와도 BM25 점수가 20배가 되지 않는 이유는 무엇인가요?

## 구두 답변

BM25는 term frequency를 선형으로 곱하지 않고 `k1`이 들어간 포화식으로 반영하기 때문입니다. 길이 보정과 term의 IDF도 함께 들어가므로 같은 term을 20번 반복해도 1번 문서의 정확히 20배가 되지 않습니다. 길이 항을 1로 두고 `k1=1.2`라면 TF 부분은 `tf=1`에서 1, `tf=5`에서 약 1.77, `tf=20`에서 약 2.08입니다. 20배 반복은 이 부분의 약 2.08배이지 20배가 아닙니다.

식은 `tf*(k1+1)/(tf+k1*(1-b+b*dl/avgdl))`입니다. 실제 문서가 평균 길이이고 `b=.75`라면 길이 항이 1이 되어 위 계산을 그대로 볼 수 있습니다. IDF는 두 문서에서 같은 term이면 같지만, 문서 길이가 다르면 denominator가 달라집니다. 긴 문서의 같은 20회는 term 밀도가 낮다고 보정될 수 있습니다.

이 score를 확률이나 query 간 절대 척도로 해석하지도 않겠습니다. 같은 query와 field에서 상대 순위를 비교하고, analyzer가 반복 token을 실제로 어떻게 만들었는지와 `explain` 결과를 확인합니다. `k1`, `b`를 조정할 때는 synthetic tf 1/5/20과 실제 relevance label, latency를 함께 봅니다.


길이 항을 포함한 반례도 함께 봐야 합니다. `k1=1.2,b=.75,avgdl=100,tf=3`인 dl=100 문서는 TF 부분이 1.571이지만 dl=1000 문서는 길이 항 7.75, 분모 12.3, TF 부분 약 0.537입니다. 따라서 tf만 늘려 선형 증가한다고 말하면 길이 정규화를 놓칩니다. analyzer가 synonym을 추가하면 같은 원문도 token 수와 tf가 바뀔 수 있으므로 `_analyze`와 explain을 나란히 저장합니다. 이 score는 같은 query·field 안에서만 비교하고 다른 query의 raw score를 확률처럼 합치지 않습니다.
추가로 같은 문서에서 tf=20을 만들기 위해 term을 반복하면 문서 길이 dl도 함께 늘어날 수 있습니다. 그러면 포화 이득만 보는 실험과 실제 편집 문서의 효과가 달라집니다. 반복이 relevance를 높이는지, keyword exact 일치인지, 단순 spam인지 label을 나누어 k1을 선택해야 합니다.

## 득점 포인트

- TF saturation 식과 k1의 역할을 설명한다.
- `k1=1.2`에서 tf 1·5·20의 중간 계산을 제시한다.
- IDF·길이 보정·analyzer를 함께 보며 raw score를 확률로 오해하지 않는다.

## 감점 포인트

- BM25가 term 빈도를 그대로 선형 합산한다고 말한다.
- 같은 term이면 문서 길이와 analyzer가 점수에 영향을 주지 않는다고 한다.
- 다른 query의 BM25 12와 8을 절대적인 관련성 순서로 비교한다.

## 더 파고들 거리

- `b=.75`에서 평균 길이의 10배인 문서가 tf=3일 때 TF 항이 어떻게 바뀌는지 계산해 보세요.
- analyzer synonym이 term frequency와 field length에 미치는 영향을 어떻게 분리 측정하겠습니까?
- score 설명에서 query boost와 field boost가 BM25 항과 어떻게 합쳐지는지 확인해 보세요.

---
id: mlsearch-embedding-cosine-dot
title: 'L2 정규화된 임베딩에서 cosine과 dot 순위가 같고, 정규화 전에는 왜 다른가요?'
difficulty: 중하
category: 머신러닝
tags:
  - embedding
  - cosine
  - dot product
related:
  - ranking-global-topk
  - elasticsearch-docvalues-inverted-index
---
# L2 정규화된 임베딩에서 cosine과 dot 순위가 같고, 정규화 전에는 왜 다른가요?

## 구두 답변

두 벡터가 모두 nonzero이고 L2 norm이 1이면 `q·d = q·d/(||q||||d||)`, 즉 dot과 cosine이 같은 숫자라 순위도 같습니다. 정규화 전에는 dot이 방향과 크기를 함께 반영합니다. `q=[1,0]`, `a=[3,0]`, `b=[1,1]`이면 dot은 a=3, b=1이고 cosine은 a=1, b=`1/√2≈0.7071`이라 a가 앞섭니다. 여기서는 방향이 정확히 같은 a가 두 metric에서 모두 이겼습니다.

순위가 뒤집히는 실제 반례는 `q=[1,0]`, `a=[2,2]`, `b=[1,0]`입니다. dot은 a=2, b=1이라 a를 고르지만, cosine은 a=`2/√8=0.7071`, b=1이라 b를 고릅니다. a의 큰 norm이 dot에서 얻은 이득을 cosine이 제거한 것입니다. 따라서 normalization은 단순 수치 안정화가 아니라 문서 크기를 relevance 신호로 인정할지 결정하는 선택입니다.

구현에서는 query와 document에 같은 normalization contract를 적용하고 shape·finite·dimension·zero norm을 먼저 검사합니다. norm=0이면 cosine이 정의되지 않으므로 임의의 0 score를 정상 relevance로 저장하지 않습니다. encoder가 문서 길이에 비례해 norm을 키우는지 확인한 뒤, 길이 신호를 보존할 필요가 있으면 raw norm을 별도 진단 필드로 저장합니다. 실제 ANN 엔진의 내부 정규화 여부는 작은 fixture와 버전 문서로 검증합니다.

반대로 norm이 의미 있는 confidence 신호라면 cosine으로 제거한 뒤 성능이 나빠질 수 있으므로, 정규화 전 dot과 후 cosine을 같은 labeled query로 비교합니다. 두 metric을 섞을 때는 score scale을 맞춘다는 이유로 임의 선형 결합을 하기보다 rank fusion이나 학습된 결합기를 별도로 검증합니다. dimension과 revision이 다르면 이 비교표 자체를 만들지 않습니다.

## 득점 포인트

- norm=1일 때 dot과 cosine의 식을 약분해 순위 동일 조건을 제시합니다.
- `q=[1,0],a=[2,2],b=[1,0]`에서 dot 2 대 1, cosine 0.7071 대 1을 계산합니다.
- 정규화를 metric 의미 선택으로 설명하고 zero vector 경계를 둡니다.

## 감점 포인트

- 두 metric에서 실제 순위를 계산하지 않고 norm이 다르다는 이유만으로 순위가 반드시 뒤집힌다고 합니다.
- 모든 dot과 cosine이 언제나 같은 metric이라고 합니다.
- zero norm을 ε으로 나눠 정상 score로 취급합니다.

## 더 파고들 거리

- raw norm이 문서 길이·confidence 중 무엇을 반영하는지 slice별 평가를 설계해 보세요.
- 정규화된 exact dot과 ANN cosine의 top-K overlap을 tolerance와 함께 검증해 보세요.

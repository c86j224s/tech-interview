---
id: mlsearch-embedding-zero-vector
title: encoder가 zero vector를 반환할 때 cosine 검색을 어떻게 처리해야 하나요?
difficulty: 중하
category: 머신러닝
tags:
  - embedding
  - zero vector
  - validation
related:
  - ml-classification-metrics
  - ml-loss-objective
---
# encoder가 zero vector를 반환할 때 cosine 검색을 어떻게 처리해야 하나요?

## 구두 답변

zero vector에서는 norm이 0이라 cosine `q·d/(||q||||d||)`가 수학적으로 정의되지 않습니다. 따라서 query `[0,0]`에 대해 “모든 문서가 0 또는 NaN이 된다”고 런타임 결과를 보편화하면 안 되고, 사용하는 라이브러리가 reject·NaN·0 중 무엇을 하는지 별도로 확인해야 합니다. 서비스 계약은 검색 전에 `length`, `dimension`, finite 여부를 확인하고 `norm <= ε`이면 `invalid_embedding`으로 거절하거나 제품이 정한 키워드·최근 문서 fallback으로 보내는 방식이 안전합니다.

문서 벡터가 zero이면 해당 문서를 색인 거절하거나 quarantine으로 보내고, 원인을 빈 입력·tokenization 실패·overflow·dtype 변환으로 나눠 카운트합니다. `v/(norm+ε)`처럼 계산하면 값은 만들어지지만 방향이 없는 벡터에 임의의 relevance를 부여한 것이므로 정상 score로 저장하지 않습니다. ε은 매우 작은 유효 벡터의 수치 경계를 정할 때만 쓰고, zero의 의미를 숨기는 데 쓰지 않습니다.

테스트 fixture에는 query zero, document zero, norm이 ε보다 조금 큰 벡터, NaN, 차원 부족을 넣습니다. 기대 결과는 metric 계산 전에 명시적 상태 코드와 로그가 생기는 것입니다. fallback을 제공한다면 응답에 “vector search unavailable” 상태를 남겨 무작위 top-K가 성공 검색처럼 보이지 않게 하고, zero 비율이 임계선을 넘으면 encoder 배포를 중단합니다.

document zero를 조용히 제외하면 색인 건수와 검색 coverage가 달라지므로 전체 문서 수, reject 수, fallback 요청 수를 함께 노출합니다. query reject가 사용자 경험을 해친다면 fallback의 결과가 vector similarity가 아님을 응답에 표시합니다. 작은 norm을 zero로 볼 ε은 dtype과 모델 분포에 따라 정하고, 고정 숫자를 보편 규칙으로 주장하지 않습니다.

## 득점 포인트

- metric 수준에서 zero cosine이 undefined라는 결론과 구현별 반환 차이를 구분합니다.
- norm·finite·dimension 검사 뒤 reject 또는 명시적 fallback으로 흐름을 제시합니다.
- ε을 정상 relevance로 위장하지 않고 원인별 zero 카운트를 둡니다.

## 감점 포인트

- 모든 library가 zero query에 NaN을 반환한다고 단정합니다.
- zero vector를 0 score로 넣어 임의 top-K를 정상 결과로 표시합니다.
- epsilon을 더하면 의미 있는 방향이 생긴다고 설명합니다.

## 더 파고들 거리

- zero 비율을 model revision·언어·입력 길이별로 나눠 encoder 장애를 조기에 찾는 방법을 설계해 보세요.
- fallback이 검색 품질과 사용자에게 보이는 상태를 어떻게 분리할지 정해 보세요.

---
id: mlsearch-bm25-length-normalization
title: 긴 문서가 같은 term 빈도여도 BM25에서 불리할 수 있는 이유와 b=0/1의 의미는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - BM25
  - document length
  - normalization
related:
  - elasticsearch-docvalues-inverted-index
  - ml-classification-metrics
---
# 긴 문서가 같은 term 빈도여도 BM25에서 불리할 수 있는 이유와 b=0/1의 의미는 무엇인가요?

## 구두 답변

BM25의 `b`는 문서 길이 보정 강도입니다. 분모에 `dl/avgdl`이 들어가므로 같은 term 빈도라도 평균보다 긴 문서는 term 밀도가 낮다고 보고 TF 기여가 줄 수 있습니다. `b=0`이면 길이 보정을 끄고, `b=1`이면 길이 비율을 최대 강도로 반영합니다. 그렇다고 긴 문서가 항상 나쁜 것은 아니며, 제목·설명·법률 문서처럼 길이의 의미가 다른 field마다 실험해야 합니다.

`k1=1.2`, `tf=3`, `b=.75`인 평균 길이 100 문서를 계산하면 길이 항이 1이고 TF 부분은 `6.6/4.2≈1.571`입니다. 길이 1000, 평균 100이면 항은 7.5, 분모는 `3+1.2×7.5=12`, TF 부분은 `6.6/12=.55`입니다. `b=0`이면 두 문서 모두 길이 항 1이라 TF 부분이 같고, `b=1`이면 긴 문서 보정이 더 강해집니다.

실제 판단은 field analyzer가 만든 token 수와 relevance label을 기준으로 합니다. 원문 글자 수로 dl을 추측하지 않고 token stream과 `explain`을 확인합니다. 긴 문서의 상세함 자체가 유용한 제품이라면 높은 b가 오히려 recall을 해칠 수 있어 제목과 본문을 분리하거나 field boost를 조정하겠습니다.


실제 field 선택도 계산에 넣어야 합니다. 제목 field의 평균 token 길이가 5인데 본문을 같은 field에 섞으면 avgdl과 dl 비율이 변해 제목의 tf가 과하게 보정될 수 있습니다. 반대로 법률 본문에서는 긴 문서가 정답일 수 있어 b=.75가 recall을 깎을 수 있습니다. stopword를 제거하면 dl과 avgdl이 함께 바뀌므로 기존 b를 그대로 복사하지 않고 b=0/.75/1을 동일 query label로 재평가합니다. `7.75→12.3→0.5366` trace는 이 판단의 기준이며 실행 측정값은 아닙니다.
따라서 b의 선택은 긴 문서를 벌주는 규칙을 고르는 일이 아니라, 해당 field에서 term density가 relevance와 어떤 관계인지 확인하는 일입니다. 동일 문서의 제목·본문을 분리하고 analyzer가 만든 token 길이를 기록해야 비교가 재현됩니다.

## 득점 포인트

- b=0과 b=1을 길이 보정 강도의 양 끝으로 설명한다.
- `dl/avgdl`이 1과 10인 tf=3 계산으로 방향과 크기를 보인다.
- 문서 길이를 원문 글자 수와 혼동하지 않고 field별 relevance 실험을 제안한다.

## 감점 포인트

- 긴 문서는 BM25에서 항상 낮다고 단정한다.
- b가 term frequency 자체를 바꾸는 값이라고 설명한다.
- b=0이 문서를 짧게 만들거나 b=1이 길이를 삭제한다고 말한다.

## 더 파고들 거리

- analyzer가 stopword를 제거해 dl을 줄일 때 기존 b 튜닝을 왜 다시 해야 합니까?
- 제목·본문 multi-field에서 field별 b와 boost를 어떤 query set으로 비교하겠습니까?
- 긴 문서가 정답인 질의에서 length normalization과 semantic reranking을 어떻게 결합하겠습니까?

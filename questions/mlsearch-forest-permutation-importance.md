---
id: mlsearch-forest-permutation-importance
title: 상관된 두 특징에서 impurity importance와 permutation importance가 다르면 어떤 결론을 보류해야 하나요?
difficulty: 중하
category: 머신러닝
tags:
  - feature importance
  - correlation
  - permutation
related:
  - ml-overfitting-generalization
  - ml-classification-metrics
---
# 상관된 두 특징에서 impurity importance와 permutation importance가 다르면 어떤 결론을 보류해야 하나요?

## 구두 답변
둘 중 하나를 진실값으로 고르지 말고 측정 질문을 구분합니다. MDI는 training tree split에서 줄어든 impurity와 도달 표본 비율을 누적하며, permutation importance는 held-out 자료에서 한 feature를 섞어 score가 얼마나 줄었는지 측정합니다. `city_id`와 `zip_code`가 같은 신호를 담는다면 zip만 섞어도 city가 보완해 held-out score 감소가 작을 수 있습니다. 이는 zip이 무정보라는 뜻이 아니라 단독 제거의 조건부 영향이 작다는 뜻입니다. 반대로 MDI는 먼저 split에 선택된 열에 credit을 몰아줄 수 있고 high-cardinality 편향도 있습니다. 개별 permutation과 group permutation, shuffle 반복 분산, 시간·그룹 slice를 함께 보고 인과 효과나 제거 우선순위로 확대하지 않습니다.


예를 들어 두 열이 거의 복제된 상태에서 기준 held-out AUC가 .90이라고 하겠습니다. zip만 섞은 뒤 .89라면 감소 .01은 zip의 단독 정보가 작다는 뜻이지 두 열을 제거해도 된다는 뜻이 아닙니다. 두 열을 함께 섞어 .90에서 .60으로 내려가면 그룹이 가진 정보는 분명히 큽니다. 반대로 MDI가 zip에 큰 값을 주었다면 training split에서 먼저 선택된 순서와 high-cardinality 후보의 영향일 수 있습니다. permutation의 metric, shuffle 단위, 반복 수를 바꾸면 분산도 달라지므로 평균만 보고 결론을 내리지 않고 confidence interval과 시간·그룹 slice를 함께 봅니다.

상관된 열을 함께 섞을 때도 행 간 관계를 깨는 방식이 도메인상 부적절할 수 있어 group·conditional permutation의 가정을 명시합니다. 중요도가 음수가 되는 경우도 held-out 표본 잡음이나 shuffle 변동일 수 있으므로 단일 실행의 작은 음수만으로 feature가 해롭다고 결론 내리지 않습니다.
## 득점 포인트
- MDI의 training split 통계와 permutation의 held-out score 감소를 구분합니다.
- 상관된 보완 feature가 단독 permutation 효과를 가리는 중간 상태를 설명합니다.
- shuffle 단위·반복·group permutation을 명시하고 결론 범위를 제한합니다.

## 감점 포인트
- importance 순위를 인과 영향이나 feature 제거 순서로 바로 읽습니다.
- train 자료에서 섞은 점수 감소를 일반화 근거로 제시합니다.
- correlated feature 하나의 낮은 permutation만 보고 데이터 누수나 무정보를 단정합니다.

## 더 파고들 거리
- 상관 그룹 크기와 함께 섞는 방식이 importance 분산에 미치는 영향을 측정해 보세요.
- 고카디널리티 무작위 feature를 넣은 대조군으로 MDI 편향을 확인해 보세요.

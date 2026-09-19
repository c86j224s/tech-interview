---
id: mlsearch-boost-multiclass-loss
title: 다중 분류 boosting에서 클래스별 확률 합이 1이 되도록 어떤 출력과 loss를 사용하나요?
difficulty: 중하
category: 머신러닝
tags:
  - gradient boosting
  - multiclass
  - softmax
related:
  - ml-loss-objective
  - ml-classification-metrics
---
# 다중 분류 boosting에서 클래스별 확률 합이 1이 되도록 어떤 출력과 loss를 사용하나요?

## 구두 답변

다중 분류에서는 각 클래스에 대한 additive raw score, 즉 logits를 만들고 multinomial loss와 softmax를 결합해 확률 simplex를 구성합니다. 클래스 score가 `F=[2,1,0]`이면 `p_k=exp(F_k)/Σexp(F_j)`로 변환해 대략 `[.665,.245,.090]`을 얻고 합은 1입니다. 반대로 각 클래스에 독립 sigmoid를 적용하면 각각 0과 1 사이이기는 하지만 합이 1이라는 보장이 없어 상호 배타적인 클래스 확률분포로 바로 해석할 수 없습니다.

부스팅의 다음 단계는 각 클래스 score에 대한 multinomial loss의 음의 gradient를 근사하는 방향으로 추가됩니다. 따라서 “클래스별 잔차를 독립적으로 맞춘다”는 설명만으로는 클래스 간 경쟁과 softmax의 결합을 놓칩니다. 실제 API가 내부적으로 class별 tree를 어떻게 저장하는지와 별개로, 개념상 출력 벡터와 loss가 함께 확률을 정의합니다. 수치 안정성을 위해 logits에서 log-sum-exp 방식으로 loss를 계산하는 구현인지도 확인하겠습니다.

최종 예측은 보통 가장 큰 확률의 argmax이지만, 불균형 비용이나 사람 검토가 있으면 argmax가 곧 운영 행동은 아닙니다. 검증 자료에서 class별 recall·precision, threshold 또는 abstain 정책, 확률 calibration을 따로 평가합니다. softmax 합이 1이라는 형식 조건만으로 확률이 잘 보정됐다고 말하지 않으며, 특정 scikit-learn 릴리스의 기본 설정은 이 자료에서 고정하지 않았습니다.


수치적으로 `exp(2)+exp(1)+exp(0)=7.389+2.718+1=11.107`이므로 확률은 `[.6652,.2447,.0900]`이고 합은 거의 1입니다. 독립 sigmoid라면 같은 logits에서 `[.8808,.7311,.5000]`이 되어 합이 2.1119입니다. 이 차이는 출력 후처리의 취향이 아니라 loss의 결합 구조에서 생깁니다. softmax의 한 클래스 score를 올리면 분모를 통해 다른 클래스 확률이 함께 내려가므로, 각 class tree를 완전히 독립적인 이진 분류기로 해석하면 안 됩니다. 운영 임계값을 바꿀 때도 simplex 제약과 calibration을 별도로 다시 검증해야 합니다.
## 득점 포인트

- raw class score, multinomial loss, softmax의 역할을 분리하고 logits `[2,1,0]`에서 합 1인 확률을 계산합니다.
- 독립 sigmoid는 각 값이 0~1이어도 simplex 확률이 되지 않는다는 반례를 제시합니다.
- argmax와 운영 threshold·abstain·calibration을 분리해 score 출력이 곧 행동은 아님을 설명합니다.

## 감점 포인트

- class별 sigmoid를 합이 1인 다중 분류 확률로 부릅니다.
- softmax 합이 1이라는 형식만으로 확률 calibration과 운영 임계값이 해결됐다고 단정합니다.

## 더 파고들 거리

- 불균형 다중 분류에서 class weight가 softmax score와 calibration에 미치는 영향을 비교해 보세요.
- argmax 대신 abstain 정책을 둘 때 검토 용량과 confusion matrix를 어떻게 계산할지 말해 보세요.

---
id: mlsearch-tree-pruning-path
title: 훈련 정확도 100%인 트리를 cost-complexity pruning으로 줄일 때 α는 어떻게 고르나요?
difficulty: 중하
category: 머신러닝
tags:
  - pruning
  - cost complexity
  - overfitting
related:
  - ml-overfitting-generalization
  - ml-train-validation-test
---
# 훈련 정확도 100%인 트리를 cost-complexity pruning으로 줄일 때 α는 어떻게 고르나요?

## 구두 답변
정확도 100%인 큰 트리에서 alpha를 감으로 정하지 않고 `Rα(T)=R(T)+α|leaves|` 후보 경로를 만든 뒤 validation에서 선택합니다. 가지 `T_t`를 단일 node로 줄이는 지점은 `α_eff=(R(t)-R(T_t))/(|leaves(T_t)|-1)`이고, 가장 작은 weakest link부터 제거하면 nested subtree가 됩니다. 설명용 후보 `(α=.001, leaves=64, val error=.25)`, `(.02,18,.18)`, `(.1,5,.23)`라면 .02를 고릅니다. alpha가 커질수록 validation이 단조 개선되는 것은 아니며, 큰 값은 underfit을 만듭니다. 선택한 alpha와 tree 구조·전처리·threshold를 고정한 후 test를 한 번 평가합니다.


validation error 표를 만들 때는 각 candidate subtree를 같은 validation 행에 적용하고 leaf 수와 train impurity도 함께 저장합니다. 위 예에서 .001은 잎 64개를 유지해 training fit은 좋지만 validation error .25이고, .02는 잎 18개로 줄이면서 .18을 얻어 복잡도 비용을 보상합니다. .1은 더 단순하지만 .23으로 되돌아가므로 pruning이 계속 성능을 개선하지 않습니다. 여러 seed나 fold에서 선택 alpha가 크게 흔들리면 데이터 양이 부족하거나 pruning path가 불안정한 신호일 수 있습니다. 최종 test를 보기 전에 선택 규칙과 tie 처리까지 고정해야 합니다.

사전 제한은 성장 중 후보를 막고 사후 pruning은 이미 만들어진 subtree를 비교하므로 계산 경로와 결과가 같다고 가정하지 않습니다. alpha 선택이 fold마다 흔들리면 단일 숫자를 과신하지 말고 subtree 크기와 validation 분산, 최종 운영 비용을 함께 보고합니다.
## 득점 포인트
- impurity error와 leaf-count penalty의 역할을 식으로 설명합니다.
- effective alpha와 weakest-link 순서가 후보 path를 만드는 과정을 연결합니다.
- train 100%와 validation .25가 일반화 실패 신호일 수 있음을 수치로 구분합니다.

## 감점 포인트
- alpha가 클수록 항상 validation 성능이 좋아진다고 단정합니다.
- test 정확도를 보며 최적 alpha를 다시 고릅니다.
- 사전 깊이 제한과 사후 pruning이 같은 상태·같은 비용을 가진다고 뭉뚱그립니다.

## 더 파고들 거리
- sample weight가 `R(T)`에 들어가면 alpha의 단위와 후보 비교가 어떻게 달라지는지 설명해 보세요.
- pruning path와 nested cross-validation을 결합해 선택 오염을 줄이는 방법을 설계해 보세요.

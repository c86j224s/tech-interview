---
id: mlsearch-scaling-tree-invariance
title: 결정 트리의 표준화 불변성은 어떤 조건에서만 성립하나요?
difficulty: 중하
category: 머신러닝
tags:
  - scaling
  - decision tree
  - invariance
related:
  - ml-train-validation-test
  - ml-overfitting-generalization
---
# 결정 트리의 표준화 불변성은 어떤 조건에서만 성립하나요?

## 구두 답변

axis-aligned 결정 트리가 한 특징의 임계값으로 `x_j≤t`와 `x_j>t`를 나누고, 변환이 `x'_j=a x_j+b`에서 `a≠0`인 일대일 단조 affine 변환이라면 표본 순서와 가능한 partition이 유지됩니다. `[1,2,3]`을 `[100,200,300]`으로 바꾸면 임계값도 함께 이동해 같은 sample split을 만들 수 있습니다. 그래서 결측이 없고 연속값을 같은 방식으로 처리하는 조건에서는 표준화 전후의 tree 구조와 예측이 거의 같을 수 있습니다.

하지만 “항상 완전히 같다”고 단정하면 안 됩니다. 음의 scale은 순서를 뒤집지만 표본 partition과 좌우 child 교환은 보존합니다. binning·quantization은 후보 split을 줄여 실제 결과를 바꿀 수 있습니다. 결측값의 sentinel 또는 missing direction, 동일 값 tie-breaking, float 정밀도, random feature/split 선택도 결과를 바꿀 수 있습니다. 파생 feature가 거리·곱·비율이면 원래 열의 단위만 바꿔도 파생값의 의미가 달라집니다.

검증할 때는 같은 seed와 설정으로 변환 전후 각 노드의 sample ID partition을 비교한 뒤, score 차이가 있으면 missing·tie·binning을 원인으로 좁히겠습니다. 표준화가 불필요해도 train-only fit 원칙은 다른 전처리와 함께 지켜야 하고, 운영 입력의 단위 계약은 명시해야 합니다. 이 불변성은 모델의 split geometry에 대한 조건부 성질이지 파이프라인 전체의 면제권이 아닙니다.


음의 변환을 예외로 세면 안 되는 이유는 partition을 직접 보면 알 수 있습니다. `x=[1,2,3,4]`에서 `t=2.5`는 `{1,2}|{3,4}`를 만들고, `x'=-x=[-1,-2,-3,-4]`에서는 `t'=-2.5`의 양쪽 조건이 `{3,4}|{1,2}`가 됩니다. child의 좌우 이름만 교환됐을 뿐 표본 묶음은 같습니다. 반대로 4개 값을 두 개 bin으로 양자화하면 중간 threshold 후보 자체가 사라져 같은 partition을 보장할 수 없습니다. 그러므로 검증의 첫 단계는 전후 노드별 sample ID 집합 비교이고, 그 뒤에 missing·tie·정밀도·binning을 원인으로 좁혀야 합니다.
## 득점 포인트

- 양의 단조 affine 변환에서 표본 순서와 threshold partition이 유지되는 조건을 설명합니다.
- missing·binning·quantization·tie·float 정밀도·파생 특징이 불변성을 깨는 사례를 구체적으로 듭니다.
- 전후 노드별 sample ID partition을 먼저 비교하고 score 차이의 원인을 좁힙니다.

## 감점 포인트

- 결정 트리는 어떤 scaling과 구현에서도 완전히 같은 score라고 말합니다.
- tree split 불변성을 근거로 전체 preprocessing fit 경계를 무시합니다.

## 더 파고들 거리

- histogram binning과 missing value direction이 scaling 불변성을 깨는 작은 표를 만들어 보세요.
- 파생 거리 feature를 포함한 트리 pipeline의 단위 계약을 어떻게 테스트할지 설명해 보세요.

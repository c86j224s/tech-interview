---
id: mlsearch-tree-missing-routing
title: 학습 때 보지 못한 결측값이 들어오면 결정 트리 예측을 어떻게 정의하나요?
difficulty: 중하
category: 머신러닝
tags:
  - decision tree
  - missing value
  - inference contract
related:
  - ml-train-validation-test
  - ml-overfitting-generalization
---
# 학습 때 보지 못한 결측값이 들어오면 결정 트리 예측을 어떻게 정의하나요?

## 구두 답변
결측은 0으로 조용히 바꾸는 값이 아니라 모델 artifact가 명시해야 하는 추론 계약입니다. 대치+indicator, 별도 missing category, split별 missing 방향, 보류·fallback 중 하나를 학습과 추론에서 동일하게 적용합니다. 확인한 scikit-learn tree 본문은 non-missing threshold마다 결측을 양쪽으로 보내는 경우를 평가하고, 그 feature의 학습 missing이 없으면 추론에서 표본이 많은 child로 보낼 수 있다고 설명합니다. 이는 모든 tree의 법칙이 아니라 해당 구현 범위입니다. 운영 결측률이 1%에서 20%가 되면 missing slice error·leaf 분포·review rate를 따로 비교하고, indicator가 미래 정보를 포함하지 않는지 확인합니다.


결측 policy를 고를 때는 학습 당시 missing이 없었던 feature와 실제 결측이 많았던 feature를 구분합니다. 학습 missing이 전혀 없으면 split의 어느 방향이 더 안전한지 label 기반으로 배울 근거가 없고, 표본이 많은 child로 보내는 fallback은 편향을 만들 수 있습니다. 반대로 indicator를 쓰면 missing 자체가 예측 신호가 될 수 있으므로 그 값이 언제 생성되었는지 확인해야 합니다. 예를 들어 학습 결측률 1%, 운영 20%에서 missing 행의 false-positive가 정상 행보다 세 배면 전체 accuracy가 유지되어도 정책은 실패한 것입니다. fallback·보류 비용을 validation에서 비교하고 model artifact에 버전과 통계를 함께 저장합니다.

다른 엔진으로 모델을 옮길 때는 threshold와 leaf 값만 복사해서는 충분하지 않고 missing 방향, 대치 평균, indicator 생성 시점을 함께 이식해야 합니다. 이 계약이 빠지면 정상 입력에서는 같은 예측을 하면서 결측 입력에서만 조용히 다른 leaf로 가는 회귀가 생깁니다.
## 득점 포인트
- 학습 시 저장한 방향·대치 통계·indicator를 inference contract로 다룹니다.
- scikit-learn의 구현 동작과 surrogate split·오류 반환 같은 다른 엔진 가능성을 구분합니다.
- 결측률 변화와 label leakage를 slice 검증과 시간 기준으로 확인합니다.

## 감점 포인트
- 결측을 0으로 바꾸면 모든 feature에서 같은 의미라고 말합니다.
- 모델이 결측을 처리한다는 사실만으로 운영 분포 변화가 안전하다고 단정합니다.
- test에서 가장 좋은 missing policy를 골라 독립 평가로 부릅니다.

## 더 파고들 거리
- indicator가 label 생성 이후의 정보를 읽는지 데이터 생성 시점과 함께 검사해 보세요.
- 보류 정책을 review budget, fallback 모델, 관측 불가율과 연결한 의사결정표를 설계해 보세요.

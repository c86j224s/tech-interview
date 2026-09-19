---
id: mlsearch-pca-split-fit
title: PCA를 전체 자료에 fit하고 train/test를 나누면 label을 안 써도 왜 누출인가요?
difficulty: 중하
category: 머신러닝
tags:
  - PCA
  - leakage
  - preprocessing
related:
  - ml-train-validation-test
  - ml-classification-metrics
---
# PCA를 전체 자료에 fit하고 train/test를 나누면 label을 안 써도 왜 누출인가요?

## 구두 답변

누출은 label을 직접 읽었는지만으로 정하지 않습니다. 전체 자료로 PCA를 fit하면 test의 평균 `μ`와 공분산 구조가 components를 결정하고, 그 표현을 사용해 train 모델을 학습하게 됩니다. test label은 쓰지 않았더라도 test 입력 분포가 학습 절차의 좌표계를 바꾼 것이므로, 선택이 끝난 뒤 처음 보는 test라는 계약이 깨집니다.

예를 들어 test에만 큰 분산 방향이 있으면 전체 PCA의 PC1이 그 방향으로 회전할 수 있습니다. train-only PCA의 PC1과 전체 PCA의 PC1은 달라지고, classifier는 test를 미리 반영한 표현에서 학습합니다. 이 차이가 점수를 반드시 올린다고 주장할 수는 없지만, 독립 평가를 오염시키는 정보 경로가 존재한다는 것은 분명합니다. test를 보고 component 수나 whitening까지 조정하면 누출은 더 직접적입니다.

안전한 순서는 `pca.fit(X_train)`, `X_train_low=pca.transform(X_train)`, `X_test_low=pca.transform(X_test)`입니다. 교차 검증에서는 fold마다 train subset으로 mean과 components를 새로 fit해야 합니다. 결측 대체·feature selection·scaler도 같은 경계 안에 넣습니다. fit row IDs와 PCA artifact 버전을 기록하고, validation/test가 fit 목록에 들어가지 않았는지 자동 검사합니다. 비지도 전처리라는 이유만으로 전체 자료 fit을 허용하지 않는 것이 핵심입니다.


정보 경로를 작은 예로 보면 명확합니다. train이 `(0,0),(1,0)`이고 test가 `(100,100),(100,-100)`이라면 test는 입력 label 없이도 두 번째 방향의 큰 분산을 제공합니다. 전체 PCA는 이 방향을 component에 반영하지만 train-only PCA는 거의 첫 번째 좌표만 봅니다. classifier는 전체 PCA의 components를 사용해 train을 학습하므로 test 분포가 표현 선택을 바꾼 상태입니다. 점수가 반드시 상승하는 것은 아니지만, 독립 평가에서 허용하지 않는 정보 경로가 생긴 것은 확실합니다. 결측 대체와 scaler도 같은 pipeline 안에서 fold별 fit해야 PCA만 분리한 척하는 누출을 막을 수 있습니다.
## 득점 포인트

- PCA의 mean/components가 test 입력 분포를 사용하므로 label-independent여도 표현 공간 선택이 오염된다는 경계를 말합니다.
- test에만 큰 variance 방향이 있을 때 전체 PCA와 train-only PCA가 달라지는 반례를 제시합니다.
- `fit(X_train)→transform(train/test)`와 fold별 재fit, fit row ID 감사 절차를 구체화합니다.

## 감점 포인트

- label을 사용하지 않았으니 전체 PCA fit은 누출이 아니라고 말합니다.
- PCA만 분리하고 결측 대체·feature selection·scaler를 전체 자료에 fit합니다.

## 더 파고들 거리

- 교차 검증 pipeline 안에서 PCA와 결측 대체의 fit 행 목록을 어떻게 검사할지 작성해 보세요.
- 시간 분할에서 PCA generation을 언제 재fit할 수 있는지 label 가용 시각과 함께 정의해 보세요.

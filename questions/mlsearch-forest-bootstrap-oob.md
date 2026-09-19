---
id: mlsearch-forest-bootstrap-oob
title: Random forest의 OOB 샘플은 validation set과 어떻게 다르고 언제 믿기 어려운가요?
difficulty: 중하
category: 머신러닝
tags:
  - random forest
  - bootstrap
  - OOB
related:
  - ml-train-validation-test
  - cross-validation-fold-correlation
---
# Random forest의 OOB 샘플은 validation set과 어떻게 다르고 언제 믿기 어려운가요?

## 구두 답변
OOB는 고정된 validation 행이 아니라 각 tree의 bootstrap 표본으로 뽑히지 않은 행입니다. N행을 N번 복원추출할 때 한 행이 빠질 확률은 `(1-1/N)^N→e^-1=.367879`이므로 약 36.8%라는 근사를 쓰지만, 실제 행별 tree 수는 다릅니다. 한 행의 OOB prediction은 그 행을 학습한 tree를 제외한 tree만 모아 계산합니다. 장점은 모든 행이 일부 tree 학습에 쓰인 채 빠른 일반화 신호를 얻는다는 점입니다. 그러나 OOB를 보며 depth·max_features·tree 수·threshold를 반복 조절하면 validation처럼 소모되고, 같은 사용자나 미래 시점이 bootstrap에 섞이면 새 그룹·미래 성능을 뜻하지 않습니다.


고정 validation과 OOB의 차이는 행의 역할이 tree마다 달라진다는 점입니다. validation 행은 어떤 tree에도 학습에 들어가지 않도록 고정할 수 있지만, OOB 행은 어떤 tree에서는 학습되고 다른 tree에서는 제외됩니다. 따라서 OOB 예측을 만들 때 tree별 mask를 먼저 적용하고, 해당 행이 포함된 tree가 실수로 vote에 들어가지 않았는지 검사해야 합니다. 또한 positive나 특정 group의 OOB tree 수가 적으면 score 분산이 커집니다. OOB가 충분히 안정돼 보여도 모델 선택을 끝낸 뒤 시간·그룹 규칙의 held-out 평가를 남겨야 하며, OOB를 독립 test라는 이름으로 보고하면 안 됩니다.

행별 OOB count가 1이나 2처럼 작으면 그 score는 많은 tree의 평균보다 불안정하므로 count별 신뢰 구간이나 최소 count 정책을 둡니다. 특히 group이 여러 행으로 반복되면 한 행을 제외해도 같은 group의 다른 행이 학습에 남아 leakage가 될 수 있습니다.
## 득점 포인트
- tree별 inclusion mask와 행별 OOB tree 집계를 구체적으로 설명합니다.
- `e^-1` 확률을 근사로 표시하고 초기 forest의 빈 OOB 집계 가능성을 언급합니다.
- 개발 OOB와 그룹·시간 holdout test의 역할을 분리합니다.

## 감점 포인트
- OOB score가 언제나 unbiased 독립 test라고 말합니다.
- OOB를 보며 하이퍼파라미터와 threshold를 무제한으로 선택합니다.
- 그룹·시간 의존성이 있어도 행 단위 OOB를 새 사용자 성능으로 해석합니다.

## 더 파고들 거리
- OOB prediction이 없는 행을 표시하고 tree 수 증가에 따른 빈칸 감소를 검증해 보세요.
- 시간 순서 자료에서 rolling 또는 future holdout을 OOB와 비교하는 실험을 설계해 보세요.

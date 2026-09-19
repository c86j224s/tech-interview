---
id: mlsearch-calibration-shift-prevalence
title: 운영 양성 비율이 바뀌면 과거 calibration curve를 그대로 써도 되나요?
difficulty: 중하
category: 머신러닝
tags:
  - calibration
  - base rate
  - shift
related:
  - precision-recall-base-rate-shift
  - ml-classification-metrics
---
# 운영 양성 비율이 바뀌면 과거 calibration curve를 그대로 써도 되나요?

## 구두 답변

그대로 쓴다고 가정하면 안 됩니다. 다만 순수한 prior shift, 즉 양성·음성 각각의 score 분포는 같고 prior만 바뀐 경우에는 odds를 조정할 수 있습니다. 과거 calibration probability가 `p=0.8`, train prevalence가 `π_old=.01`이면 likelihood ratio는 `[p/(1-p)]·[(1-π_old)/π_old] = 4×99=396`입니다. 운영 prevalence가 `π_new=.10`이면 새 odds는 `396×.10/.90=44`, 따라서 조정 probability는 `44/(1+44)=0.9778`입니다. 이는 “class-conditional score likelihood가 안정적”이라는 강한 가정 아래의 계산입니다.

운영에서 score 생성기, 입력 집단, label 정의가 변했다면 이 보정식을 적용해도 맞는다는 보장이 없습니다. 예를 들어 train의 .8 bucket이 100건 중 80건 양성이었는데 운영 fresh label에서 200건 중 120건이면 observed rate는 .60입니다. 이 차이는 prior만의 변화인지, score 조건부 분포가 바뀐 것인지 표본 오차를 포함해 조사해야 합니다. 과거 curve를 불변 상수로 배포하지 말고 기간·집단별 count, mean prediction, observed rate를 다시 모읍니다.

precision/recall도 base rate에 영향을 받지만 이 질문의 핵심은 ranking threshold가 아니라 probability 해석입니다. fresh label이 충분하면 새 calibration set으로 재보정하고, 부족하면 업데이트를 중단하고 관측 부족을 표시합니다. label horizon과 확정 지연까지 같아야 과거와 운영 curve를 비교할 수 있습니다.

prior 조정 뒤에도 p=.8 bucket의 새 observed rate가 .6이고 표본 오차 범위를 벗어나면 공식을 억지로 유지하지 않습니다. class별 score histogram과 label 정의를 비교해 conditional shift를 확인하고, 새 calibrator의 fit 자료와 final 평가 자료를 분리합니다. 이 질문에서 말하는 재보정은 threshold를 임의로 옮기는 것과 달리 확률 mapping 자체를 다시 학습하는 절차입니다.

## 득점 포인트

- prior shift에서 class-conditional score 안정성이라는 조건을 명시합니다.
- `p=.8, πold=.01, πnew=.10`을 odds와 `pnew≈.9778`로 계산합니다.
- fresh label의 observed rate와 label horizon을 통해 재보정 필요성을 판단합니다.

## 감점 포인트

- prevalence가 바뀌면 항상 같은 비율로 probability를 곱합니다.
- PR 지표 변화만 말하고 calibration validity를 다루지 않습니다.
- 운영 label이 아직 미확정인 표본을 drift 증거로 사용합니다.

## 더 파고들 거리

- 입력 분포까지 변한 conditional shift에서 어떤 slice와 drift 지표를 먼저 볼지 정해 보세요.
- prior-adjusted score를 적용하기 전에 likelihood 안정성 가정을 검증할 실험을 설계해 보세요.

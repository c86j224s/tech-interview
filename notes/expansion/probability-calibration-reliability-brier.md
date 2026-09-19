---
id: probability-calibration-reliability-brier
title: 확률 보정의 신뢰도와 Brier 점수
topic: 머신러닝
summary: >-
  순위와 실제 빈도 일치를 분리하고 reliability diagram·Brier·sigmoid/isotonic 보정의 검증 경계를
  설명합니다.
questionIds: []
prerequisites:
  - classification-metrics
  - loss-objective
  - data-splits
related:
  - classification-metrics
reviewedAt: '2026-09-19'
---
# 확률 보정의 신뢰도와 Brier 점수

## 순위와 확률의 분리

분류 모델의 score가 후보를 잘 정렬하는 것과 그 숫자를 확률로 읽는 것은 다른 계약입니다. AUC는 양성 score가 음성 score보다 높은 순서쌍의 비율을 보는 ranking 지표라 단조 증가 변환으로 순서를 유지하면 보통 변하지 않습니다. calibration은 score가 `p`라고 할 때 비슷한 p를 받은 표본의 실제 양성 빈도가 p에 가까운지를 묻습니다. 검토량을 상위 200건으로 고정하면 ranking이 핵심이고, 예상 손실을 `p×cost`로 계산하면 calibration이 핵심입니다.

예를 들어 score `[0.2,0.4,0.6,0.8]`, label `[0,0,1,1]`은 순서를 완벽하게 맞춰 AUC가 1입니다. 이를 `[0.01,0.02,0.98,0.99]`로 바꿔도 순위는 그대로입니다. 그러나 각 score가 확률이라면 첫 모델의 0.2·0.4와 후자의 0.01·0.02는 서로 다른 빈도 주장을 합니다. AUC가 같다는 사실만으로 어느 숫자를 80% 사건 확률로 읽을 수 없습니다.

## Reliability diagram

reliability diagram은 예측 probability를 bin으로 묶어 x축에 bin 내 평균 예측값, y축에 실제 양성 비율을 둡니다. `[.76,.82,.81,.91,.70]`, label `[1,0,1,1,0]`을 하나의 bin으로 보면 예측 평균은 `(0.76+0.82+0.81+0.91+0.70)/5=0.80`, 관측 양성률은 3/5=0.60입니다. 이 점은 0.8을 받은 집단에서 실제 빈도가 0.6인 과신 후보입니다. 다섯 개뿐이므로 bin count와 구간 불확실성을 함께 표기하며, 경계 규칙이 바뀌면 곡선도 바뀝니다.

시간·집단별 label 지연을 무시하면 아직 확정되지 않은 표본이 음성으로 들어가 curve가 왜곡됩니다. prediction horizon과 label 확정시각을 고정하고, 같은 label 정의를 지킨 검증 자료를 사용합니다.

## Brier와 Murphy 분해

Brier score는 이진 예측에서 `mean((p_i-y_i)^2)`입니다. 위 다섯 행의 제곱 오차는 `.0576 + .6724 + .0361 + .0081 + .49 = 1.2642`, 평균은 `0.25284`입니다. 점수가 낮아졌다고 calibration만 좋아졌다고 말할 수 없는 이유는 예측의 빈도 일치와 집단 간 분리, 전체 양성 불확실성이 함께 들어가기 때문입니다.

여기서는 Murphy의 reliability–resolution–uncertainty 관례를 사용합니다. bin 평균 예측을 `p_k`, bin 관측률을 `o_k`, 전체 양성률을 `\bar y`, bin 비율을 `w_k`라 하면 경험적 형태는 `BS = Σ_k w_k(p_k-o_k)^2 - Σ_k w_k(o_k-\bar y)^2 + \bar y(1-\bar y)`입니다. 첫 항은 reliability 손실, 둘째 항은 resolution이 좋아질수록 줄어드는 것이 아니라 Brier를 낮추는 기여, 셋째 항은 prevalence에 따른 uncertainty입니다. 유한 bin의 분해는 bin 수·경계·표본 수에 민감하므로 AUC와 원자료 단위의 Brier를 함께 보고합니다.

## 보정기와 순서 정책

sigmoid/Platt 보정은 base estimator의 decision score `f`를 입력으로 받아 `1/(1+exp(Af+B))` 꼴의 매끈한 mapping을 학습합니다. 부호 convention은 구현의 score 방향에 따라 달라질 수 있으므로 식만 복사하지 않고 held-out 자료에서 monotonic 방향과 결과를 확인합니다. isotonic은 score가 커질수록 출력이 감소하지 않는 계단형 함수라 유연하지만 작은 calibration set에서 과적합하기 쉽습니다.

isotonic의 같은 계단에 여러 score가 들어가면 tie가 생길 수 있습니다. 이는 사실이고, sigmoid가 언제나 엄격한 ranking 보존을 보장한다는 처방은 아닙니다. strict order가 운영 계약이면 sigmoid·isotonic·보정 후 별도 tie-breaker를 동일한 held-out ranking 지표로 비교하고, tie를 허용할지 정책으로 명시합니다. 보정기 선택은 “항상 sigmoid”가 아니라 확률 오차와 순위 요구를 함께 평가하는 결정입니다.

## Held-out 학습 경계

base model이 본 training score와 label에 calibrator를 바로 fit하면 calibrator가 그 자료의 우연한 계단과 빈도를 외울 수 있습니다. 그러면 training reliability는 완벽해 보여도 새 데이터에서 gap이 커집니다. 안전한 순서는 base train, calibrator validation, final test를 분리하는 것입니다. 자료가 작으면 out-of-fold score로 각 표본이 자기 학습 score를 보지 않게 만든 뒤 calibrator를 적합할 수 있습니다.

final test는 calibrator 종류, bin 수, threshold를 고르는 데 다시 쓰지 않습니다. 보고서에는 base model revision, score가 logit인지 probability인지, calibrator fit 기간·집단, sigmoid의 A/B 또는 isotonic 계단을 함께 저장합니다. 보정기와 score 생성기를 동시에 바꾸면 입력 분포가 바뀌므로 이전 calibrator를 그대로 재사용하지 않습니다.

## Prevalence shift와 prior 조정

훈련 양성률이 1%, 운영 양성률이 10%로 변하면 과거의 `p=0.8`을 자동으로 80%라고 배포할 수 없습니다. 다만 “prior shift만 있고 class-conditional score likelihood는 그대로”라는 가정이 성립한다면 odds를 조정할 수 있습니다. 과거 probability p와 훈련 prior `π_old`에서 likelihood ratio는 `LR = [p/(1-p)]·[(1-π_old)/π_old]`이고, 새 prior `π_new`에서는 `p_new = [LR·π_new]/[LR·π_new + (1-π_new)]`입니다.

예를 들어 p=0.8, `π_old=.01`, `π_new=.10`이면 `LR=0.8/.2 × .99/.01 = 396`, 새 odds는 44, 따라서 `p_new=44/45≈0.9778`입니다. 이는 class-conditional 분포가 안정적일 때만 가능한 계산입니다. 입력 분포·label 정의·score 생성기가 변했다면 fresh labels로 기간·집단별 reliability를 다시 측정하고 재보정합니다. precision/recall의 base-rate 변화와 probability validity를 같은 결론으로 섞지 않습니다.

## 운영 비용과 검증

threshold는 TP·FP·FN과 검토량을 결정하고 calibrator는 score의 단위를 바꿉니다. 따라서 Brier, log loss, reliability gap, AUC, threshold별 confusion matrix, 비용·검토량을 별도 표로 둡니다. bin 표본이 적으면 업데이트를 중단하고 “관측 부족”으로 표시하며, 허용 gap을 넘었다고 즉시 threshold를 움직여 평가 자료를 오염시키지 않습니다.

```python
p=[.76,.82,.81,.91,.70]; y=[1,0,1,1,0]
terms=[(a-b)**2 for a,b in zip(p,y)]
print(terms, sum(terms), sum(terms)/len(terms), sum(y)/len(y))
# [0.0576, 0.6724, 0.0361, 0.0081, 0.49] 1.2642 0.25284 0.6
```

이것은 설명용 계산이며 calibrator를 실제 fit한 결과가 아닙니다. 실제 평가에서는 독립 test와 confidence interval, slice별 결과를 추가합니다.

```diagram
{"title":"확률 보정의 검증 흐름","caption":"순위 보존과 빈도 보정은 서로 다른 평가를 요구하며, held-out 자료에서 함께 확인해야 합니다.","rows":[[{"id":"base","label":"base score","detail":["model revision","label horizon"]}],[{"id":"rank","label":"순위 평가","detail":["AUC · top-K","threshold"]},{"id":"freq","label":"빈도 평가","detail":["bin 평균","observed rate"]}],[{"id":"calib","label":"calibrator","detail":["sigmoid·isotonic","validation fit"]}],[{"id":"policy","label":"운영 정책","detail":["cost · review","drift monitor"]}]],"edges":[{"from":"base","to":"rank","label":"순서"},{"from":"base","to":"freq","label":"확률 후보"},{"from":"freq","to":"calib","label":"오차 보정"},{"from":"rank","to":"policy","label":"우선순위"},{"from":"calib","to":"policy","label":"비용 해석"}]}
```

## 참고 자료와 확인 경계

- https://scikit-learn.org/stable/modules/calibration.html — reliability curve, held-out calibration, sigmoid/Platt, isotonic의 계단형·소자료 과적합, Brier의 reliability/resolution/uncertainty 관점을 본문에서 확인했습니다. 전체 Murphy 식의 정확한 구현·bin estimator는 이 페이지의 설명을 넘어 이 장에서 명시한 관례로 제한했습니다.
- https://scikit-learn.org/stable/modules/metrics.html#roc-metrics — AUC를 ranking 관점에서 해석하는 근거로 참고할 수 있으나, 본 batch에서는 calibration 문서의 범위와 혼동하지 않도록 운영 계약을 별도로 적었습니다.

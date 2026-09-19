---
id: logistic-regression-logits
title: 로지스틱 회귀의 로짓과 교차 엔트로피
topic: 머신러닝
summary: 선형 로짓을 sigmoid 확률로 바꾸고 logits 기반 이진 교차 엔트로피를 최적화하는 경계를 설명합니다.
questionIds: []
prerequisites:
  - linear-regression-foundations
  - loss-objective
  - classification-metrics
related:
  - data-splits
  - generalization
reviewedAt: '2026-09-19'
---
# 로지스틱 회귀의 로짓과 교차 엔트로피

## 선형 출력과 확률 좌표

로지스틱 회귀는 입력을 선형 결합한 실수 `z = wᵀx+b`를 먼저 만든 뒤 그 값을 이진 분류에 사용합니다. 이 `z`가 로짓이며 확률이 아닙니다. `z`는 양성 대 음성의 로그 오즈이고, `z=0`은 오즈가 1인 지점입니다. sigmoid `p=1/(1+exp(-z))`를 적용하면 `z=-2,0,2`가 각각 약 `0.1192,0.5,0.8808`이 됩니다. sigmoid는 단조 증가하므로 순위 정보는 보존되지만, 숫자를 확률로 해석하려면 보정 상태와 학습 분포를 따로 확인해야 합니다.

학습 단계에서 로짓을 보존하면 threshold가 바뀌어도 같은 모델 출력을 재사용할 수 있습니다. 운영 단계에서는 `p≥t`를 행동으로 바꾸거나, sigmoid를 생략하고 `z≥log(t/(1-t))`를 직접 비교할 수 있습니다. 따라서 모델 점수, 확률 표현, 승인·차단 정책을 한 변수로 뭉치지 않는 것이 첫 번째 계약입니다.

## 이진 손실과 기울기

표본의 label이 `y∈{0,1}`이면 BCE는 `-[y log p +(1-y)log(1-p)]`입니다. `y=1`에서 `p=.2`이면 손실은 약 1.609, `p=.4`이면 약 0.916입니다. 두 예측 모두 threshold .5에서는 음성이지만, 학습 손실은 두 번째를 더 좋은 방향으로 구별합니다. 정확도는 경계 안쪽의 개선을 보지 못하고, BCE는 확신의 정도까지 gradient로 전달합니다.

sigmoid와 BCE를 합쳐 미분하면 로짓에 대한 표본 gradient가 `p-y`가 됩니다. 배치 평균에서 `∂L/∂w=Xᵀ(p-y)/n`, 절편 gradient는 `Σ(p-y)/n`입니다. 이 식은 오답 방향의 큰 확신을 크게 밀어내고, 이미 맞는 확률에는 작은 수정만 하는 이유를 보여 줍니다. sample weight가 있으면 각 항과 gradient에 같은 weight가 곱해지며, class weight도 사실상 label별 손실 기여를 바꿉니다.

## 안정화 손실 계산

확률을 만든 뒤 `log`를 취하는 구현은 극단 로짓의 표현 범위에서 깨질 수 있습니다. `z=1000`이면 sigmoid가 float에서 정확히 1로 반올림될 수 있어 `y=0`의 `log(1-p)`가 `log(0)=-∞`가 됩니다. 같은 식에서 `y=1`이면 `0×(-∞)`가 NaN을 만들 수 있습니다. 반대로 `z=-1000`에서 `exp(-z)`를 직접 계산하면 overflow가 납니다. 따라서 극단값은 모두 NaN이라고 부르지 말고, inf와 NaN 전파를 구분해야 합니다.

안정화된 식은 다음과 같습니다.

```text
loss(z,y) = max(z,0) - z*y + log1p(exp(-abs(z)))
```

설명용 산술로 `z=1000,y=1`은 `1000-1000+0=0`, `z=1000,y=0`은 `1000`, `z=-1000,y=0`은 `0`, `z=-1000,y=1`은 `1000`입니다. 이는 프레임워크 실행 결과가 아니라 식의 중간항을 계산한 것입니다. `log1p`·`logaddexp`와 동등한 검증된 구현을 사용하고, 입력·label·reduction 분모·parameter가 유한한지 별도로 검사해야 합니다. 안정화는 잘못된 label이나 비유한 입력을 고쳐 주지 않습니다.

```diagram
{"title":"로짓의 학습과 정책 경로","caption":"하나의 선형 점수가 안정적인 손실 경로와 별도의 정책 경로로 나뉩니다.","rows":[[{"id":"z","label":"선형 로짓","detail":["wᵀx+b","실수 범위"]}],[{"id":"loss","label":"안정 손실","detail":["softplus 경로","gradient p−y"]},{"id":"p","label":"Sigmoid 확률","detail":["정책 입력","보정 가능"]}],[{"id":"update","label":"가중치 갱신","detail":["BCE·penalty","optimizer"]}],[{"id":"action","label":"운영 행동","detail":["threshold","검토·차단"]}]],"edges":[{"from":"z","to":"loss","label":"직접 계산"},{"from":"z","to":"p","label":"sigmoid"},{"from":"loss","to":"update","label":"gradient"},{"from":"p","to":"action","label":"정책 경계"}]}
```

## 임계값과 로짓 경계

확률 임계값 `t`는 로짓에서 `log(t/(1-t))`로 바뀝니다. `t=.2`이면 경계는 약 -1.386이고, `t=.8`이면 약 1.386입니다. 미탐 비용이 큰 검색이라면 낮은 경계를 선택해 더 많은 사례를 검토할 수 있지만, 모델을 다시 학습했다는 뜻은 아닙니다. 검증 세트에서 TP·FP·FN·TN, 검토량, 오류 비용을 계산하고 선택 후 test에 경계를 고정합니다.

`0.5`는 대칭 비용과 보정된 확률을 가정할 때 편한 기준일 뿐 법칙이 아닙니다. class weight나 oversampling은 score의 intercept와 분포를 바꿀 수 있으므로 `p=.8`을 운영 prevalence에서 80%라고 바로 읽으면 안 됩니다. calibration 자료에서 예측 구간 평균과 실제 양성 비율을 비교하고, calibrator와 threshold를 모두 test 전에 고정합니다.

## 정규화와 특징 규모

목적식을 `mean(BCE)+λ||w||²`로 쓰면 penalty는 계수 좌표의 단위에 의존합니다. `x₁=.5,w₁=2`와 `x₂=5000,w₂=.0002`는 각각 로짓에 1을 기여하지만 계수 제곱 합은 `4.00000004`입니다. 원자료에서는 첫 좌표가 penalty 대부분을 부담합니다. train 평균·표준편차로 두 열을 표준화하면 한 계수의 단위가 비슷해져 같은 λ의 비교가 더 의미 있어집니다.

scikit-learn의 `C`처럼 inverse penalty를 쓰는 API에서는 `C`가 커질수록 규제가 약해지는 방향이 λ 표기와 반대입니다. sample/class weight의 절대 규모도 penalty와 상대적으로 작동할 수 있으므로 weight만 바꾸었다고 생각한 실험에서 objective 스케일이 바뀌었는지 기록합니다. scaler는 train에서만 fit하고 validation·test에는 저장한 통계를 적용합니다.

## 구현 검증과 비용

작은 배열에 `z∈{-1000,-2,0,2,1000}`, `y∈{0,1}`을 넣어 stable loss의 유한성, 반대 방향 확신의 큰 손실, `p-y` gradient를 검사합니다. 다음으로 threshold만 변경하는 실험과 weight·정규화·scaler를 다시 fit하는 실험을 분리합니다. 로그에는 split ID, scaler 통계 fingerprint, penalty와 weight 집계, threshold, calibration 자료 범위를 남깁니다.

특징 수를 `d`, 표본 수를 `n`이라 할 때 매 gradient의 기본 계산량은 희소성·구현을 제외하면 대략 `O(nd)`이고, 저장은 `O(d)`입니다. batch와 mixed precision은 비용과 수치 범위를 바꿉니다. 실행하지 않은 이 문서의 숫자는 설명용 계산이며, 특정 solver의 default나 exact release 성능으로 확대하지 않습니다.

## 실패 경계와 참고 자료

NaN이 생기면 sigmoid 출력만 탓하지 말고 입력과 label의 유한성, 로짓 overflow, loss reduction의 0 분모, optimizer step 후 parameter 폭발을 순서대로 확인합니다. calibration·threshold를 test에서 고르면 독립 평가가 사라집니다. coefficient 절댓값도 feature 단위가 다르면 importance가 아닙니다.

- [scikit-learn Logistic Regression](https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression) — 2026-09-19 본문 확인. 선형 결정함수·확률·가중 손실·C 관계를 확인했으며 exact 설치 release는 고정하지 않았습니다.
- [scikit-learn Standardization](https://scikit-learn.org/stable/modules/preprocessing.html#standardization-or-mean-removal-and-variance-scaling) — train 통계 재사용과 scale-sensitive penalty 근거입니다.
- [scikit-learn Probability Calibration](https://scikit-learn.org/stable/modules/calibration.html) — 보정 자료와 reliability 해석을 확인할 출발점입니다.

이 장은 프레임워크를 실행하지 않았습니다. stable BCE, threshold 변환, 계수 예시는 안전한 설명용 계산으로만 검산했으며, 실제 배포 전에는 설치 버전·dtype·solver·calibration 방법을 고정해 재검증해야 합니다.

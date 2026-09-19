---
id: mlsearch-logistic-logits-stability
title: 확률 0과 1 근처에서 로그 손실이 NaN이 됩니다. logits 손실을 쓰는 이유는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - cross-entropy
  - logits
  - 수치 안정성
related:
  - ml-loss-objective
  - ml-gradient-learning-rate
---
# 확률 0과 1 근처에서 로그 손실이 NaN이 됩니다. logits 손실을 쓰는 이유는 무엇인가요?

## 구두 답변
제목처럼 모든 극단 사례가 NaN인 것은 아닙니다. sigmoid 뒤에 로그를 직접 취하면 `z=1000`에서 p가 1로 반올림되어 `y=0`일 때 `log(1-p)=-∞`, 손실은 `+∞`가 됩니다. 같은 계산에서 `y=1`이면 `0×(-∞)`가 NaN으로 전파될 수 있고, `z=-1000`에서는 `exp(-z)` 자체가 overflow합니다. 로짓 입력 안정화 식 `max(z,0)-z*y+log1p(exp(-abs(z)))`은 이 불필요한 표현 범위 붕괴를 피합니다. 설명용 계산에서 `(z,y)=(1000,1)`과 `(-1000,0)`의 loss는 0에 가깝고, 반대 label은 각각 1000입니다. 즉 맞는 극단 확신은 작고 틀린 확신은 큽니다.


구현에서 안정화 식이 실제로 보호하는 범위도 확인합니다. 유한한 `z`와 0·1 label이면 `log1p(exp(-abs(z)))`가 작은 쪽 지수만 계산하므로 `exp(1000)`을 만들지 않습니다. 하지만 label이 2이거나 z가 이미 `inf`이면 식의 전제가 깨지고, 평균 reduction에서 유효 표본 수가 0이면 별도의 0 나눗셈이 생깁니다. 따라서 단위 테스트는 네 극단 조합의 loss뿐 아니라 finite input 검사, empty batch, weighted denominator, backward gradient까지 포함해야 합니다. epsilon을 p에 넣는 응급 처치는 clipping 전후 gradient가 달라질 수 있어 근본 대체가 아닙니다.

특히 loss가 finite여도 backward가 finite라는 보장은 없으므로 gradient norm과 parameter update 직후를 함께 검사합니다. `z=1000,y=0`의 유한 안정화 loss는 “계산이 안전하다”는 뜻이지, 그 예측이 좋은 예측이라는 뜻이 아닙니다.
## 득점 포인트
- `+∞`와 `NaN`을 구분하고 `0×(-∞)` 및 `exp(1000)`의 발생 지점을 설명합니다.
- softplus 형태의 안정화 식으로 네 극단 상태의 loss를 직접 추적합니다.
- 입력·label·reduction 분모·parameter가 비유한 경우까지 해결하지 않는다는 경계를 말합니다.

## 감점 포인트
- 확률이 0 또는 1로 표시되면 반드시 모델 고장이라고 단정합니다.
- epsilon clipping만 하면 gradient와 손실 의미가 보존된다고 말합니다.
- 안정화 손실을 사용하면 optimizer 폭발이나 잘못된 label도 자동으로 고쳐진다고 설명합니다.

## 더 파고들 거리
- 안정화 BCE를 미분하면 로짓 gradient가 `p-y`가 되는 과정을 전개해 보세요.
- float32와 낮은 정밀도에서 loss·gradient의 finite 검사와 loss scaling을 설계해 보세요.

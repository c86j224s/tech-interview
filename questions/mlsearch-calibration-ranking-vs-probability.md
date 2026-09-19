---
id: mlsearch-calibration-ranking-vs-probability
title: AUC가 같은 두 모델 중 한 모델의 0.8을 실제 80%로 읽을 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 머신러닝
tags:
  - calibration
  - AUC
  - probability
related:
  - ml-classification-metrics
  - precision-recall-base-rate-shift
---
# AUC가 같은 두 모델 중 한 모델의 0.8을 실제 80%로 읽을 수 없는 이유는 무엇인가요?

## 구두 답변

AUC는 양성과 음성의 상대 순서를 평가하고 calibration은 score의 크기가 실제 빈도와 맞는지를 평가하므로 둘은 같은 지표가 아닙니다. 같은 네 표본의 label이 `[0,0,1,1]`이고 모델 A score가 `[0.2,0.4,0.6,0.8]`, 모델 B가 `[0.01,0.02,0.98,0.99]`라고 하겠습니다. 두 모델 모두 순서가 완전히 같아 AUC는 1이지만 각 숫자를 확률이라고 읽을 때 주장은 매우 다릅니다. monotonic transform이 순서를 유지했을 뿐 빈도까지 보존한 것은 아닙니다.

운영 bin을 `[0.7,1.0)`으로 정하고 score `[0.76,0.82,0.81,0.91,0.70]`과 label `[1,0,1,1,0]`을 넣으면 다섯 행이 모두 들어갑니다. 평균 예측은 `4.00/5=0.80`, 실제 양성률은 `3/5=0.60`입니다. 이 표본에서는 예측 빈도가 높게 나타나지만 5건은 매우 작으므로 모집단의 보정 상태를 확정하기에는 부족합니다. 반열린 bin을 `[0.7,0.9)`로 바꾸면 0.91 행이 빠지므로 평균과 분모를 다시 계산해야 합니다.

따라서 top-K 검토량이 주 계약이면 AUC·recall·ranking을 우선 보고, 비용·자원 예측에 p를 곱한다면 held-out reliability, Brier, log loss와 label horizon을 추가합니다. 작은 bin 하나로 결론을 확정하지 않고 시간·집단 slice와 신뢰구간을 확인합니다. AUC가 같다는 이유로 한 모델의 0.8을 자동으로 80% 사건 확률로 노출하지 않습니다.

또한 AUC는 양성·음성의 모든 쌍을 활용하므로 같은 AUC라도 score의 절대값이나 bin별 표본 수는 다를 수 있습니다. 운영에서 “0.8 이상이면 자동 승인”처럼 숫자를 정책에 연결했다면 threshold 전후 비용과 observed rate를 별도 검증하고, 보정 전 score를 probability라는 이름으로 API에 내보내지 않습니다. probability와 ranking score를 필드부터 분리하면 이 혼동을 줄일 수 있습니다.

## 득점 포인트

- AUC가 순위를, calibration이 score magnitude와 빈도를 본다는 차이를 첫 문장에 둡니다.
- 같은 label에서 `[0.2,0.4,0.6,0.8]`과 `[0.01,0.02,0.98,0.99]`의 순위 동일성을 계산합니다.
- 0.80 평균 예측과 0.60 observed rate를 count와 함께 해석합니다.

## 감점 포인트

- 0.49/0.51 score를 0.9 bin의 사례로 섞어 씁니다.
- AUC 1을 probability calibration 보장으로 말합니다.
- 작은 bin의 observed rate를 모집단의 불변 확률로 단정합니다.

## 더 파고들 거리

- monotonic transform이 AUC를 유지하는 조건과 ties가 생길 때 ranking 평가를 확인해 보세요.
- review budget과 비용 계산이 각각 어떤 지표를 주 계약으로 삼는지 설계해 보세요.

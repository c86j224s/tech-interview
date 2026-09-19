---
id: game-quaternion-normalize-after-integration
title: 매 틱 회전 quaternion을 곱한 뒤 정규화해야 하는 이유는 무엇인가요?
difficulty: 중하
category: 게임 서버
tags:
  - quaternion
  - 정규화
  - 수치 오차
related:
  - fixed-variable-step-integration
---
# 매 틱 회전 quaternion을 곱한 뒤 정규화해야 하는 이유는 무엇인가요?

## 구두 답변

이상적인 실수에서는 단위 quaternion의 곱도 단위지만 float 곱셈은 반올림하므로 `norm²`가 1에서 조금씩 벗어납니다. 그래서 권위 상태는 `q_next=normalize(delta*q)`로 단위 구면에 되돌립니다. 비정규화 quaternion을 회전 행렬로 바꾸면 정규 직교 행렬이 아니게 되어 길이 보존과 직교성이 깨질 수 있습니다.

설명용 trace로 identity에 고정된 z축 1도 delta를 같은 곱 순서로 90회 적용하면 이상적인 결과는 90도 회전입니다. 실제 구현에서는 local/world 곱 순서와 handedness를 고정하고 매 tick norm², finite 여부, 상대각을 기록합니다. 매 곱 normalize는 비용이 있지만 판정용 상태의 drift를 단순하게 합니다. norm이 0에 가깝거나 NaN이면 나누지 말고 identity 복구, invalid 표시, snapshot 재요청 중 하나를 양쪽에서 동일하게 선택해야 합니다. normalize는 FMA·순서 차이까지 없애지 않습니다.

정규화 주기는 판정과 표시를 나누어 정합니다. 매 tick 보정은 drift 예산을 예측하기 쉽지만 제곱근 비용이 들어가고, 8틱마다 보정은 비용을 낮추는 대신 그 사이 norm 오차를 허용합니다. 테스트에서는 동일 delta를 90회 곱한 뒤 행렬의 column 길이와 서로 다른 column의 dot를 검사해 단위성뿐 아니라 직교성도 확인하는 편이 좋습니다.

 검증에서는 norm²만 1에 가까운지 보지 않고 변환한 세 축의 길이와 서로의 내적도 봅니다. quaternion이 유효해 보여도 구현의 matrix conversion이 비정규화 입력을 어떻게 처리하는지에 따라 결과가 달라질 수 있으므로, 변환 함수의 입력 계약도 테스트에 포함합니다.

 입력 delta 자체가 unit인지도 곱셈 전에 확인해야 합니다. 비정상 delta를 normalize 뒤에만 숨기면 잘못된 입력을 정상 회전처럼 저장하므로, invalid 카운터와 복구 원인을 함께 남깁니다.

## 득점 포인트

- 단위 quaternion 곱의 수학적 불변식과 유한 정밀도 drift를 구분합니다.
- 영 norm·비유한 입력을 나누기 전에 거절하거나 명시적으로 복구합니다.

## 감점 포인트

- 정규화가 곱 순서나 좌표계 오류도 고친다고 합니다.
- normalize만 호출하면 플랫폼 간 bitwise 결과가 같다고 합니다.

## 더 파고들 거리

- 매 틱과 오차 임계값 기반 정규화의 비용·오차를 어떻게 비교하나요?
- 회전 행렬 변환 후 축 길이와 직교성을 어떤 tolerance로 검사하나요?

---
id: "class-weight-threshold-interaction"
title: "희귀 클래스 가중치를 높였습니다. 학습 손실 변화와 실제 정밀도·재현율·검토량은 어떻게 함께 평가하나요?"
difficulty: "중하"
category: "머신러닝"
tags: ["머신러닝","손실 함수","학습 목적","평가 지표","심화 질문"]
related: ["ml-loss-objective"]
promotedFrom: {"id":"ml-loss-objective","prompt":"클래스 가중치 변화가 재현율·정밀도·검토 처리량에 미치는 영향을 임계값별로 비교해 보세요."}
---

# 희귀 클래스 가중치를 높였습니다. 학습 손실 변화와 실제 정밀도·재현율·검토량은 어떻게 함께 평가하나요?

## 구두 답변

class weight는 학습에서 오류의 상대 비용을 바꾸고 threshold는 예측 점수를 행동으로 바꾸는 단계입니다. weight 증가가 실제 precision·recall·보정에 주는 영향은 검증해야 합니다.

양성 비율과 검토 용량을 반영해 임계값별 혼동 행렬을 봅니다. 가중 손실이 줄었다고 운영 비용이 줄었다고 하지 않습니다. 데이터·분할·선택 횟수를 고정해 비교합니다.

## 득점 포인트

- class weight는 학습에서 오류의 상대 비용을 바꾸고 threshold는 예측 점수를 행동으로 바꾸는 단계입니다. weight 증가가 실제 precision·recall·보정에 주는 영향은 검증해야 합니다.
- 데이터·분할·선택 횟수를 고정해 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: class weight는 학습에서 오류의 상대 비용을 바꾸고 threshold는 예측 점수를 행동으로 바꾸는 단계입니다.

## 더 파고들 거리

- [기본 상황과 비교: 모델의 학습 오차는 줄었는데 실제 성능 지표는 좋아지지 않습니다. 손실 함수와 학습 목적은 평가 지표와 어떻게 다른가요?](/tech-interview/questions/ml-loss-objective/)

---
id: "learning-rate-warmup-decay-eval"
title: "warmup과 decay를 적용한 학습이 좋아 보입니다. 검증 성능·동일 계산 예산·수렴 시점을 어떻게 비교하나요?"
difficulty: "중하"
category: "머신러닝"
tags: ["머신러닝","경사하강법","기울기","학습률","특징 스케일","심화 질문"]
related: ["ml-gradient-learning-rate","ml-loss-objective"]
promotedFrom: {"id":"ml-gradient-learning-rate","prompt":"warmup·decay를 적용한 곡선에서 검증 성능과 계산 비용의 개선 시점을 확인해 보세요."}
---

# warmup과 decay를 적용한 학습이 좋아 보입니다. 검증 성능·동일 계산 예산·수렴 시점을 어떻게 비교하나요?

## 구두 답변

warmup은 초기 큰 업데이트를 제한하고 decay는 후반 step 크기를 줄이는 데 쓰일 수 있지만 데이터·optimizer별 효과를 검증해야 합니다. 같은 epoch가 같은 계산 예산을 뜻하지 않을 수 있습니다.

처리 샘플·step·wall time·배치·seed를 기록하고 validation 곡선과 최종 holdout을 나눕니다. 더 긴 학습이나 달라진 데이터가 개선 원인인지 분리하고 불안정·조기 수렴을 함께 봅니다.

## 득점 포인트

- warmup은 초기 큰 업데이트를 제한하고 decay는 후반 step 크기를 줄이는 데 쓰일 수 있지만 데이터·optimizer별 효과를 검증해야 합니다. 같은 epoch가 같은 계산 예산을 뜻하지 않을 수 있습니다.
- 더 긴 학습이나 달라진 데이터가 개선 원인인지 분리하고 불안정·조기 수렴을 함께 봅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: warmup은 초기 큰 업데이트를 제한하고 decay는 후반 step 크기를 줄이는 데 쓰일 수 있지만 데이터·optimizer별 효과를 검증해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: 경사하강법으로 학습할 때 손실이 튀거나 거의 줄지 않습니다. 기울기와 학습률을 어떻게 해석하고 조정하나요?](/tech-interview/questions/ml-gradient-learning-rate/)

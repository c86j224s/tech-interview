---
id: "rolling-validation-future-holdout"
title: "시간 순서가 있는 데이터에서 rolling validation과 미래 holdout을 어떤 누출·변화·계산 비용으로 비교하나요?"
difficulty: "중하"
category: "머신러닝"
tags: ["머신러닝","훈련 데이터","검증 데이터","테스트 데이터","정보 유출","심화 질문"]
related: ["ml-train-validation-test"]
promotedFrom: {"id":"ml-train-validation-test","prompt":"시계열 rolling validation과 단일 미래 holdout을 운영 변화와 계산 비용 기준으로 비교해 보세요."}
---

# 시간 순서가 있는 데이터에서 rolling validation과 미래 holdout을 어떤 누출·변화·계산 비용으로 비교하나요?

## 구두 답변

시간 순서를 지켜 과거로 학습하고 미래 구간에서 평가합니다. rolling validation은 여러 시기의 변화를 보지만 계산과 겹치는 학습 집합의 상관이 생깁니다. 마지막 미래 holdout은 선택에 쓰지 않고 보존합니다.

전처리 fit·라벨 지연·동일 사용자·중복 사건이 미래 정보를 새게 하지 않는지 확인합니다. 운영의 기존 사용자 예측과 새 사용자 일반화는 분할 목적이 다를 수 있습니다.

## 득점 포인트

- 시간 순서를 지켜 과거로 학습하고 미래 구간에서 평가합니다. rolling validation은 여러 시기의 변화를 보지만 계산과 겹치는 학습 집합의 상관이 생깁니다. 마지막 미래 holdout은 선택에 쓰지 않고 보존합니다.
- 운영의 기존 사용자 예측과 새 사용자 일반화는 분할 목적이 다를 수 있습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 시간 순서를 지켜 과거로 학습하고 미래 구간에서 평가합니다.

## 더 파고들 거리

- [기본 상황과 비교: 모델의 하이퍼파라미터를 여러 번 바꿔 가장 좋은 결과를 골랐습니다. 훈련·검증·테스트 데이터를 어떻게 분리해야 성능을 공정하게 추정할 수 있나요?](/tech-interview/questions/ml-train-validation-test/)

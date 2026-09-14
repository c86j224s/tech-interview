---
id: "game-timer-phase-staggering"
title: "많은 NPC 타이머가 같은 틱에 만료됩니다. 허용 지연과 공정성을 유지하면서 만료·실행을 어떻게 분산하나요?"
difficulty: "중하"
category: "설계"
tags: ["게임 서버","틱","지연","심화 질문"]
related: ["game-server-tick-budget","profiling-cpu-offcpu","bounded-queue-backpressure"]
promotedFrom: {"id":"game-server-tick-budget","prompt":"타이머가 한 틱에 몰리지 않게 어떻게 배치할까요?"}
---

# 많은 NPC 타이머가 같은 틱에 만료됩니다. 허용 지연과 공정성을 유지하면서 만료·실행을 어떻게 분산하나요?

## 구두 답변

허용 오차가 있는 timer의 위상을 나누거나 jitter를 주고 만료 발견과 callback 실행을 별도 예산으로 관리합니다. 모든 NPC가 같은 생성 시각을 기준으로 반복하면 주기적 파도가 생길 수 있습니다.

피해·권한 만료처럼 조기·지연 실행이 규칙을 바꾸는 timer는 정확한 시각을 유지하고 처리량을 확보합니다. 밀린 callback을 한꺼번에 보충해 다시 과부하를 만들지 않습니다. 만료 시각·실행 시각·누락·중복과 최대 tick을 측정합니다.

## 득점 포인트

- 허용 오차가 있는 timer의 위상을 나누거나 jitter를 주고 만료 발견과 callback 실행을 별도 예산으로 관리합니다. 모든 NPC가 같은 생성 시각을 기준으로 반복하면 주기적 파도가 생길 수 있습니다.
- 만료 시각·실행 시각·누락·중복과 최대 tick을 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 허용 오차가 있는 timer의 위상을 나누거나 jitter를 주고 만료 발견과 callback 실행을 별도 예산으로 관리합니다.

## 더 파고들 거리

- [기본 상황과 비교: 대규모 전투 때 게임 서버의 틱이 늦어집니다. 틱 주기를 늘리기 전에 어떤 작업을 측정하고 분산해야 하나요?](/tech-interview/questions/game-server-tick-budget/)

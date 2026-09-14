---
id: "behavior-tree-action-oscillation"
title: "위험 조건이 틱마다 바뀌어 NPC가 추적과 도주를 반복합니다. 반응성을 유지하면서 행동 진동을 어떻게 줄이나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["Behavior Tree","AI","취소","심화 질문"]
related: ["behavior-tree-running","retry-safe-state-machine"]
promotedFrom: {"id":"behavior-tree-running","prompt":"reactive 재평가로 행동이 계속 중단되는 진동을 어떤 쿨다운과 우선순위로 줄이나요?"}
---

# 위험 조건이 틱마다 바뀌어 NPC가 추적과 도주를 반복합니다. 반응성을 유지하면서 행동 진동을 어떻게 줄이나요?

## 구두 답변

추적·도주 임계에 히스테리시스와 최소 유지 시간·재진입 cooldown을 둘 수 있습니다. 다만 치명적인 위험의 즉시 abort보다 낮은 우선순위로 적용해 반응을 막지 않아야 합니다.

틱별 조건·행동 세대·시작·중단 원인을 기록해 실제 위험과 늦은 callback의 상태 역행을 구분합니다. 새 행동을 시작할 때 옛 예약·timer의 소유자를 검사합니다. 진동 감소와 공격·회피 반응 시간, 취소 잔존 작업을 함께 측정합니다.

## 득점 포인트

- 추적·도주 임계에 히스테리시스와 최소 유지 시간·재진입 cooldown을 둘 수 있습니다. 다만 치명적인 위험의 즉시 abort보다 낮은 우선순위로 적용해 반응을 막지 않아야 합니다.
- 진동 감소와 공격·회피 반응 시간, 취소 잔존 작업을 함께 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 추적·도주 임계에 히스테리시스와 최소 유지 시간·재진입 cooldown을 둘 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: NPC가 Behavior Tree로 이동하다가 도주 행동으로 바뀝니다. Running 상태의 이전 이동 작업과 늦은 완료는 어떻게 처리하나요?](/tech-interview/questions/behavior-tree-running/)

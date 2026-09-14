---
id: "game-reservation-deterministic-aging"
title: "NPC 예약의 기아를 줄이려 aging을 적용합니다. 우선순위 변경과 리플레이 결정성을 어떻게 함께 유지하나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["위치 점유","예약","동시성","심화 질문"]
related: ["multiagent-cell-reservation","mutex-vs-serial-execution","grid-diagonal-corner"]
promotedFrom: {"id":"multiagent-cell-reservation","prompt":"고정 우선순위가 만드는 기아를 aging과 라운드 로빈으로 줄일 때 틱 결정성을 어떻게 유지하나요?"}
---

# NPC 예약의 기아를 줄이려 aging을 적용합니다. 우선순위 변경과 리플레이 결정성을 어떻게 함께 유지하나요?

## 구두 답변

대기 나이와 마지막 진행을 기준으로 우선순위를 바꾸되 같은 입력·틱에서 같은 결정을 재현할 수 있게 규칙과 tie-breaker를 고정합니다. 로컬 wall-clock이나 thread 도착 순서에만 의존하지 않습니다.

만료된 의도를 승격하지 않고 실제 footprint·간선 충돌을 검사합니다. 양보 공간 없는 교착은 aging만으로 해결되지 않습니다. 최대 대기·재계획·공정성과 로그 재생 결과를 비교합니다.

## 득점 포인트

- 대기 나이와 마지막 진행을 기준으로 우선순위를 바꾸되 같은 입력·틱에서 같은 결정을 재현할 수 있게 규칙과 tie-breaker를 고정합니다. 로컬 wall-clock이나 thread 도착 순서에만 의존하지 않습니다.
- 최대 대기·재계획·공정성과 로그 재생 결과를 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 대기 나이와 마지막 진행을 기준으로 우선순위를 바꾸되 같은 입력·틱에서 같은 결정을 재현할 수 있게 규칙과 tie-breaker를 고정합니다.

## 더 파고들 거리

- [기본 상황과 비교: 두 캐릭터가 같은 틱에 같은 빈 칸을 예약하려 할 때 서버는 조회와 점유 확정을 어떻게 원자적으로 처리하나요?](/tech-interview/questions/multiagent-cell-reservation/)

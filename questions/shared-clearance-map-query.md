---
id: "shared-clearance-map-query"
title: "서로 다른 반경의 캐릭터가 같은 clearance map을 사용합니다. 어떤 기하·해상도 조건을 확인해야 하나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["격자","충돌","대각 이동","심화 질문"]
related: ["grid-diagonal-corner","astar-heuristic"]
promotedFrom: {"id":"grid-diagonal-corner","prompt":"서로 다른 반경의 에이전트가 clearance 맵을 공유할 수 있는 조건은 무엇인가요?"}
---

# 서로 다른 반경의 캐릭터가 같은 clearance map을 사용합니다. 어떤 기하·해상도 조건을 확인해야 하나요?

## 구두 답변

clearance가 어떤 거리·형상·장애물 모델의 여유를 나타내는지 먼저 정의합니다. 중심 거리만으로 캡슐 높이·경사·모서리 통과를 모두 판정할 수 있다고 가정하지 않습니다.

반경 r 질의에 clearance≥r 같은 조건을 쓸 수 있는 전제를 증명하고 경계 오차를 보수적으로 처리합니다. 맵·프로필 version과 동적 overlay를 함께 검사합니다. 큰·작은 에이전트의 실제 swept 형상과 비교해 공유 데이터가 놓치는 경우를 찾습니다.

## 득점 포인트

- clearance가 어떤 거리·형상·장애물 모델의 여유를 나타내는지 먼저 정의합니다. 중심 거리만으로 캡슐 높이·경사·모서리 통과를 모두 판정할 수 있다고 가정하지 않습니다.
- 큰·작은 에이전트의 실제 swept 형상과 비교해 공유 데이터가 놓치는 경우를 찾습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: clearance가 어떤 거리·형상·장애물 모델의 여유를 나타내는지 먼저 정의합니다.

## 더 파고들 거리

- [기본 상황과 비교: 격자 맵에서 목적지 칸은 비어 있지만 양옆에 벽이 있습니다. 캐릭터가 대각선으로 그 모서리를 지나가도 되나요?](/tech-interview/questions/grid-diagonal-corner/)

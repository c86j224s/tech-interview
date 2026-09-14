---
id: "path-smoothing-weighted-cost"
title: "경로의 코너를 직선으로 줄였더니 비싼 지형을 통과합니다. 거리 단축과 이동 비용 감소는 어떻게 구분하나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["경로 탐색","경로 스무딩","충돌","심화 질문"]
related: ["path-smoothing-validation","navmesh-grid-voxel","grid-diagonal-corner"]
promotedFrom: {"id":"path-smoothing-validation","prompt":"가중 지형에서 waypoint 수를 줄이는 것과 실제 이동 비용을 줄이는 것을 어떻게 비교하나요?"}
---

# 경로의 코너를 직선으로 줄였더니 비싼 지형을 통과합니다. 거리 단축과 이동 비용 감소는 어떻게 구분하나요?

## 구두 답변

직선이 더 짧아도 비싼 지형·경사·위험 구역을 통과하면 비용이 높아질 수 있습니다. smoothing 후보의 실제 이동 규칙과 누적 가중 비용을 원래 구간과 비교해야 합니다.

점 raycast가 통과해도 반경·높이·선회 제한이 다를 수 있어 swept footprint를 확인합니다. 실패하면 원래 경로 유지·짧은 병합·재탐색을 선택합니다. 거리·waypoint 수와 도달·비용 보장을 구분합니다.

## 득점 포인트

- 직선이 더 짧아도 비싼 지형·경사·위험 구역을 통과하면 비용이 높아질 수 있습니다. smoothing 후보의 실제 이동 규칙과 누적 가중 비용을 원래 구간과 비교해야 합니다.
- 거리·waypoint 수와 도달·비용 보장을 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 직선이 더 짧아도 비싼 지형·경사·위험 구역을 통과하면 비용이 높아질 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 격자나 NavMesh에서 찾은 경로의 코너를 직선으로 줄일 때 캐릭터 반경·경사·동적 장애물을 어떻게 재검증하나요?](/tech-interview/questions/path-smoothing-validation/)

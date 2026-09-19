---
id: game-navmesh-funnel-clearance
title: funnel이 만든 중심선이 agent 몸체에 안전하다고 바로 말할 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 게임 서버
tags:
  - NavMesh
  - funnel
related:
  - navmesh-grid-voxel
---
# funnel이 만든 중심선이 agent 몸체에 안전하다고 바로 말할 수 없는 이유는 무엇인가요?

## 구두 답변
funnel은 corridor의 point visibility를 줄이는 geometry 알고리즘이지 agent의 footprint 안전성을 증명하지 않습니다. 폭 2.02m인 portal을 point agent가 통과한다고 해도 반경 1m capsule은 이론상 1cm 여유뿐이고, 회전·수치 오차·동적 점유를 고려하면 sweep이 실패할 수 있습니다. 폭이 정확히 2r이면 tolerance가 0인 한계이며 회전 중 footprint가 portal 밖으로 나가는지는 주변 geometry에 따라 달라집니다. 따라서 profile별 baked NavMesh나 corridor shrink를 사용하고, waypoint segment마다 capsule/character shape sweep을 실행합니다. 검사에는 반경뿐 아니라 높이, 경사, step, 층 연결, off-mesh link와 map/profile version을 넣습니다. point profile 결과를 boss profile에 재사용하면 중심선은 같아도 몸체가 벽에 걸립니다. dynamic obstacle이 sweep 뒤 닫히면 결과를 강행하지 않고 대기·재탐색·더 보수적인 waypoint 중 정책을 적용합니다.


폭 숫자만으로도 한계가 드러납니다. 반경 1m agent에 portal 폭 2.02m를 주면 중심선 기준 여유는 0.01m씩일 뿐이고, sweep tolerance가 0.02m라면 같은 경로가 실패합니다. 여기에 capsule 높이와 계단의 수직 clearance를 더하면 2D funnel 통과와 3D 이동 가능성이 달라집니다. 따라서 bake 시 profile을 선택하지 않은 corridor는 “점 agent용 후보”로만 표시하고, 실행기는 profile mismatch를 성공으로 처리하지 않아야 합니다. sweep 결과는 해당 map generation에서만 유효하므로 NavMesh 갱신 뒤에는 이전 성공 결과를 재사용하지 않습니다.
## 득점 포인트
- visibility와 finite footprint를 분리한다.
- 폭·tolerance를 구체적으로 계산한다.
- profile bake/shrink와 shape sweep을 제시한다.
- 동적 장애물 재검증을 포함한다.

## 감점 포인트
- waypoint가 corridor 안이면 모두 안전하다고 한다.
- 반경만 보고 높이와 회전을 무시한다.
- point path를 큰 agent에 재사용한다.
- sweep 성공을 영구 보장으로 오해한다.

## 더 파고들 거리
- 공통 clearance field의 보수 오차는?
- 문이 이동 사이 닫힐 때 상태 전이는?

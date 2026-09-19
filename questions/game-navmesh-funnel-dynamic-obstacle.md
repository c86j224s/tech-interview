---
id: game-navmesh-funnel-dynamic-obstacle
title: >-
  NavMesh 경로의 마지막 polygon이 목표 polygon이 아닙니다. partial corridor를 funnel에 넣기 전에 목표를
  어떻게 정하나요?
difficulty: 중하
category: 게임 서버
tags:
  - NavMesh
  - funnel
related:
  - dynamic-path-revalidation
---
# NavMesh 경로의 마지막 polygon이 목표 polygon이 아닙니다. partial corridor를 funnel에 넣기 전에 목표를 어떻게 정하나요?

## 구두 답변
마지막 polygon이 goal polygon이 아니면 결과를 partial로 취급하고 목적지 G를 직선으로 붙이지 않습니다. 여기서 last reachable ref와 그 위의 endpoint를 funnel 종료점으로 쓰는 것은 인용 API의 보편 보장이 아니라 애플리케이션 통합 정책이므로 실제 Detour release의 query result와 project의 closest-point 계산을 source/test로 확인해야 합니다. 구체적으로 결과가 polygon refs `[poly10, poly11]`, `partial=true`, last ref `poly11`, goal이 닫힌 문 너머라면 G를 추가하지 않고 poly11에서 계산한 reachable E=(7.8,1.2)를 선택합니다. funnel은 S→portal→E까지만 만들고 E→G segment는 만들지 않습니다. `partial=false`이고 last ref가 goal polygon일 때만 G를 정상 endpoint로 씁니다. 결과에는 partial flag, last ref, chosen endpoint reason, map/overlay version, request·goal generation을 남깁니다. 이동 직전 portal validity와 profile sweep을 다시 확인하고 문이 닫혔거나 generation이 바뀌었으면 중지·대기·재탐색합니다. E의 좌표와 `partial` 해석은 이 문서의 설명용 trace이며 특정 API release 실행 결과가 아닙니다.


partial endpoint를 선택한 뒤에도 그것이 곧 이동 성공을 뜻하지는 않습니다. poly11의 E가 문짝에 너무 가까우면 E에서 멈출 위치를 다시 안쪽으로 투영하거나 대기 상태로 전환해야 하며, 이 보정은 선택한 profile의 clearance를 통과해야 합니다. 비동기 query가 끝난 사이 overlay generation이 41에서 42로 바뀌면 같은 refs라도 결과를 폐기합니다. 로그에는 destination rejection reason을 남겨 “경로가 짧아서 실패”와 “partial 정책상 목표를 거부”를 구분합니다.
## 득점 포인트
- full goal과 partial reachable endpoint를 분리한다.
- polygon refs·partial flag·endpoint를 숫자로 추적한다.
- unreachable G를 corridor에 덧붙이지 않는다.
- version과 실행 직전 sweep을 재검증한다.

## 감점 포인트
- partial path를 full success로 저장한다.
- 마지막 polygon과 goal을 직선 연결한다.
- API가 closest point를 보장한다고 출처 없이 단정한다.
- 늦은 비동기 결과가 현재 goal을 덮게 둔다.

## 더 파고들 거리
- partial 상태를 NPC 상태 머신에서 어떻게 표현할까요?
- reachable endpoint가 문 가장자리일 때 clearance를 어떻게 보정할까요?

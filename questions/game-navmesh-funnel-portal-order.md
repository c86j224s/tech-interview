---
id: game-navmesh-funnel-portal-order
title: funnel algorithm에서 portal의 left/right 방향이 뒤집히면 어떤 오류가 생기나요?
difficulty: 중하
category: 게임 서버
tags:
  - NavMesh
  - funnel
related:
  - path-smoothing-validation
---
# funnel algorithm에서 portal의 left/right 방향이 뒤집히면 어떤 오류가 생기나요?

## 구두 답변
portal endpoint는 corridor 진행 방향과 polygon winding에 따라 left/right로 정해야 합니다. 선분 자체는 `(L,R)`와 `(R,L)`에서 같지만 oriented area 부호와 funnel의 안쪽 갱신 의미는 같지 않습니다. 예를 들어 S=(0,0), P1의 L=(3,2), R=(3,-2), P2의 L=(6,1), R=(6,-1)에서 P2만 뒤집으면 정상적으로 좁혀야 할 right/left 판정이 반대로 해석되어 조기 crossing 또는 잘못된 widening이 생길 수 있습니다. 그 결과 이전 안정 corner를 놓치거나 corridor 밖 waypoint를 출력합니다. 검증은 정상/한 portal 반전 입력을 같은 구현에 넣고 apex index, left/right index, signed area, waypoint의 polygon 포함 여부를 비교하는 방식입니다. 화면에서 선분이 맞는지만 보지 않고 polygon ref 순서, handedness, 층 연결과 map version을 검사합니다. endpoint를 고쳐도 funnel은 point geometry일 뿐 agent clearance를 보장하지 않으므로 shape sweep은 별도 단계입니다.


방향 검사는 각 portal을 읽을 때 `cross(apex, endpoint)`의 부호와 이전 endpoint의 부호를 함께 로그로 남기는 방식으로 자동화합니다. 정상 corridor에서 반전 portal만 바꾸었을 때 실패해야 할 fixture가 통과한다면 검사가 좌우 의미를 실제로 사용하지 않는 것입니다. polygon ref가 [A,B,C]인데 portal endpoint가 B→A 방향으로 저장된 경우처럼 ref 순서와 endpoint 순서를 함께 검증해야 하며, 단순히 선분의 두 끝점이 같은 집합인지 검사하는 것으로는 부족합니다.
## 득점 포인트
- endpoint 순서를 진행 방향·winding 계약으로 설명한다.
- 정상과 반전 trace의 signed area와 index를 비교한다.
- corridor 포함 여부와 portal 그림을 구분한다.
- clearance를 funnel과 별도로 검증한다.

## 감점 포인트
- 순서를 바꿔도 같다고 한다.
- 선분이 보이면 안전하다고 한다.
- collision sweep으로 방향 오류를 숨긴다.
- 층과 좌표계 계약을 무시한다.

## 더 파고들 거리
- handedness import pipeline의 invariant는?
- off-mesh link의 높이와 방향은?

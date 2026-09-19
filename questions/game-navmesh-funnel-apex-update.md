---
id: game-navmesh-funnel-apex-update
title: funnel의 양쪽 경계가 서로 교차할 때 어느 점을 waypoint로 확정하나요?
difficulty: 중하
category: 게임 서버
tags:
  - NavMesh
  - funnel
related:
  - dynamic-path-revalidation
---
# funnel의 양쪽 경계가 서로 교차할 때 어느 점을 waypoint로 확정하나요?

## 구두 답변
먼저 orientation convention을 선언해야 합니다. 여기서는 `S[t]` 같은 상태 표기가 아니라 2D cross-product의 부호로 left/right를 판정하고, right 갱신이 기존 left를 넘는 경우 left 쪽의 이전 안정 endpoint를 내보내는 규약을 택하겠습니다. crossing을 일으킨 현재 endpoint를 곧바로 출력하지 않고, 이전 stable corner를 새 apex로 삼아 crossing portal부터 재처리합니다. 예를 들어 S=(0,0), P1에서 안정 left=(3,2), P2에서 안정 right=(6,-1)을 유지하다 P3 endpoint가 right를 left 너머로 밀면, P3 자체가 아니라 stable left를 waypoint로 확정하고 P3를 새 apex 기준으로 다시 봅니다. 반대 방향 crossing에서는 대칭으로 stable right를 출력합니다. 이 선택은 funnel convention마다 부호와 endpoint가 달라질 수 있으므로 “항상 left”가 아니라 코드의 orientation test, reprocess index, collinear·epsilon 정책을 함께 테스트해야 합니다. 재처리 index가 앞으로만 가고 동일 endpoint가 반복되지 않는 termination invariant도 필요합니다.


재처리 구현에서는 출력 corner의 portal index보다 앞선 portal을 다시 소비하지 않도록 규칙을 세웁니다. 예를 들어 P3에서 crossing이 발생해 P1의 stable left를 출력했다면 새 apex는 P1 endpoint이고 P2와 P3를 새 funnel에 넣는지, P3부터 넣는지를 코드 계약으로 고정해야 합니다. 이 인덱스를 모호하게 두면 corner를 건너뛰거나 같은 P1을 반복 출력합니다. 테스트는 right-over-left와 left-over-right를 각각 넣고 waypoint가 corridor 안이며 마지막에 G에 도달하는지 검사해야 합니다.
## 득점 포인트
- crossing endpoint와 이전 stable corner를 구분한다.
- 선택한 cross-product convention과 양방향 대칭을 제시한다.
- 출력 corner를 새 apex로 삼고 portal을 재처리한다.
- epsilon과 termination을 검증한다.

## 감점 포인트
- 현재 endpoint를 항상 출력한다.
- portal 중심을 순서대로 반환한다.
- orientation convention 없이 보편 규칙이라고 한다.
- 재처리로 무한 반복할 가능성을 놓친다.

## 더 파고들 거리
- collinear portal에서 어떤 tie-break를 둘까요?
- corner 이후 polygon ref와 profile을 어떻게 검증할까요?

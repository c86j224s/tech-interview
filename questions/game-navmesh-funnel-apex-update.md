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

현재 입력한 endpoint를 무조건 출력하지 않고, 반대 경계를 지탱하던 이전 corner를 출력합니다. 새 right가 기존 left를 넘으면 기존 left를, 새 left가 기존 right를 넘으면 기존 right를 waypoint로 확정합니다. 그 점을 새 apex로 만들고, 그 corner가 속했던 portal의 다음 index부터 다시 검사합니다. crossing portal만 재검사하면 새 apex와 그 사이에 있던 portal 제약을 잃을 수 있습니다.

+x 진행, +y 위쪽인 예를 보겠습니다. S=(0,0), P1의 left/right=(3,2)/(3,-2), P2=(6,1)/(6,-1)이면 허용 기울기는 [-2/3,2/3]에서 [-1/6,1/6]으로 좁아집니다. P3의 left/right가 (8,-3)/(8,-5)이면 새 left도 현재 right보다 아래에 놓입니다. `cross((8,-3),(6,-1))=10`으로 방향을 확인하고 기존 right(6,-1)를 출력합니다. 새 apex는 P2에 있으므로 P3부터 다시 처리합니다. 만약 확정 corner가 P1에 있었다면 P2와 P3를 모두 다시 봐야 하며 이것은 임의로 생략할 수 있는 선택지가 아닙니다.

이후 G=(10,-4)를 종료 portal로 넣습니다. S→G 직선은 x=6에서 y=-2.4라 P2를 통과하지 못하지만, 확정 corner를 경유하면 앞선 제약을 보존할 수 있습니다. 반대 방향 회전은 좌표를 y축으로 대칭시켜 같은 검사를 합니다. handedness와 cross 부호를 바꾸면 코드의 부등호는 바뀔 수 있어도 같은 기하 상황의 물리적 corner가 달라지는 것은 아닙니다.

구현에서는 apex·left·right의 좌표뿐 아니라 각각의 portal index를 저장합니다. scan index는 되돌아갈 수 있으므로 항상 증가한다고 설명하면 안 됩니다. 대신 새 apex가 corridor에서 전진하고 동일 corner를 무한히 출력하지 않도록 동일점·collinear·epsilon 처리를 일관되게 둡니다. 결과는 점 경로이므로 agent 반경과 동적 장애물의 실행 전 검증은 별도입니다.
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

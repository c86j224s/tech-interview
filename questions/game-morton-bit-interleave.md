---
id: game-morton-bit-interleave
title: 2차원 좌표를 Morton code로 바꿀 때 bit interleave가 무엇을 보존하나요?
difficulty: 중하
category: 게임 서버
tags:
  - Morton code
  - Z-order
  - 공간 locality
related:
  - spatial-hash-grid
---
# 2차원 좌표를 Morton code로 바꿀 때 bit interleave가 무엇을 보존하나요?

## 구두 답변

Morton encoding은 먼저 실수 좌표를 원점과 cell size로 양자화한 뒤, 각 축의 정수 비트를 번갈아 배치해 하나의 key를 만드는 과정입니다. 2비트 4×4 격자에서 bit 순서를 `x1,y1,x0,y0`로 고정하면 `(x,y)=(2,1)`은 `x=10₂`, `y=01₂`이므로 `1001₂=9`입니다. 반대로 code 9의 네 자리를 다시 두 자리씩 읽으면 `x=10₂=2`, `y=01₂=1`로 복원됩니다. `(1,2)`는 `0110₂=6`이고, 같은 상위 prefix를 공유하는 점은 같은 큰 quadrant에 있다는 정보를 얻습니다.

보존되는 것은 계층 cell의 prefix와 대략적인 locality이지 유클리드 거리의 완전한 순서가 아닙니다. 예를 들어 `(1,1)`의 code는 3이고 `(2,1)`은 9여서 실제로 한 칸 옆이어도 큰 prefix 경계를 건널 수 있습니다. 반대로 code가 연속이어도 Z-order가 방문한 다른 quadrant의 점이 섞일 수 있습니다. 따라서 Morton key로 후보를 정렬한 뒤 실제 좌표, 거리, AABB, collision layer를 다시 판정해야 합니다.

음수 좌표는 `int`를 `uint`로 재해석하지 않습니다. `origin=-8`, `cell=1`에서 world `x=-7`을 양자화하면 `qx=1`이고, 허용 범위 `[0,2^b-1]`를 검사한 뒤 interleave합니다. origin, cell size, bit width, axis order를 encode schema에 넣어 decode와 동일하게 유지하고, 경계 밖이면 거절합니다. bit 수가 달라지면 prefix 의미와 정렬 key가 바뀌므로 이전 index와 섞지 않습니다. 즉 Morton은 hierarchy/index 도구이지 정확한 공간 predicate 자체가 아닙니다.

## 득점 포인트

- 양자화 후 x/y 비트를 교차 배치하고 prefix가 계층 cell을 나타낸다고 설명한다.
- locality가 근사일 뿐 유클리드 거리·완전한 인접성·정확한 범위 predicate가 아니라고 구분한다.
- 음수 좌표 mapping, bit width, origin, axis order를 계약으로 고정한다.

## 감점 포인트

- Morton code 순서가 실제 거리순과 동일하다고 말한다.
- signed 좌표를 unsigned로 바로 cast해도 경계가 안전하다고 주장한다.
- code range만 읽고 실제 좌표 재검사가 필요 없다고 설명한다.

## 더 파고들 거리

- 사각형 query가 왜 여러 disjoint interval로 나뉘는지 작은 quadtree로 보여 주세요.
- 축당 bit를 늘릴 때 code 폭·메모리·world range를 어떻게 계산할까요?
- 이동 객체의 key 갱신과 old/new index reader 수명을 어떻게 설계할까요?

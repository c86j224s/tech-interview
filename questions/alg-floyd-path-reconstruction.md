---
id: alg-floyd-path-reconstruction
title: Floyd-Warshall에서 거리 행렬만 저장하면 최단 경로 정점을 어떻게 복원할 수 없으며 어떤 보조 정보를 둬야 하나요?
difficulty: 하
category: 알고리즘
tags:
  - Floyd-Warshall
  - path reconstruction
  - next matrix
related:
  - dynamic-programming-state-sufficiency
---
# Floyd-Warshall에서 거리 행렬만 저장하면 최단 경로 정점을 어떻게 복원할 수 없으며 어떤 보조 정보를 둬야 하나요?

## 구두 답변

거리 행렬만으로는 각 최단 비용을 만든 다음 정점을 일반적으로 복원할 수 없습니다. 같은 비용의 경로가 여러 개일 수 있고, 거리 갱신 과정에서 어떤 중간 정점을 선택했는지 정보가 사라지기 때문입니다. 따라서 초기 직접 간선에는 `next[i][j]=j`를 두고, k를 거치는 경로로 `D[i][j]`가 개선될 때 `next[i][j]=next[i][k]`처럼 갱신해야 합니다.

예를 들어 직접 A→C 비용이 10이고 A→B=2, B→C=3이면 B 단계에서 `D[A][C]`가 5로 내려갑니다. 이때 `next[A][C]`를 B로 두는 것이 아니라 보통 `next[A][B]`에 저장된 첫 이동으로 설정해 A→B→C를 따라갈 수 있게 합니다. 구현이 중간 정점 행렬을 쓰는 방식이라면 분할 정보를 재귀적으로 해석하는 다른 복원 절차를 둡니다.

거리와 path metadata는 같은 update 분기에서 갱신해야 합니다. 거리는 5인데 next가 예전 직접 경로를 가리키면 비용과 경로가 서로 다른 결과가 됩니다. next를 따라갈 때는 최대 n개 정도의 방문 한계를 두어 음수 cycle이나 잘못된 metadata로 무한 루프에 빠지지 않게 하고, negative-cycle affected 쌍에는 유한 최단 경로를 복원하지 않는 계약을 둡니다.

거리만 저장한 경우 A-B-D와 A-C-D가 같은 비용이면 최종 5에서 어느 경로를 택했는지 사라집니다. 원본 graph를 다시 훑는 방식은 모든 간선과 tie 정책을 보유한다는 별도 계약이지 거리 행렬만의 복원은 아닙니다. next-only 방식에서는 직접 A-B를 초기화한 뒤 A-C가 10에서 5로 개선될 때 next[A][C]를 B로 바꾸고, 이후 A-B-C를 따라갑니다. i=i는 빈 경로인지 cycle 복원인지 정해야 하며, INF는 no path입니다. negative-cycle affected 쌍은 next loop를 최대 n회 검사한 뒤 상태 오류로 중단해야 합니다. next 또는 중간 정점 metadata는 O(n²) 공간을 추가합니다.

## 득점 포인트

- 거리만으로 경로의 선택·동률 정보를 보존할 수 없다고 답합니다.
- next 또는 중간 정점 predecessor를 거리 update와 함께 저장합니다.
- A→C가 A→B→C로 개선될 때 next의 첫 이동을 바꾸는 상태를 설명합니다.
- cycle 영향과 복원 루프의 상한·오류 상태를 언급합니다.

## 감점 포인트

- 최종 거리만 보고 항상 유일한 경로를 역산할 수 있다고 합니다.
- 거리만 바꾸고 next metadata를 나중에 임의로 추정합니다.
- `next[i][j]=k`와 첫 이동 저장 의미를 구분하지 않습니다.
- negative cycle에서도 최단 경로가 있다고 가정해 복원을 무한 반복합니다.

## 더 파고들 거리

- 동일 비용 경로가 여러 개일 때 사전순·간선 수 최소 등 tie 정책을 어떻게 고정할까요?
- next 행렬을 저장하기 어려운 규모에서 일부 source만 경로를 복원하려면 어떤 재계산 전략을 쓸까요?

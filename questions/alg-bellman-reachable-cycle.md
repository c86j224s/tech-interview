---
id: alg-bellman-reachable-cycle
title: Bellman-Ford의 n번째 라운드에서 갱신되는 정점이 있으면 왜 source-reachable negative cycle을 의미하나요?
difficulty: 중하
category: 알고리즘
tags:
  - Bellman-Ford
  - negative cycle
  - reachability
related:
  - algorithm-dijkstra-negative-edge
---
# Bellman-Ford의 n번째 라운드에서 갱신되는 정점이 있으면 왜 source-reachable negative cycle을 의미하나요?

## 구두 답변

n-1회 동안 모든 간선을 완화한 뒤에도 `dist[v]`를 낮출 수 있다는 것은 source에서 v까지 더 긴 walk가 기존의 모든 단순 경로보다 싸다는 뜻입니다. source-reachable negative cycle이 없다면 cycle을 제거해도 더 나빠지지 않는 단순 최단 경로가 존재하고, 그 경로는 최대 n-1개 간선으로 표현됩니다. 따라서 n번째 라운드의 갱신은 cycle을 포함한 경로가 계속 비용을 낮추고 있다는 신호입니다.

단, 갱신 조건에 `dist[u] != INF`를 넣어야 합니다. source에서 닿지 않는 음수 cycle은 그 영역의 거리를 낮추지만 single-source 결과에는 영향을 주지 않습니다. 예를 들어 S가 A에만 닿고 X↔Y가 별도 요소라면 X,Y는 계속 미도달 상태입니다.

갱신되는 정점 하나를 기록했다고 모든 정점이 `-INF`라는 뜻은 아닙니다. cycle에 도달할 수 있고 cycle에서 target으로 나갈 수 있는 쌍만 유한 최단값이 없습니다. 그래서 cycle 영향까지 표현하려면 갱신 후보를 seed로 다시 도달성 탐색하거나, cycle 정점을 복원한 뒤 source-to-cycle 및 cycle-to-target 조건을 검사합니다. 출력은 finite, unreachable, negative-cycle-affected를 구별해야 합니다.

실제 trace에서 간선 순서를 S-A, A-B, B-A로 두면 시작 `[0,INF,INF]`, 첫 pass 뒤 `[0,-2,2]`, 다음 pass에서 B-A가 다시 내려가며 갱신이 계속됩니다. n-1=2회 뒤에도 갱신이 남는다는 사실이 단순 경로 상한과 모순되므로 cycle을 포함한 walk가 원인입니다. 갱신된 v 하나가 cycle의 모든 정점이라는 뜻은 아니어서 parent를 n번 따라가 cycle 내부로 들어가는 복원 단계와, cycle에서 각 target으로 나가는 탐색을 분리합니다. cycle에 닿지 않는 X-Y의 `dist`는 INF로 남고, cycle에 도달하지만 출구가 없는 target은 affected가 아닙니다. 따라서 boolean 하나가 아니라 target별 상태가 필요합니다.

## 득점 포인트

- n-1 간선 경로 상한과 n번째 개선의 모순을 연결합니다.
- `dist[u] != INF` 조건으로 source reachability를 보존한다고 설명합니다.
- negative cycle 영향이 모든 행과 열에 퍼지는 것이 아니라 방향 도달성에 따름을 말합니다.
- 음수 간선과 source-reachable negative cycle을 구별합니다.

## 감점 포인트

- 그래프 어디엔가 음수 cycle만 있으면 source 결과가 무조건 실패한다고 합니다.
- n번째 갱신 정점 하나만 cycle의 모든 정점이라고 단정합니다.
- 미도달 정점도 초기값 0으로 두어 single-source 결과에 섞습니다.
- cycle 영향이 없는 target까지 `-INF`로 반환합니다.

## 더 파고들 거리

- 갱신 정점에서 실제 cycle 정점을 복원할 때 parent를 몇 번 따라가야 하며, 여러 cycle은 어떻게 표현할까요?
- source-reachable cycle이 있어도 cycle에서 나가는 경로가 없는 target의 결과는 어떤 상태로 남겨야 할까요?

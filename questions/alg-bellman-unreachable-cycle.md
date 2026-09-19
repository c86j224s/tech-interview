---
id: alg-bellman-unreachable-cycle
title: 그래프에 음수 사이클이 있지만 출발점에서 닿지 않는다면 Bellman-Ford의 단일 출발 결과는 어떻게 처리하나요?
difficulty: 하
category: 알고리즘
tags:
  - Bellman-Ford
  - negative cycle
  - unreachable
related:
  - algorithm-dijkstra-negative-edge
---
# 그래프에 음수 사이클이 있지만 출발점에서 닿지 않는다면 Bellman-Ford의 단일 출발 결과는 어떻게 처리하나요?

## 구두 답변

source에서 도달할 수 없는 음수 cycle은 그 source의 거리 표를 낮추지 않으므로 single-source 결과에서는 영향 없는 미도달 영역으로 남깁니다. `dist[source]=0`, 나머지를 `INF`로 초기화하고, 완화할 때 `dist[u] == INF`인 간선을 건너뛰면 X↔Y 같은 분리된 cycle은 갱신되지 않습니다. 결과에서 X와 Y는 negative-cycle 상태가 아니라 unreachable입니다.

예를 들어 S→A가 있고 별도 요소에 X→Y=-3, Y→X=1이 있으면 cycle 비용은 -2지만 S에서 X로 가는 경로가 없습니다. Bellman-Ford는 source에서 출발한 경로만 표현하므로 그 cycle을 볼 수 없습니다. 모든 정점을 0으로 초기화하는 변형은 전역 음수 cycle 탐지에 사용할 수 있지만, 그것을 일반 single-source 거리 배열로 해석하면 안 됩니다.

결과 타입도 구분하는 편이 좋습니다. `FINITE(d)`, `UNREACHABLE`, `NEGATIVE_CYCLE_REACHABLE`을 별도 상태로 두면 큰 음수 sentinel을 실제 거리처럼 다루는 오류를 피할 수 있습니다. source에서 cycle에 도달하지만 cycle에서 target으로 나갈 수 없는 경우와, target까지 나갈 수 있어 `-INF` 영향을 받는 경우도 target별로 나누어야 합니다.

두 입력을 나란히 보면 범위가 분명합니다. `S→A=2`와 분리된 `X→Y=-3,Y→X=1`에서는 모든 pass에서 X와 Y의 u가 INF라 relax를 건너뜁니다. `S→A=2,A→X=4`를 추가하면 X에 도달한 뒤 cycle이 n번째 pass 갱신 seed가 됩니다. 그래도 cycle에서 Z로 나가는 경로가 없으면 Z의 finite 경로는 자동으로 -INF가 되지 않습니다. 0 초기화 전역 탐지는 모든 정점을 가상의 source에서 reachable하게 만드는 별도 모드이며, 그 결과를 S의 거리로 사용하면 안 됩니다. API는 source 인자와 전역 cycle 탐지를 분리하고, `FINITE`, `UNREACHABLE`, `NEGATIVE_CYCLE_REACHABLE` 상태를 타입으로 구분해야 합니다.

## 득점 포인트

- source 도달성 조건이 negative cycle 탐지 범위를 결정한다고 설명합니다.
- `INF` 초기화와 `dist[u] == INF` skip을 구체적으로 말합니다.
- 전역 cycle 탐지 변형과 single-source 최단 거리의 차이를 구분합니다.
- finite·unreachable·negative 영향 상태를 결과 계약으로 나눕니다.

## 감점 포인트

- 그래프에 음수 cycle이 있으면 source와 무관하게 항상 오류라고 합니다.
- 미도달 정점을 0으로 초기화하는 방식을 표준 single-source 구현으로 제시합니다.
- cycle의 존재만으로 모든 target의 거리를 `-INF`로 반환합니다.
- `INF`를 실제 정수와 같은 방식으로 연산합니다.

## 더 파고들 거리

- source는 cycle에 도달하지만 특정 target으로 나갈 수 없는 경우 target별 결과를 어떻게 표기할까요?
- 전역 음수 cycle 탐지와 단일 출발 최단 거리 API를 하나의 타입으로 제공할 때 어떤 모드를 분리해야 할까요?

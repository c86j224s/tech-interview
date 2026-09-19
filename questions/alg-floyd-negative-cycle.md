---
id: alg-floyd-negative-cycle
title: Floyd-Warshall 결과의 음수 대각선은 어떤 cycle을 의미하며 모든 쌍의 거리가 무한히 작아지나요?
difficulty: 중하
category: 알고리즘
tags:
  - Floyd-Warshall
  - negative cycle
  - all pairs
related:
  - algorithm-dijkstra-negative-edge
---
# Floyd-Warshall 결과의 음수 대각선은 어떤 cycle을 의미하며 모든 쌍의 거리가 무한히 작아지나요?

## 구두 답변

최종 행렬에서 `D[v][v] < 0`이면 v가 음수 cycle에 속하거나 v에서 출발해 cycle을 돌고 다시 v로 돌아오는 음수 비용 경로가 있다는 뜻입니다. 하지만 그 사실만으로 모든 `D[i][j]`가 무한히 작아지는 것은 아닙니다. source i가 cycle 정점 v에 도달할 수 있고 v에서 target j로 나갈 수 있을 때 그 쌍만 cycle을 반복해 비용을 계속 낮출 수 있습니다.

예를 들어 S→A가 있고 A가 음수 cycle에 들어가지만 A에서 B로 나가는 경로가 없다면 S→A는 음수 cycle 영향을 받지만 S→B는 그 cycle을 거쳐 갈 수 없어 같은 이유로 `-INF`가 되지 않습니다. 반대로 A에서 B로 가는 경로가 있으면 S→B도 cycle을 반복한 뒤 이동할 수 있습니다.

그래서 음수 대각선 정점 목록을 구한 뒤 각 i,j에 대해 `D[i][v] != INF`와 `D[v][j] != INF`를 함께 검사해 영향을 전파합니다. 모든 셀을 일괄 `-INF`로 바꾸는 것은 방향성과 도달성을 무시한 오판입니다. `D[v][v] < 0`은 finite 최단 경로가 아닌 영역을 식별하는 신호이며, 결과 타입에서 별도 상태로 표현해야 합니다.

수치 예를 더 좁히면, `S→A=2`, `A→A=-1`, `A→B=4`에서 A의 대각선은 음수이고 S에서 A, A에서 B가 모두 reachable이므로 S-A와 S-B가 affected입니다. 별도 `C→C=-2`는 S에서 C로 갈 수 없으므로 S 행에 영향을 주지 않습니다. A에서 나가는 간선이 없는 D는 cycle을 거쳐 D로 갈 수 없으므로 A cycle의 affected target이 아닙니다. 구현은 음수 대각선 후보를 모은 뒤 `D[i][v]`와 `D[v][j]`의 유한 여부를 검사하거나 별도 reachability closure를 사용합니다. affected 쌍에 next를 따라가게 하면 loop가 될 수 있으므로 finite path 복원을 거절해야 합니다.

## 득점 포인트

- 음수 대각선의 cycle 의미와 모든 쌍 영향의 조건을 분리합니다.
- source-to-cycle, cycle-to-target 두 도달성을 구체적으로 설명합니다.
- 방향 그래프에서 나가는 경로가 없는 target은 영향 밖일 수 있음을 듭니다.
- negative-cycle affected를 유한 거리와 별도 상태로 다룹니다.

## 감점 포인트

- 대각선 하나가 음수면 전체 행렬을 `-INF`로 만든다고 합니다.
- cycle에 도달하는 것만으로 모든 target이 영향받는다고 합니다.
- `D[v][v] < 0`을 단순히 v까지의 최단 거리가 음수라는 뜻으로만 해석합니다.
- 음수 cycle이 있는데도 finite 최단 경로를 정상 값으로 반환합니다.

## 더 파고들 거리

- 여러 음수 cycle이 있을 때 쌍별 영향 영역을 계산하는 가장 단순한 후처리는 무엇인가요?
- path reconstruction 요청이 negative-cycle affected 쌍에 들어오면 어떤 오류 또는 상태를 반환할까요?

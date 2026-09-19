---
id: alg-lca-ancestor-timestamps
title: LCA query에서 한 정점이 다른 정점의 조상인지 먼저 tin/tout으로 검사하는 이유는 무엇인가요?
difficulty: 하
category: 알고리즘
tags:
  - LCA
  - binary lifting
  - tin tout
related:
  - bfs-dfs-shortest-path
---
# LCA query에서 한 정점이 다른 정점의 조상인지 먼저 tin/tout으로 검사하는 이유는 무엇인가요?

## 구두 답변

`tin[u] ≤ tin[v]`이면서 `tout[v] ≤ tout[u]`이면 DFS에서 v의 전체 subtree가 u의 방문 구간 안에 있으므로 u가 v의 조상입니다. 이 검사는 O(1)에 가능하고, u가 v의 조상인 경우 답 자체가 u이므로 두 정점을 동시에 위로 올리는 일반 루프를 실행하지 않아도 됩니다. 반대로 v가 u의 조상이면 v를 바로 반환합니다.

예를 들어 u의 subtree를 DFS 구간 `[2,9]`, v를 `[5,6]`으로 기록했다면 v의 입장·퇴장이 u의 구간 안에 있어 u가 v의 조상입니다. discovery 시간만 비교하면 u보다 늦게 방문된 형제 subtree 정점도 조상으로 오인할 수 있습니다. `tout`은 해당 subtree의 모든 자손 처리가 끝난 시점을 보여 주므로 containment의 두 번째 조건입니다.

endpoint 검사를 생략하면 u가 v의 조상일 때 jump loop가 u를 지나 더 위 조상으로 올릴 수 있습니다. 자기 자신 query도 자기 조상으로 처리하면 즉시 반환됩니다. 다만 `tin/tout`의 카운터 증가 방식은 구현마다 다를 수 있으므로, 입장·퇴장 사건의 순서와 `is_ancestor` 비교자가 같은 정의를 사용해야 합니다.

분기 트리에서 형제 정점을 반례로 볼 수 있습니다. u의 interval이 `[2,9]`이고 형제 subtree의 w가 `[10,13]`이면 `tin[u]=2 < tin[w]=10`이지만 `tout[w]=13 ≤ tout[u]=9`가 아니므로 u는 w의 조상이 아닙니다. 이 검사는 LCA 루프의 endpoint 보존뿐 아니라 subtree 범위 질의의 경계에도 쓰입니다. 단, disconnected 입력에서 서로 다른 DFS component의 시간을 한 카운터로 합치면 숫자 containment만으로 조상이라고 오인할 수 있으므로 component/root ID도 함께 확인해야 합니다.


## 득점 포인트

- 두 containment 조건을 모두 말하고 O(1) 판정과 연결한다.
- 형제 subtree 반례로 tin 하나만으로 부족함을 설명한다.
- endpoint ancestor를 먼저 반환해 일반 jump 루프를 보호한다고 지적한다.

## 감점 포인트

- `tin[u] < tin[v]`만으로 조상 관계를 확정한다.
- 조상 정점이 답인 경우에도 무조건 parent로 올린다.
- `tout`을 기록하지 않거나 입·퇴장 시각 정책을 혼용한다.

## 더 파고들 거리

- DFS가 root에서 모든 정점을 방문하지 못한 disconnected 입력을 LCA 전처리 전에 어떻게 거절할까요?
- subtree interval을 Euler tour 배열의 구간으로 사용할 때 ancestor check와 range query의 공통 전제를 설명해 보세요.

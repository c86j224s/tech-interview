---
id: alg-lca-jump-table
title: Binary lifting에서 2^k번째 조상을 저장하면 임의의 d단계 상승을 어떻게 구성하나요?
difficulty: 하
category: 알고리즘
tags:
  - LCA
  - binary lifting
  - ancestor table
related:
  - graph-representation
---
# Binary lifting에서 2^k번째 조상을 저장하면 임의의 d단계 상승을 어떻게 구성하나요?

## 구두 답변

`d`를 이진수로 분해하고, 켜진 비트 k에 대해 `up[current][k]`를 적용하면 됩니다. `up[v][k]`는 v에서 `2^k`단계 위의 조상이고 `up[v][k]=up[up[v][k-1]][k-1]`로 구성합니다. 예를 들어 `d=13=8+4+1`이면 현재 정점에서 8단계, 이어서 4단계, 마지막 1단계 점프를 수행해 총 13단계 위에 도달합니다.

root의 parent를 자기 자신으로 두는 정책이라면 높이보다 큰 d도 root에 머뭅니다. null parent를 쓴다면 각 점프가 sentinel에 도착했는지 확인해야 하며, 이를 실제 정점 0으로 해석하면 잘못된 LCA가 나옵니다. 보통 `LOG`를 최대 깊이를 덮도록 잡고, 깊이 차이를 먼저 맞춘 뒤 두 정점이 같은 조상을 가리키지 않는 높은 k부터 동시에 올립니다.

질의 비용은 켜진 비트 개수만 보면 최대 `O(log N)`이고, 표는 `O(N log N)` 공간을 사용합니다. 이 표는 고정 root의 rooted tree에 대한 것이므로 root가 매 query 바뀌면 depth와 ancestor 의미가 달라집니다. 다만 고정 root에서 세 번의 LCA를 계산하는 방식으로 새 root의 LCA를 구하는 별도 공식은 적용할 수 있습니다.

`d=13`의 실제 상태를 `cur=v`에서 시작해 기록하면 `cur←up[cur][3]`로 8단계, 이어 `cur←up[cur][2]`로 4단계, `cur←up[cur][0]`로 1단계를 적용합니다. 각 표 조회가 현재 cur를 입력으로 삼아야 하므로 미리 계산한 `up[v][3]`, `up[v][2]`, `up[v][0]`을 그대로 더하는 방식은 잘못될 수 있습니다. 깊이가 10인 정점에서 13단계를 요청했을 때 자기참조 root 정책은 root를 반환하고, null 정책은 세 번째 점프 전에 실패를 반환하는 등 API 결과가 다릅니다.


## 득점 포인트

- `13=8+4+1`의 점프 상태를 말한다.
- doubling recurrence와 root 경계 정책을 함께 설명한다.
- 전처리 `O(N log N)`, query `O(log N)`을 표의 의미와 연결한다.

## 감점 포인트

- `up[v][k]`를 k단계 조상이라고 해 `2^k` 의미를 잃는다.
- root 위 null/sentinel을 실제 정점처럼 읽는다.
- query root가 바뀌어도 같은 tin/tout을 새 root 기준으로 해석한다.

## 더 파고들 거리

- `u`와 `v`의 깊이를 맞춘 뒤 높은 k부터 동시에 올리는 이유를 LCA를 넘지 않는다는 조건으로 증명해 보세요.
- 깊은 트리에서 재귀 DFS 대신 명시적 stack으로 up 표와 tin/tout을 만드는 실행 상태를 설계해 보세요.

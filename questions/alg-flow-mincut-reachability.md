---
id: alg-flow-mincut-reachability
title: 증가 경로가 더 이상 없을 때 residual graph에서 source로부터 도달 가능한 정점 집합으로 어떤 cut을 얻나요?
difficulty: 중하
category: 알고리즘
tags:
  - max flow
  - min cut
  - residual reachability
related:
  - bfs-dfs-shortest-path
---
# 증가 경로가 더 이상 없을 때 residual graph에서 source로부터 도달 가능한 정점 집합으로 어떤 cut을 얻나요?

## 구두 답변

최종 residual graph에서 `s`로부터 양의 잔여 용량을 따라 도달 가능한 정점 집합을 `S`, 나머지를 `T`로 둡니다. 증가 경로가 없으므로 `t`는 `T`에 있어 `S,T`가 cut을 이룹니다. 원래 그래프의 `S→T` 간선이 포화되지 않았다면 그 순방향 잔여량을 따라 T의 정점으로 갈 수 있었을 것이므로 모순입니다. 따라서 이 간선들은 모두 포화되어 cut capacity가 현재 flow 값과 일치합니다.

예를 들어 종료 후 residual reachability가 `S={s,a}`, `T={b,t}`라면 원래 그래프에서 `s→b`, `a→b`, `a→t`처럼 S에서 T로 향하는 간선의 capacity를 합산합니다. `s`에서 residual edge를 따라 `a`에 갈 수 있다는 사실은 현재 flow를 더 보낼 수 있다는 뜻이지, reverse residual을 cut capacity에 더하라는 뜻은 아닙니다. cut capacity는 원래 방향의 S→T 간선 capacity 합입니다.

이렇게 flow 값과 cut capacity가 같아지면 max-flow/min-cut 정리에 따라 둘 다 최적입니다. 구현에서는 최종 BFS/DFS가 양의 residual만 따라가도록 하고, 원래 edge ID와 residual edge ID를 분리해 cut을 계산해야 합니다. residual에서 도달 가능한 집합을 구하기 전에 알고리즘이 정말 증가를 종료했는지도 확인해야 하며, 단순히 한 번의 BFS가 실패한 중간 상태를 최적 certificate로 해석하면 안 됩니다.

수치 예를 하나 더 분리해 보겠습니다. 종료 residual에서 `S={s,a}`, `T={b,t}`이고 원래 간선 `s→b`의 용량이 3, `a→b`가 2, `a→t`가 1이라면 이 cut의 capacity는 6입니다. `S→T` 간선에 잔여가 남아 있지 않아야 하므로 현재 flow도 이 세 간선을 각각 3,2,1만큼 사용하고, `T→S` 방향 원래 간선의 순유량은 cut을 가로지르는 값에서 상쇄되는 방향으로만 계산합니다. residual의 `b→a`를 BFS가 발견했다고 해서 그것을 원래 cut의 또 다른 capacity 1로 더하지 않습니다. 이 방향을 섞으면 certificate의 값이 실제 max-flow와 달라집니다.


## 득점 포인트

- `S`를 residual source-reachable, `T`를 나머지로 정의한다.
- 원래 `S→T` 간선 포화와 flow 값·cut capacity 일치를 연결한다.
- reverse residual 탐색과 원래 cut capacity 계산의 방향을 구분한다.

## 감점 포인트

- residual에서 도달 가능한 모든 방향의 용량을 cut에 더한다.
- 증가 경로가 한 번 실패한 상태를 최종 최대 flow로 단정한다.
- `S→T` 원래 간선이 남은 용량을 가져도 최소 컷이라고 말한다.

## 더 파고들 거리

- 원래 간선이 양방향으로 모두 존재할 때 S→T와 T→S capacity를 cut 계산에서 어떻게 분리하나요?
- floating-point capacity에서 “양의 residual”과 포화 판정을 어떤 수치 계약으로 고정할지 말해 보세요.

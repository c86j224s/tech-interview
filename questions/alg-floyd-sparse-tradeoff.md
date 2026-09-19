---
id: alg-floyd-sparse-tradeoff
title: 정점 수가 10만이고 간선이 희소한 그래프에도 Floyd-Warshall을 적용할 수 있나요?
difficulty: 하
category: 알고리즘
tags:
  - Floyd-Warshall
  - 희소 그래프
  - 복잡도
related:
  - graph-representation
---
# 정점 수가 10만이고 간선이 희소한 그래프에도 Floyd-Warshall을 적용할 수 있나요?

## 구두 답변

보통 적용하지 않습니다. Floyd-Warshall은 정점 수 n에 대해 세 겹의 루프를 돌며 `O(n³)` 시간과 `O(n²)` 거리 행렬을 사용하므로 n=100000은 입력이 희소해도 계산과 메모리 모두 현실 예산을 넘습니다. adjacency list로 입력을 저장한다고 삼중 루프와 모든 쌍 상태가 사라지는 것도 아닙니다.

먼저 정말 모든 source-target 쌍이 필요한지, 일부 source만 필요한지, 음수 간선이나 negative cycle을 다뤄야 하는지 나눕니다. 비음수 간선에서 source 하나면 Dijkstra, 음수 간선과 도달 가능한 cycle 탐지가 필요하면 Bellman-Ford를 검토합니다. 여러 source가 필요하면 source 반복, Johnson 계열 등 요구사항과 밀도에 맞는 대안을 비교해야 합니다. 구체적인 선택은 간선 수뿐 아니라 source 수와 메모리 예산으로 결정합니다.

반대로 정점 수가 작고 모든 쌍 질의 결과를 반복해서 읽으며 행렬 접근이 유리한 경우에는 Floyd-Warshall이 간결합니다. 출력이 거리뿐 아니라 경로라면 next 행렬이 추가로 필요합니다. 따라서 “전쌍”이라는 단어만 보고 선택하지 않고, `n³` 계산과 `n²` 저장을 실제 수치로 먼저 산정하겠습니다. n=100000이면 거리 셀만 10^10개라는 점이 첫 판단 근거입니다.

`n²=10^10` 셀은 8바이트 거리만으로 약 80GB이고, `n³=10^15`번의 비교는 E가 작아도 변하지 않습니다. 예를 들어 E=3V이고 source가 10개라면 10회 sparse single-source 실행의 저장량과 10^10 셀 행렬은 비교 대상부터 다릅니다. 비음수 단일 source는 Dijkstra, 음수 간선은 Bellman-Ford, 음수 cycle이 없고 여러 source 전쌍이 필요할 때는 Johnson을 검토합니다. 다만 all-pairs를 실제로 모두 출력해야 하면 출력 자체가 Ω(V²)이고, 부분 질의라면 source별 스트리밍이나 선택 계산으로 메모리를 줄일 수 있습니다. Johnson은 음수 cycle이 있는 경우 유한 전쌍 해를 제공하지 못하므로 cycle 정책을 먼저 정해야 합니다.

## 득점 포인트

- 희소 입력과 Floyd-Warshall의 조밀한 내부 상태 비용을 분리합니다.
- n=100000에서 `n²` 셀과 `n³` 반복을 숫자로 환산해 부적합성을 설명합니다.
- source 수, 음수 간선, all-pairs 요구를 알고리즘 선택 조건으로 사용합니다.
- 작은 그래프의 반복 전쌍 질의에는 적합할 수 있다는 경계도 말합니다.

## 감점 포인트

- adjacency list만 쓰면 Floyd-Warshall이 희소 시간으로 바뀐다고 합니다.
- 모든 쌍 요구면 정점 수와 무관하게 Floyd-Warshall을 선택합니다.
- Dijkstra를 음수 간선에도 그대로 추천합니다.
- 메모리 행렬과 경로 복원 metadata 비용을 언급하지 않습니다.

## 더 파고들 거리

- source가 전체 정점의 일부이지만 많을 때 source 반복과 Johnson 계열의 비용을 어떻게 비교할까요?
- 그래프가 동적으로 갱신될 때 전쌍 행렬 재계산과 질의 지연의 경계를 어떻게 정할까요?

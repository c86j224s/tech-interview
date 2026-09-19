---
id: alg-scc-condensation-dedup
title: SCC를 축약한 condensation graph에서 평행 간선을 제거해야 하나요?
difficulty: 하
category: 알고리즘
tags:
  - SCC
  - condensation DAG
  - 평행 간선
related:
  - algorithm-topological-cycle
---
# SCC를 축약한 condensation graph에서 평행 간선을 제거해야 하나요?

## 구두 답변

질의가 component 간 도달성이나 위상 순서라면 같은 `(component source, component target)` 쌍을 하나로 deduplicate해도 됩니다. `comp[v]`를 계산한 뒤 원래 간선 `u→v`에서 `comp[u]!=comp[v]`인 경우만 응축 edge 후보로 만들고, 이미 본 쌍을 집합으로 제거합니다. 평행 간선 두 개는 X에서 Y로 가는 가능성을 두 번 만들지 않으므로 boolean reachability나 단순 위상 순서에는 중복 정보입니다. 다만 원래 간선 수, 각 간선의 가중치, 이벤트 횟수, 용량 합이 의미라면 제거하지 말고 identity를 보존하거나 쌍별 집계를 저장해야 합니다.

예를 들어 `A1→B1`, `A2→B2`가 각각 SCC X와 Y 사이에 있으면 도달성 DAG에는 `X→Y` 한 개면 충분합니다. 그러나 X에서 Y로 연결된 원본 관계가 두 개라는 감사 질의에는 2라는 multiplicity가 필요합니다. 내부 간선은 응축 그래프의 component 간 edge가 아니므로 버립니다. 원본 SCC 안에 내부 간선이 하나라도 있는데 그것을 그대로 `X→X`로 넣으면 self-loop가 생겨 DAG 표현을 깨뜨립니다. 이는 “모든 SCC가 자기 loop를 가진다”는 뜻이 아닙니다.

평행 간선은 같은 방향으로 여러 개여도 cycle을 만들지 않지만, 반대 방향의 component 간선이 생기면 서로 도달 가능한 component들이므로 SCC가 아직 완전히 축약되지 않은 신호입니다. 따라서 DAG라는 수학적 결과와 표현 최적화인 dedup을 나눠 판단합니다. 저장 공간은 줄지만, weighted DP를 단순 dedup하면 가중치 의미를 잃습니다.

실무적으로는 응축 edge를 `(from,to)` set으로 만들 때 원본 간선의 payload를 어디에 보관할지도 함께 결정합니다. boolean reachability라면 payload 없이 한 쌍만 남기면 되지만, 가중치 최소값이라면 같은 쌍의 최소 weight를 갱신하고, 합계라면 모든 payload를 누적해야 합니다. 내부 edge를 버리는 시점도 component ID를 매긴 뒤로 고정해야 원본 정점의 self-loop와 component-level self-loop를 혼동하지 않습니다. 이처럼 dedup은 “DAG를 만들기 위한 필수 수학”이 아니라 질의에 맞춘 표현 정책입니다.


## 득점 포인트

- 도달성·위상 순서와 multiplicity·가중치·용량 질의를 구분합니다.
- `comp[u]==comp[v]` 내부 간선을 버리고 다른 component 쌍을 후보로 만드는 과정을 설명합니다.
- 두 원본 간선이 X→Y 하나로 줄어드는 구체 상태를 제시합니다.
- 평행 간선 자체는 DAG를 깨지 않으며 self-loop만 표현상 제거해야 함을 말합니다.
- dedup을 자료구조 선택으로 두고 무조건 후처리하지 않습니다.

## 감점 포인트

- 응축 그래프에서는 어떤 질의든 원본 간선을 하나만 남긴다고 단정합니다.
- 내부 간선을 self-loop로 남긴 채 DAG라고 설명합니다.
- 평행 간선을 제거하면 reachability가 사라진다고 말합니다.
- 원래 가중치 합이나 간선 수를 묻는 상황에서도 dedup합니다.
- SCC의 DAG 보장과 중복 edge 제거를 동일한 수학 명제로 취급합니다.

## 더 파고들 거리

- 같은 component 쌍에 가중치가 여러 개일 때 최소·최대·합 중 어떤 집계가 질의 의미를 보존하나요?
- 평행 간선을 유지한 DAG에서 경로 수 DP가 edge multiplicity를 의도적으로 반영하도록 상태를 어떻게 정의하나요?

---
id: alg-bridge-incremental-boundary
title: 간선을 온라인으로 추가할 때 기존 bridge가 cycle로 사라지는 것은 어떤 경로의 간선들인가요?
difficulty: 중하
category: 알고리즘
tags:
  - bridge
  - online update
  - cycle
related:
  - graph-representation
---
# 간선을 온라인으로 추가할 때 기존 bridge가 cycle로 사라지는 것은 어떤 경로의 간선들인가요?

## 구두 답변

새 간선이 이미 연결된 두 정점 `u`, `v`를 잇는다면, 기존 그래프에서 `u`와 `v` 사이에 있던 forest path의 간선들이 새 간선과 cycle을 이룹니다. 그 경로에 있던 bridge는 더 이상 bridge가 아닙니다. 예를 들어 bridge forest가 A-B-C이고 A-C를 추가하면 A-B와 B-C 각각에 우회 경로가 생겨 bridge count가 2개 줄어듭니다. 새 간선 자체도 cycle 안에 있으므로 bridge가 되지 않습니다.

반대로 `u`와 `v`가 서로 다른 연결 요소에 있다면 새 간선은 두 요소를 처음 연결하는 유일한 통로가 되어 bridge 하나를 추가합니다. 같은 연결 요소인지와 bridge-component forest에서 두 끝점의 경로가 무엇인지가 삽입 처리의 첫 분기입니다.

정적 low-link 배열을 한 번 계산해 두고 새 간선이 들어올 때 일부 `low`만 고치는 방식은 일반적으로 충분하지 않습니다. cycle이 forest path 전체의 bridge 상태를 바꾸기 때문입니다. 온라인 자료구조는 연결 요소용 DSU와 bridge-connected component forest를 유지하고, 같은 component를 연결할 때 path를 따라 component를 합치거나 reroot하는 전략을 사용합니다. 단, 구체적인 자료구조와 상환 복잡도는 별도 구현 계약으로 확인해야 합니다.

동일 요소 삽입에서 바뀌는 것은 새 간선 하나가 아니라 forest path 전체입니다. 상태를 `[A-B bridge, B-C bridge]`, count=2에서 시작해 A-C를 넣은 뒤 `[A-B non-bridge, B-C non-bridge, A-C non-bridge]`, count=0으로 기록해야 합니다. 다른 요소의 B-X 삽입은 path가 없으므로 새 edge만 bridge입니다. self-loop는 u-v 경로를 만들지 않고 일반적으로 bridge가 아니며, 중복 간선은 첫 삽입으로 생긴 병렬 우회를 반영합니다. DSU는 연결 여부를, bridge-component forest는 아직 bridge인 component 연결을 표현하므로 하나로 합치면 안 됩니다. reroot와 path compression의 구체 비용은 자료구조 구현에 달렸지만 cycle에 포함된 경로 전체를 해제한다는 불변식은 변하지 않습니다.

## 득점 포인트

- 같은 연결 요소면 두 끝점 사이의 기존 forest path 간선들이 cycle로 사라진다고 답합니다.
- 다른 연결 요소면 새 연결 간선이 bridge로 추가되는 경우를 분리합니다.
- A-B-C에 A-C를 추가하는 숫자 사례로 count 변화를 추적합니다.
- 정적 DFS 재사용과 온라인 bridge 자료구조의 문제를 구별합니다.

## 감점 포인트

- 새 간선이 같은 연결 요소를 잇는 경우에도 무조건 bridge count를 증가시킵니다.
- cycle에 포함되는 경로의 일부 간선만 임의로 bridge 해제합니다.
- low-link 배열 하나를 국소 수정하면 모든 삽입을 처리할 수 있다고 단정합니다.
- 연결 요소용 DSU와 bridge component forest를 같은 자료구조라고 설명합니다.

## 더 파고들 거리

- 새 간선이 bridge forest의 두 정점을 잇는 경우 path 압축과 reroot 비용을 어떻게 제한할까요?
- 간선 삭제까지 허용하면 삽입 전용 구조와 어떤 불변식·복구 경계가 달라질까요?

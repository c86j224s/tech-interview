---
id: alg-scc-reachability-dag
title: >-
  서로 도달 가능한 정점을 먼저 SCC로 묶으면 왜 이후 component-level reachability에서 순환을 별도로 처리하지 않아도
  되나요?
difficulty: 하
category: 알고리즘
tags:
  - SCC
  - condensation
  - reachability
related:
  - algorithm-topological-cycle
---
# 서로 도달 가능한 정점을 먼저 SCC로 묶으면 왜 이후 component-level reachability에서 순환을 별도로 처리하지 않아도 되나요?

## 구두 답변

SCC 안에서는 어느 정점에서 시작해도 다른 정점으로 돌아갈 수 있으므로, boolean reachability의 출발점을 component ID 하나로 치환할 수 있습니다. 모든 SCC를 하나의 정점으로 만들고 서로 다른 component 사이의 간선만 남기면 응축 그래프가 DAG가 됩니다. 서로 다른 component 사이에 다시 방향 cycle이 있다면 그 cycle을 따라 양 끝 component가 서로 도달 가능해져 원래 하나의 SCC였어야 하기 때문입니다. 따라서 이후 계산은 순환 내부를 재탐색하는 대신 위상 순서의 DAG DFS나 DP로 처리할 수 있습니다.

예를 들어 `A↔B`, `B→C`, `C→D`, `D→E`라면 `A,B`를 X로 묶어 `X→C→D→E`를 만듭니다. A에서 E로 가는지와 B에서 E로 가는지는 모두 X에서 E로 가는 하나의 질의가 됩니다. 반대로 C에서 A로 돌아가는 간선을 추가하면 X와 C가 서로 도달 가능해져 `{A,B,C}`가 새 SCC가 되고, 기존 component graph에 cycle을 억지로 남겨 두면 축약이 덜 된 것입니다.

축약은 모든 정보를 보존한다는 뜻은 아닙니다. boolean 도달성은 component ID와 DAG edge로 충분하지만, 원본 경로 수·내부 가중치·특정 시작점에서 특정 종료점까지의 경로 복원은 component 내부 요약을 추가해야 합니다. component 위상 순서는 실행 성공을 보장하지 않으며, 순환 component 안의 작업 순서나 외부 효과는 별도 정책입니다. 그래서 “순환을 처리하지 않는다”가 아니라 “SCC 내부의 상호 도달성을 먼저 quotient해 component-level 순환을 제거한다”가 정확한 표현입니다.

원본 질의가 들어오면 먼저 `comp[source]`와 `comp[target]`을 조회하고, 두 값이 같으면 내부 상호 도달성 때문에 즉시 true입니다. 다르면 응축 DAG에서 두 component 사이의 경로를 검사합니다. 이 두 단계가 있어야 component-level 계산 결과를 원본 정점 질의로 정확히 되돌릴 수 있습니다. 경로 개수는 이와 다르게 내부에서 선택되는 진입·이탈 경로를 세어야 하므로 단순 boolean DAG 결과를 재사용하면 안 되며, 저장 공간과 정확성 요구를 함께 비교해야 합니다.


## 득점 포인트

- SCC 내부 상호 도달성을 component ID로 치환하는 이유를 말합니다.
- `A↔B`를 X로 바꾸고 `X→C→D→E`를 계산하는 trace를 제시합니다.
- component cycle이면 maximality에 따라 더 큰 SCC가 된다는 근거를 설명합니다.
- boolean reachability와 경로 수·가중치·경로 복원을 분리합니다.
- DAG 위상 순서가 실제 작업 실행의 성공을 대신하지 않는다고 짚습니다.

## 감점 포인트

- 단순히 연결된 모든 정점을 하나의 SCC로 묶습니다.
- A→B 하나만 있어도 같은 component라고 말합니다.
- component DAG가 원본의 모든 경로 수를 자동 보존한다고 합니다.
- 순환 component 내부를 아무 정책 없이 위상 정렬로 실행할 수 있다고 합니다.
- 원본 정점의 `comp` 매핑 없이 component 결과만 사용합니다.

## 더 파고들 거리

- DAG reachability 질의 수와 component 수를 기준으로 DFS, bitset DP, transitive closure를 어떻게 선택하나요?
- 원본 정점 단위 결과를 복원해야 할 때 component 내부에 어떤 경계 상태를 추가로 저장해야 하나요?

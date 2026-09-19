---
id: scc-condensation
title: 강한 연결 요소와 응축 DAG
topic: 알고리즘
summary: 서로 도달 가능한 정점 묶음을 축약해 순환 내부와 순환 사이의 DAG 의존성을 분리합니다.
questionIds: []
prerequisites:
  - graph-search
related:
  - topological-sort
reviewedAt: '2026-09-19'
---
# 강한 연결 요소와 응축 DAG

방향 그래프의 순환은 단순히 “DFS에서 뒤로 간선이 하나 있다”는 현상보다 구조적으로 설명해야 할 때가 많습니다. 어떤 정점 `u`에서 `v`로 갈 수 있고 `v`에서 다시 `u`로 갈 수 있다면 두 정점은 서로 도달 가능하며 같은 강한 연결 요소(Strongly Connected Component, SCC)에 속합니다. SCC로 정점을 최대한 묶은 뒤 각 묶음을 하나의 정점으로 축약하면, component 사이의 그래프는 DAG가 됩니다. 그러면 순환 내부의 자유로운 이동과 component 사이의 단방향 의존을 분리해 도달성·위상 순서·동적 계획법을 적용할 수 있습니다.

## 상호 도달성과 최대 묶음

방향이 `A→B` 하나뿐이면 A에서 B로는 갈 수 있지만 B에서 A로는 갈 수 없으므로 둘은 같은 SCC가 아닙니다. `A→B, B→A`라면 두 정점이 같은 SCC입니다. `A→B, B→C, C→A`도 세 정점 전체가 하나의 SCC입니다. SCC는 연결 요소처럼 단순히 간선이 있는 묶음이 아니라 모든 정점 쌍 사이에 양방향 도달 경로가 있는 maximal한 묶음입니다.

이 정의는 자기 간선도 처리합니다. 자기 간선 `v→v`가 있다고 해서 단일 정점 그래프가 새롭게 여러 정점과 합쳐지는 것은 아니며, 단일 정점 SCC 자체는 언제나 존재합니다. 순환을 “크기가 2 이상인 SCC”로 셀 것인지 자기 간선을 포함할 것인지는 문제의 정책으로 분리해야 합니다. 도달성 축약에서는 단일 SCC도 정상 component이고, 순환 검출에서는 자기 간선을 별도로 순환으로 취급할 수 있습니다.

## Kosaraju의 두 번 DFS

Kosaraju 알고리즘은 원래 그래프에서 DFS하며 종료 순서를 저장한 뒤, 모든 간선을 뒤집은 transpose graph를 종료 순서의 역순으로 DFS합니다. 첫 번째 pass의 핵심은 발견 순서가 아니라 DFS 종료 시각입니다. condensation graph에서 component 간 간선 `C1→C2`가 있으면, 적절한 DFS 관계에 의해 첫 pass의 component 최대 종료 시각이 component 방향을 구분하는 순서가 됩니다. 역순으로 transpose를 탐색하면 시작한 component에서 원래 그래프 기준으로 다른 component로 새어 나가지 않고 한 SCC를 수집할 수 있습니다.

예를 들어 component-level 간선이 `C1→C2`라고 합시다. transpose에서는 `C2→C1`입니다. 첫 pass의 종료 순서에서 C1 쪽 최대 시각이 C2보다 앞서는 관계를 이용해 역순으로 C1을 먼저 선택하면, transpose에서 C1에서 나가는 간선은 원래 C2에서 C1로 들어오던 간선들입니다. 그 경로는 C1 밖으로 확장되지 않고 C1의 원래 상호 도달 묶음만 모읍니다. 구현에서는 첫 pass의 finish order를 보존하되 두 번째 pass의 방문 표식은 초기화해야 합니다. 발견 순서를 저장하거나 방문 표식을 재사용하면 정답 component 경계가 깨집니다.

## Tarjan의 low-link와 스택

Tarjan은 한 번의 DFS에서 방문 시각 `tin[v]`, 현재까지 올라갈 수 있는 가장 작은 방문 시각 `low[v]`, 그리고 아직 component가 확정되지 않은 정점 스택을 유지합니다. 정점 `v`에서 자식 `to`를 DFS로 내려갔다면 `low[v]=min(low[v], low[to])`를 적용합니다. 이미 방문했지만 현재 스택에 남아 있는 조상으로 가는 간선은 `low[v]=min(low[v], tin[to])` 후보가 됩니다. 이미 다른 SCC로 pop되어 스택 밖에 있는 정점은 현재 component의 back-edge 후보로 다시 쓰지 않습니다.

`low[v] == tin[v]`가 되면 v는 현재 DFS 스택에서 하나의 SCC를 닫는 root입니다. 스택 top부터 v를 만날 때까지 pop한 정점이 정확히 그 SCC입니다. A→B→A를 따라 A와 B가 스택에 있는 상태에서 B의 back-edge가 A의 tin을 낮추고, root A에서 low가 tin[A]가 되면 B와 A를 pop합니다. C가 B에서만 나가고 C에서 A로 돌아오지 않는다면 C는 그 SCC에 포함되지 않습니다.

## 응축 그래프의 DAG 성질

각 원래 정점 v에 component ID `comp[v]`를 붙이고 모든 원래 간선 `u→v`를 훑습니다. `comp[u] == comp[v]`인 self-edge는 component-level에서 버립니다. 서로 다른 component라면 `comp[u]→comp[v]`를 응축 그래프에 넣습니다. 두 component 사이에 원래 간선이 여러 개라면 도달성이나 위상 순서만 필요한 경우 동일한 ID 쌍을 하나로 deduplicate할 수 있습니다. 반대로 원래 간선 수, 가중치 합, 이벤트 multiplicity를 계산하는 문제라면 parallel edge의 정체성을 보존하거나 별도로 집계해야 합니다.

응축 그래프에 다시 순환이 있다고 가정해 보겠습니다. `C1→C2→...→Ck→C1`이면 C1의 임의 정점에서 C2, …, Ck를 거쳐 다시 C1로 돌아오는 경로가 생깁니다. 그러면 원래 SCC의 maximality에 따라 이 component들은 하나로 합쳐졌어야 합니다. 따라서 서로 다른 SCC를 정점으로 가진 응축 그래프에는 directed cycle이 있을 수 없습니다. 이것이 SCC 축약 뒤 DAG가 되는 이유이며, 단순히 self-edge를 지웠기 때문이 아닙니다.

```diagram
{"title":"순환 내부와 component 의존","caption":"왼쪽의 순환 정점은 하나의 SCC로 묶이고, 오른쪽 응축 그래프에서는 component 사이 방향만 남아 DAG가 됩니다.","rows":[[{"id":"a","label":"A ↔ B ↔ C","detail":["서로 도달 가능","하나의 SCC"]}],[{"id":"x","label":"component X","detail":["{A,B,C}","내부 간선 축약"]},{"id":"y","label":"component Y","detail":["{D}","다음 의존"]}],[{"id":"z","label":"component Z","detail":["{E,F}","응축 DAG"]}]],"edges":[{"from":"a","to":"x","label":"component ID"},{"from":"x","to":"y","label":"원래 간선"},{"from":"y","to":"z","label":"방향 유지"}]}
```

## Kosaraju와 Tarjan의 상태 추적

작은 그래프 `A→B, B→A, B→C, C→D, D→C`를 생각해 보겠습니다. SCC는 `{A,B}`, `{C,D}`이고 응축 간선은 첫 component에서 둘째 component로 하나입니다. Tarjan의 DFS가 A, B, C, D 순으로 내려가면 C와 D는 서로의 back-edge를 통해 같은 스택 구간에 남습니다. C가 root로 판정될 때 D와 C를 먼저 pop하고, 이후 A가 root가 될 때 B와 A를 pop합니다. B→C를 읽을 때 C가 이미 스택 밖이라면 A,B의 low를 C의 tin으로 낮추지 않습니다.

Kosaraju에서는 첫 DFS의 종료 목록이 예를 들어 `[D,C,B,A]` 형태로 쌓일 수 있습니다. 이 정확한 순서는 인접 리스트 순서에 따라 달라지지만, 두 번째 pass는 그 종료 목록을 역순, 즉 마지막으로 끝난 정점부터 처리한다는 계약이 핵심입니다. transpose에서 A와 B는 서로 연결되어 한 component로 수집되고, C와 D도 별도로 수집됩니다. 인접 순서가 바뀌어도 component 분할은 같아야 하며, component ID 번호와 목록 순서는 달라질 수 있습니다.

## 도달성과 DAG 계산

원본에서 A,B가 서로 순환하고 A/B에서 C로 갈 수 있다면 A에서 C에 도달하는 질의와 B에서 C에 도달하는 질의를 각각 반복할 필요가 없습니다. 먼저 `comp[A]=comp[B]=X`로 바꾸고 component X의 도달성을 계산한 뒤, 질의 정점을 component ID로 변환합니다. X 내부에서 A에서 B로 가는 경로가 항상 존재한다는 SCC 정의 때문에 component-level 출발점으로 치환해도 도달성 의미가 보존됩니다.

응축 DAG에서는 위상 순서에 따라 reachability DP, 경로 수 계산, 특정 조건의 전파를 적용할 수 있습니다. 다만 원래 정점 단위의 경로 수나 component 내부 가중치가 필요하면 단순한 boolean 도달성만으로 충분하지 않습니다. component 안의 정점 수, 원래 간선 multiplicity, 시작·종료 정점이 component 내부에서 선택되는 위치를 별도 상태로 보존해야 합니다. “축약했다”는 말은 모든 정보를 버린다는 뜻이 아니라 질의에 불필요한 순환 차원을 quotient한 것입니다.

## 위상 정렬과 순환 원인 진단

Kahn의 위상 정렬은 진입 차수 0 정점을 제거하고, 제거되지 않은 정점이 있으면 순환을 의심하는 방법입니다. 그러나 결과에 남은 모든 정점이 순환 원인은 아닙니다. `A→B, B→A, B→C`에서 Kahn은 A, B, C 모두를 남기지만 실제 SCC는 `{A,B}`이고 C는 순환에 막힌 차단 정점입니다. SCC를 사용하면 원인 component와 그 후속 차단 영역을 분리해 오류 메시지를 더 정확히 만들 수 있습니다.

응축 DAG를 위상 정렬하는 것과 원본 그래프의 작업을 실제로 실행하는 것도 다릅니다. component가 순환이라면 내부 작업 순서를 하나로 정할 수 없으므로 별도 정책·수동 해소·반복 고정점이 필요할 수 있습니다. component 간 순서는 선행 관계만 설명하며, 간선이 표현한 작업 성공이나 외부 효과의 완료를 대신 보장하지 않습니다. 이는 기존 위상 정렬 노트의 “정렬 결과와 실행 성공의 분리”를 SCC 수준에서도 유지하는 이유입니다.

## 표현 정책과 비용

Kosaraju는 원래 인접 리스트와 transpose 인접 리스트를 저장해야 하므로 간선의 역방향 저장 공간이 필요합니다. Tarjan은 하나의 그래프와 DFS 상태·스택으로 처리할 수 있지만 재귀 깊이가 정점 수에 가까워질 수 있어 구현 언어의 call stack 한계를 확인해야 합니다. 두 방식 모두 인접 리스트 모델에서 `O(V+E)` 시간과 `O(V+E)` 수준의 저장 공간을 갖는다는 참고 설명을 따릅니다. component 간 parallel edge를 deduplicate하면 응축 이후의 DP 비용과 메모리를 줄일 수 있지만, dedup 여부는 질의 의미를 먼저 보고 결정합니다.

실패 사례는 자기 간선, 평행 간선, disconnected graph, 빈 그래프, 모든 정점이 하나의 SCC인 그래프, 모든 정점이 단방향 사슬인 그래프를 포함합니다. disconnected graph에서는 DFS를 임의의 한 정점에서만 시작하지 말고 모든 미방문 정점을 시작점으로 삼아야 합니다. 결과 검증은 모든 정점 쌍을 직접 도달성 탐색으로 대조해 같은 component ID가 양방향 도달을 만족하는지, 다른 component 간 양방향 경로가 없는지 검사할 수 있습니다.

## 참고자료와 검증 경계

확인한 cp-algorithms의 `Strongly Connected Components and Condensation Graph` 문서는 SCC가 방향 그래프를 분할하고, component를 축약한 그래프가 DAG가 되며, 설명한 그래프 모델에서 Kosaraju와 Tarjan이 `O(n+m)`이라는 점을 다룹니다. 이 문서는 유지되는 알고리즘 참고 페이지이지 특정 구현 언어나 표준 라이브러리의 실행 보장은 아닙니다. 평행 간선은 표현에 남을 수 있으므로, 응축 graph에서 deduplicate할지 원래 간선 identity를 유지할지는 이 노트에서 문제 정책으로 분리했습니다. 표와 trace는 설명용 상태 추적이며 로컬 프로그램 실행 결과로 주장하지 않습니다.


## 참고 URL

- https://cp-algorithms.com/graph/strongly-connected-components.html — SCC 분할, 응축 그래프의 DAG 성질, Kosaraju·Tarjan의 선형 시간 분석을 확인한 알고리즘 참고 페이지입니다. 구현 언어의 재귀 한계나 간선 표현은 별도 계약입니다.

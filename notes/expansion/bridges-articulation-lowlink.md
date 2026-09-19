---
id: bridges-articulation-lowlink
title: Bridge·Articulation Point와 Low-Link
topic: 알고리즘
summary: DFS의 discovery time과 low-link로 연결을 끊는 간선·정점을 판정하고 루트·평행 간선 예외를 설명합니다.
questionIds: []
prerequisites:
  - graph-search
related:
  - graph-storage
reviewedAt: '2026-09-19'
---
# Bridge·Articulation Point와 Low-Link

무방향 그래프에서 어떤 간선 하나를 지웠을 때 연결 요소가 늘어나면 그 간선을 **bridge**라고 합니다. 어떤 정점 하나와 그 정점에 붙은 간선을 지웠을 때 연결 요소가 늘어나면 그 정점은 **articulation point**입니다. 단순히 모든 간선이나 정점을 하나씩 지워 보며 DFS를 다시 실행하면 큰 그래프에서 비용이 커지지만, 한 번의 DFS가 만든 트리와 각 서브트리가 조상으로 되돌아갈 수 있는 가장 이른 시점을 요약하면 두 판정을 함께 계산할 수 있습니다.

이 글의 핵심은 `tin[v]`와 `low[v]`의 의미를 섞지 않는 것입니다. `tin`은 DFS가 정점에 처음 들어간 순서이고, `low`는 DFS 트리에서 `v`의 서브트리 안에서 출발해 트리 간선을 여러 번 내려가거나 back edge를 한 번 사용해 도달할 수 있는 가장 작은 discovery time입니다. 이 값은 “서브트리가 부모 위로 우회할 통로를 갖는가”를 압축한 정보입니다.

## 연결성 단절의 의미

bridge 판정은 그래프가 단순 그래프인지, 평행 간선과 자기 간선을 허용하는지부터 정해야 합니다. 두 정점 사이 간선이 두 개라면 어느 하나를 지워도 다른 간선이 남습니다. 따라서 간선의 정체성을 보존하는 입력 계약이 필요합니다. 정점 번호만 보고 부모를 건너뛰는 DFS는 이 경우 틀릴 수 있습니다.

articulation point도 같은 연결성 변화의 다른 관점입니다. 정점 `v`를 제거했을 때 `v`의 서로 다른 DFS child subtree가 조상 쪽이나 다른 child subtree로 이어지는지 살펴봅니다. 다만 DFS root는 부모가 없어서 일반 정점의 부등식을 그대로 적용할 수 없습니다. root에서 시작한 child subtree가 두 개 이상이면 root를 지운 뒤 서로 연결할 경로가 없으므로 root가 절단점입니다.

그래프가 연결되어 있다고 가정하면 한 번의 DFS로 충분하지만, 일반 입력은 여러 연결 요소를 가질 수 있습니다. 전역 `visited`를 유지하면서 모든 정점을 순회하는 outer loop가 필요합니다. 각 DFS 호출은 별도의 root와 child count를 가져야 하며, 첫 번째 요소의 root 자식 수를 다음 요소에 누적하면 안 됩니다.

## DFS 순서와 low-link 상태

정점 `v`에 처음 진입할 때 전역 시간 `timer`를 증가시켜 `tin[v] = low[v] = timer`로 둡니다. 인접 간선 `(v, to)`를 읽을 때 아직 방문하지 않은 `to`라면 `(v,to)`를 tree edge로 삼아 재귀한 뒤 `low[v] = min(low[v], low[to])`를 적용합니다. 이미 방문한 정점으로 향하는 간선은 조상으로 올라가는 back edge일 수 있으므로 `low[v] = min(low[v], tin[to])`로 반영합니다.

여기서 이미 방문한 정점의 `low[to]`를 사용하는 것이 아니라 `tin[to]`를 사용하는 이유는 현재 간선 하나가 직접 연결한 끝점의 discovery 순서를 표현해야 하기 때문입니다. 자식 서브트리의 요약은 재귀가 돌아온 tree edge에서 이미 `low[to]`로 반영합니다. 방향 없는 그래프에서는 같은 무방향 간선이 양쪽 인접 리스트에 등장하므로, 방금 타고 들어온 간선 하나만 부모 간선으로 건너뛰는 예외도 반드시 포함해야 합니다.

`low[v]`가 작다는 것은 `v`의 서브트리에서 더 이른 조상으로 돌아갈 수 있다는 뜻입니다. 반대로 `low[child]`가 부모의 `tin[parent]`보다 크면 child 서브트리에서 parent 또는 그 조상으로 가는 back edge가 없습니다. 그때 tree edge `(parent, child)`를 삭제하면 해당 서브트리가 그래프의 나머지 부분과 분리되므로 bridge입니다.

## Bridge 판정 부등식

부모 `p`와 DFS child `v`에 대해 bridge 조건은 `low[v] > tin[p]`입니다. `low[v] == tin[p]`인 경우에는 `v`의 서브트리에서 `p`로 직접 이어지는 back edge가 있다는 뜻이므로 tree edge 하나를 지워도 그 간선만의 우회 연결이 남습니다. 그래서 strict greater-than이 필요합니다. `>=`를 쓰면 평행 간선이나 직접적인 back edge가 있는 상황까지 bridge로 오판합니다.

예를 들어 `A-B` 간선이 두 개이고 DFS가 첫 번째 간선을 tree edge로 탔다고 하겠습니다. `B`에서 두 번째 간선을 통해 `A`를 만나면 `low[B]`는 `tin[A]`까지 내려갑니다. 따라서 `low[B] > tin[A]`가 성립하지 않아 첫 간선은 bridge가 아닙니다. 반대로 `A-B-C`가 단순 경로이고 우회 간선이 없다면 `low[B]` 또는 `low[C]`가 부모보다 이른 조상으로 내려가지 못해 해당 tree edge가 bridge가 됩니다.

```diagram
{"title":"low-link가 우회 연결을 요약합니다","caption":"child 서브트리에서 조상으로 돌아가는 back edge가 있으면 low가 부모의 discovery time까지 내려가고, 없으면 tree edge가 bridge가 됩니다.","rows":[[{"id":"parent","label":"부모 p","detail":["tin[p] = 2"]}],[{"id":"child","label":"자식 v","detail":["low[v] = 2: 우회 있음"]},{"id":"leaf","label":"끝 서브트리","detail":["low[v] = 5: 우회 없음"]}],[{"id":"ancestor","label":"조상 경로","detail":["back edge"]},{"id":"cut","label":"bridge 후보","detail":["low[v] > tin[p]"]}]],"edges":[{"from":"parent","to":"child","label":"tree edge + back edge"},{"from":"parent","to":"leaf","label":"tree edge만 존재"},{"from":"child","to":"ancestor","label":"low를 2로 낮춤"},{"from":"leaf","to":"cut","label":"삭제하면 분리"}]}
```

이 그림의 두 child는 같은 depth라는 뜻이 아니라 판정 결과의 대비를 위한 상태입니다. 실제 코드에서는 `low`를 갱신한 직후 `if (low[to] > tin[v])`를 평가합니다. 부모가 아닌 방문 정점으로 가는 간선이 항상 back edge라는 단순화는 평행 간선 처리와 맞지 않으므로 edge ID를 기준으로 구분하는 편이 안전합니다.

## Articulation Point와 루트 예외

non-root 정점 `v`는 child `to` 중 `low[to] >= tin[v]`인 것이 하나라도 있으면 articulation point입니다. 등호가 허용되는 이유는 child 서브트리가 `v`까지는 돌아올 수 있지만 `v`의 strict ancestor까지 올라갈 수 없는 경우에도 `v`를 삭제하면 분리되기 때문입니다. bridge는 간선 하나를 지우는 문제라 `v`로 돌아오는 edge만으로도 우회가 되지만, articulation은 정점 `v` 자체를 제거하므로 등호의 의미가 달라집니다.

root에서는 `tin[root]`보다 작은 조상이 없으므로 `low[child] >= tin[root]` 같은 조건이 root의 child 분리를 직접 표현하지 못합니다. root의 DFS tree child 수를 세고 그 수가 2 이상일 때만 articulation point로 표시합니다. root가 child 하나만 가진다면 그 child 서브트리 내부에서 root를 거치지 않는 연결이 있는지는 root 제거 후에도 전체 child 서브트리 하나로 남는 연결 요소 수를 늘리지 않습니다.

정점이 고립되어 있거나 DFS child가 하나인 root는 절단점이 아닙니다. 구현에서는 root 여부를 `parentEdge == NONE`처럼 명시하고, root의 child count와 non-root의 `low[child] >= tin[v]` 검사를 서로 다른 분기로 두는 것이 읽기 쉽습니다. 한 번이라도 조건을 만족했다고 표시한 articulation 값을 이후 child에서 되돌리지 않아야 합니다.

## 평행 간선과 부모 간선 식별

잘못된 구현은 `parent` 정점 번호만 저장하고 `to == parent`인 모든 인접 항목을 건너뜁니다. `u-v`가 두 번 저장된 그래프에서 첫 번째 항목은 tree edge이지만 두 번째 항목은 실제로 현재 subtree가 부모로 돌아가는 back edge입니다. 두 항목을 모두 skip하면 `low[v]`가 내려가지 않아 bridge를 거짓으로 보고합니다.

가장 분명한 방법은 각 무방향 간선에 고유 ID를 부여하고 인접 항목을 `(to, edgeId)`로 저장하는 것입니다. DFS 함수에 `parentEdgeId`를 넘겨 `edgeId == parentEdgeId`인 한 항목만 skip합니다. 역방향 인접 항목은 같은 ID를 가지므로 tree edge의 반대편 표현만 건너뛰고, 같은 두 정점 사이의 다른 edge ID는 back edge로 처리합니다. 자기 간선을 허용한다면 그것을 low-link에 반영할지 또는 입력에서 별도 정책으로 무시할지도 명시해야 합니다.

간선 ID를 외부 결과에 노출할 필요가 없다면 내부 배열 위치를 ID로 삼을 수 있지만, 양쪽 adjacency에 저장된 역방향 항목은 같은 논리 간선 ID를 공유해야 합니다. 단순히 배열 index를 그대로 쓰면 방향별 저장 위치가 달라져 같은 간선을 식별하지 못할 수 있습니다.

## 비연결 그래프 전체 순회

다음과 같은 outer loop가 기본 골격입니다.

```text
for v in vertices:
    if not visited[v]:
        root = v
        rootChildren = 0
        dfs(v, parentEdge = NONE)
        if rootChildren >= 2:
            articulation[root] = true
```

`dfs` 안에서는 방문하지 않은 이웃을 만날 때 root인 경우에만 `rootChildren`를 증가시킵니다. 구현 언어에 따라 root child count를 반환값으로 돌려줄 수도 있지만, recursive call 안의 모든 descendant를 child로 세지 않도록 “현재 root에서 직접 발견한 tree edge”만 세어야 합니다.

`A-B`와 `C-D`가 서로 분리된 네 정점의 입력을 A에서 시작한 DFS만 처리하면 `A-B`만 bridge 목록에 들어가고 `C-D`는 관찰되지 않습니다. outer loop가 C를 새 root로 시작해야 두 번째 bridge도 발견합니다. root 상태는 A와 C에서 각각 새로 0으로 시작해야 하며, 전역 timer만 계속 증가해도 판정에는 문제가 없습니다.

## 구현 비용과 검증

인접 리스트에서 각 정점과 간선을 상수 번 중심으로 처리하므로 시간 복잡도는 `O(V+E)`이고, `tin`, `low`, `visited`, 결과 배열과 DFS 스택에 `O(V)`가 필요합니다. 무방향 간선은 양쪽 adjacency에 저장되므로 실제 저장 항목은 `2E`이지만 점근 표기는 여전히 `O(V+E)`입니다. 재귀 DFS는 깊이가 V까지 갈 수 있어 언어의 호출 스택 제한이 실제 제약이 될 수 있습니다.

검증은 작은 그래프에서 간선 하나 또는 정점 하나를 실제로 제거하고 연결 요소 수를 세는 느린 기준 구현과 비교하면 좋습니다. 단순 경로, 삼각형, 고립 정점, 두 연결 요소, 평행 간선, 자기 간선 정책 입력을 각각 넣습니다. 각 tree edge에 대해 `low[child] > tin[parent]`인지 기록하고, articulation은 root와 non-root 조건을 별도로 비교합니다.

특히 평행 간선 테스트에서 edge ID를 제거한 구현이 bridge를 추가하지 않는지 확인해야 합니다. 그래프 저장 표현을 바꿀 때는 out/in 인덱스의 일관성을 검사하는 기존 `graph-storage`의 방식처럼 간선 다중집합과 원본 ID를 보존하는 검사를 함께 두는 것이 좋습니다. 설명에서 제시한 수치는 작은 상태를 손으로 추적한 계산이며 이 환경에서 코드를 실행한 결과를 뜻하지 않습니다.

## 선택 기준과 한계

정적 그래프에서 bridge와 articulation을 한 번 찾는 문제에는 low-link DFS가 적합합니다. 그러나 간선 삽입·삭제가 계속되는 온라인 문제는 매번 전체 DFS를 다시 돌릴지, 연결성과 2-edge-connected component를 관리하는 별도의 동적 자료구조를 쓸지 요구사항을 보고 선택해야 합니다. 삽입 시 새 간선이 기존 bridge 경로를 cycle로 덮는 현상은 정적 DFS의 `low` 배열을 부분 수정하는 것만으로 처리되지 않습니다.

또한 bridge와 articulation은 서로 다른 결과입니다. bridge가 없다고 해서 articulation이 없는 것은 아니며, articulation 하나에 여러 bridge가 붙을 수도 있습니다. 방향 그래프의 SCC 절단과도 정의가 다르므로 방향 간선을 무방향처럼 넣어 계산해서는 안 됩니다.

## 참고와 확인 범위

이 문서의 알고리즘 용어와 판정식은 입력 계약에 지정된 CP-algorithms의 bridge 탐색 항목 및 저장소의 `graph-storage`, `graph-search` 계열 설명과 대조하는 범위에서 작성했습니다. 해당 참고 페이지는 특정 프로그래밍 언어의 표준이나 라이브러리 계약이 아니라 교육용 알고리즘 참고 자료로 취급해야 합니다. 페이지 본문을 이 실행 환경에서 직접 다시 가져오지 못한 세부 구현 버전은 주장하지 않았습니다.

구현 전에는 edge ID가 입력에서 보존되는지, 자기 간선을 허용하는지, 깊은 DFS를 반복 호출 스택으로 처리할지, 동적 삽입을 정적 재계산으로 허용할지를 결정해야 합니다. 이 네 가지가 정해지지 않으면 동일한 low-link 식이라도 저장 구조와 실패 결과가 달라집니다.

### 참고 경로

- [https://cp-algorithms.com/graph/bridge-searching.html](https://cp-algorithms.com/graph/bridge-searching.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.

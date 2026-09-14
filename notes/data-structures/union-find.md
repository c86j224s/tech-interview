---
id: union-find
title: Union-Find의 대표자와 되돌리기
topic: 자료구조
summary: 크기 기반 병합과 경로 압축을 부모 배열로 추적하고 연결 경로·삭제·rollback이 별도 계약인 이유를 설명합니다.
questionIds: [union-find-connectivity, rollback-union-find-path-compression]
---

# Union-Find의 대표자와 되돌리기

## 연결됐는지만 빠르게 알고 싶습니다

무방향 그래프에 간선을 하나씩 추가하면서 두 정점이 이미 연결됐는지 묻는다고 합시다. 매번 전체 그래프를 탐색하는 대신 같은 연결 성분에 속한 원소를 한 집합으로 관리할 수 있습니다. **Union-Find** 또는 분리 집합 구조는 대표자를 찾는 find와 두 집합을 합치는 union을 제공합니다.

대표자가 같으면 연결돼 있다는 뜻이지만 실제로 어떤 간선을 지나 연결되는지는 알려 주지 않습니다. 부모 배열은 구현상 집합을 표현하는 트리이지 원래 그래프의 경로가 아닙니다.

## 작은 집합을 큰 집합에 붙입니다

원소 0~4의 부모는 처음 모두 자기 자신이고 크기는 1입니다. 같은 크기면 첫 인자의 루트를 남기는 정책으로 진행하겠습니다.

| 연산 | 부모 배열 | 루트별 크기 | 성분 수 |
| --- | --- | --- | ---: |
| 시작 | [0,1,2,3,4] | 모두 1 | 5 |
| union(0,1) | [0,0,2,3,4] | 0:2, 2:1, 3:1, 4:1 | 4 |
| union(2,3) | [0,0,2,2,4] | 0:2, 2:2, 4:1 | 3 |
| union(0,2) | [0,0,0,2,4] | 0:4, 4:1 | 2 |
| find(3), 경로 압축 | [0,0,0,0,4] | 0:4, 4:1 | 2 |

3에서 부모를 따라가면 3→2→0입니다. 경로 압축은 find 도중 지나간 부모를 루트 0으로 바꾸어 다음 탐색을 짧게 합니다. 이때 원래 그래프에 3→0 간선이 생긴 것은 아닙니다.

```diagram
{"title":"부모 경로를 짧게 만드는 압축","caption":"화살표는 Union-Find의 부모 참조입니다. find(3) 뒤에는 3이 직접 0을 가리키며, 원래 그래프 간선과는 관계가 없습니다.","rows":[[{"id":"three","label":"원소 3","detail":["압축 전 parent=2"]}],[{"id":"two","label":"원소 2","detail":["parent=0"]}],[{"id":"zero","label":"루트 0","detail":["parent=0 · size=4"]}]],"edges":[{"from":"three","to":"two","label":"기존 부모"},{"from":"two","to":"zero","label":"기존 부모"},{"from":"three","to":"zero","label":"압축 뒤 직접 참조"}]}
```

## find도 배열을 바꿀 수 있습니다

```text
find(x):
    require valid vertex x
    root = x
    while parent[root] != root:
        root = parent[root]
    while parent[x] != x:
        next = parent[x]
        parent[x] = root
        x = next
    return root

union(a,b):
    ra = find(a)
    rb = find(b)
    if ra == rb: return false
    if size[ra] < size[rb]: swap(ra,rb)
    parent[rb] = ra
    size[ra] += size[rb]
    components -= 1
    return true
```

대표자가 같을 때 크기와 성분 수를 다시 변경하면 중복 union으로 값이 틀어집니다. 루트가 아닌 노드의 size는 더 이상 유효한 집합 크기라고 읽지 않습니다. 최소 ID나 합계가 필요하면 살아남은 루트에 메타데이터를 따로 병합합니다. 대표자 자체가 의미 있는 리더라고 가정하지 않습니다.

크기 기반 병합만 쓰면 어떤 노드의 깊이가 하나 늘 때 속한 집합 크기는 적어도 두 배가 됩니다. 따라서 깊이는 O(log n)입니다. 경로 압축까지 조합하면 긴 연산열의 비용은 역 아커만 함수 α(n)을 사용하는 매우 작은 상환 비용으로 제한됩니다. 모든 호출의 최악 시간이 엄밀히 O(1)이라는 뜻은 아닙니다.

## 롤백하려면 find의 숨은 변경도 문제입니다

`union(0,2)`를 되돌리려면 parent[2], size[0], 성분 수를 복원하면 될 것 같지만, 그 뒤 find(3)가 parent[3]도 0으로 바꾸었다면 parent[2]만 복원해도 3은 여전히 0 성분으로 남습니다. 경로 압축의 변경까지 기록하지 않으면 틀립니다.

단순 rollback 변형은 **경로 압축 없이 크기 기반 병합만 사용**합니다. 각 성공 union의 변경을 스택에 넣고 저장한 스택 길이까지 되돌립니다.

```text
checkpoint(): return length(history)

unionRollback(a,b):
    ra, rb = findWithoutCompression(a), findWithoutCompression(b)
    if ra == rb: return false
    if size[ra] < size[rb]: swap(ra,rb)
    history.push((rb, ra, size[ra]))
    parent[rb] = ra
    size[ra] += size[rb]
    components -= 1
    return true

rollback(mark):
    require 0 <= mark <= length(history)
    while length(history) > mark:
        rb, ra, oldSize = history.pop()
        parent[rb] = rb
        size[ra] = oldSize
        components += 1
```

이 계약은 “최근 union 호출을 한 번 취소”가 아니라 **체크포인트까지 복원**입니다. 따라서 같은 집합 union은 기록하지 않아도 됩니다. 호출 횟수로 되돌리는 API라면 무변경 호출도 표식으로 기록해야 합니다. 추가 메타데이터가 있다면 모두 복원 대상입니다.

## 간선 삭제와 방향 경로는 다른 문제입니다

합친 집합에서 임의 간선을 지웠다고 두 성분으로 나뉜다고 단정할 수 없습니다. 다른 경로가 남을 수 있고 기본 Union-Find는 원래 간선을 보관하지 않습니다. 전체 시간 구간을 미리 아는 오프라인 문제는 각 구간에 union을 적용하고 나올 때 rollback하는 방식으로 처리할 수 있지만, 임의 온라인 삭제를 기본 구조가 즉시 지원하는 것은 아닙니다.

방향 그래프에서 A→B가 있다고 B에서 A로 갈 수 있는 것도 아닙니다. 이 구조의 무방향 연결성과 방향 도달성·강한 연결성을 혼동하지 않습니다. 경로가 필요하면 BFS 등의 탐색에서 부모 간선과 거리를 저장해야 합니다.

## 배열 값보다 집합 분할을 검사합니다

여러 병합 순서가 다른 대표자를 만들 수 있으므로 부모 배열 하나를 유일한 정답으로 삼지 않습니다. 모든 정점 쌍의 같은 집합 여부를 기준 그래프 탐색과 비교합니다. 자기 union·중복 union·고립 원소·긴 병합열도 넣습니다.

롤백에서는 체크포인트 전후의 연결성·크기·성분 수가 모두 돌아오는지 확인합니다. 경로 압축을 실수로 사용한 변형에 위 3→2→0 사례를 넣으면 간단히 오류를 드러낼 수 있습니다. find가 논리적 조회처럼 보여도 실제 쓰기라는 점 때문에 동시 접근에도 별도 동기화가 필요합니다.

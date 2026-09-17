---
id: astar-frontier
title: A*의 하한·재오픈·후보와 경로 복원
topic: 게임 서버
summary: 허용성과 일관성·이동 비용 하한·목표 종료·Weighted bound를 구분하고 g/parent 갱신·stale heap·재구축·방향 압축·탐색 세대를 설명합니다.
questionIds: [astar-heuristic, astar-inconsistent-reopen-example, astar-open-closed, astar-stale-heap-rebuild, grid-path-parent-direction, weighted-astar-quality-budget]
---

# A*의 하한·재오픈·후보와 경로 복원

## 목표 방향 추정과 실제 비용 하한

A*는 출발점 누적 비용 g와 목표까지 추정 h를 더한 f=g+h가 작은 후보를 먼저 확장합니다. h=0이면 Dijkstra와 같은 우선순위입니다. 비음수 간선·고정 graph·목표 h=0을 전제로 h가 실제 남은 최적 비용을 넘지 않는 **허용성**과 `h(u)≤cost(u,v)+h(v)`의 **일관성**을 구분합니다.

4방향 단위 격자에서는 가로·세로 차이의 합인 Manhattan을, 8방향 이동의 비용이 모두 1이면 두 축 차이 중 큰 값인 Chebyshev를 하한으로 사용할 수 있습니다. 직교 이동 비용을 D, 대각 이동 비용을 D2라 하고 D≤D2≤2D이면 `D*(dx+dy)+(D2-2D)*min(dx,dy)`의 octile 하한을 사용합니다. 다만 값싼 portal·비표준 대각 비용·방향별 비용이 있으면 이 계산이 실제 비용을 넘지 않는지 다시 검토하고, 장애물을 무시한 합법적인 완화 문제의 최적 비용을 하한으로 삼을 수 있습니다.

각각 유효한 하한의 max는 하한이지만 단순 합·가중치는 과대추정할 수 있습니다. 계산이 비싼 h는 확장 수를 줄여도 전체 CPU를 늘릴 수 있습니다.

## 허용적 휴리스틱과 Closed 재오픈 조건

방향 간선 S→A=3,S→B=1,B→A=1,A→G=3을 둡니다. h(S)=0,h(A)=0,h(B)=4,h(G)=0은 실제 남은 비용을 넘지 않지만 B→A에서 4>1+0이므로 일관되지 않습니다.

| 순서 | 후보·변경 |
| --- | --- |
| S 확장 | A:g3,f3 · B:g1,f5 |
| A 확장 | G:g6,f6, A closed |
| B 확장 | A의 더 싼 g2 발견 |
| A 재오픈 | G를 g5로 개선 |
| G pop | 최적 경로 S-B-A-G 비용5 |

A closed를 무조건 무시하면 G=6이 반환됩니다. 일관된 h라면 일반 A*에서 closed 재오픈 없이 단순화할 수 있지만 허용성만으로 그 규칙을 대체하지 않습니다. 목표를 처음 발견한 순간이 아니라 적절한 최소 후보 pop/하한 종료 조건을 사용합니다.

```diagram
{"title":"늦은 개선을 전파해야 비용 5를 찾습니다","caption":"화살표는 방향 간선이고 라벨은 실제 비용입니다. A가 g3으로 먼저 닫혀도 B를 거친 g2 개선을 다시 확장해야 G가 6에서 5로 바뀝니다.","rows":[[{"id":"s","label":"S · 시작"}],[{"id":"b","label":"B · h4"},{"id":"a","label":"A · h0"}],[{"id":"g","label":"G · 목표"}]],"edges":[{"from":"s","to":"a","label":"3"},{"from":"s","to":"b","label":"1"},{"from":"b","to":"a","label":"1"},{"from":"a","to":"g","label":"3"}]}
```

## g 비용 개선과 Parent·Heap 갱신

```text
pop entry
if entry.searchGeneration != currentGeneration: skip
if entry.g != bestG[entry.node]: skip
if entry.node == goal: return reconstruct(parent)
mark node expanded
for each legal edge(node, next):
  candidate = bestG[node] + edge.cost
  if candidate < bestG[next]:
    bestG[next] = candidate
    parent[next] = node
    mark next open  # 필요하면 closed 재오픈
    push(next, candidate, candidate + h(next), generation)
```

decrease-key 대신 새 entry를 넣는 lazy deletion은 구현이 단순하지만 pop에서 current g·generation과 대조해야 합니다. 부동소수점 epsilon으로 서로 다른 개선을 임의로 같게 만들지 않고 비용 표현·비교를 명시합니다. 동점은 안정된 순번/ID로 재현성을 정할 수 있지만 최적성 조건을 대신하지 않습니다.

총 heap/유효 open 비율·stale pop·bytes를 보고 현재 유효 open 상태로 heapify 재구축할 수 있습니다. 재오픈 상태와 generation을 보존하고 임의 후보 삭제로 메모리를 줄이지 않습니다. O(n) 재구축의 순간 비용·추가 메모리도 예산에 포함하며 상한이면 미완료/재시도 정책을 반환합니다.

## Parent 방향 압축과 이동 모델 제약

정해진 4/8 이웃에서 parent 방향 코드를 저장하면 현재 cell에서 역방향을 계산할 수 있습니다. portal·긴 jump·시간/방향 상태가 있으면 방향만으로 부모가 유일하지 않아 길이·부모 state ID 등이 필요합니다. 시작 sentinel·유효 코드·cycle·최대 복원 길이를 검사하고 g 개선 때 parent도 바꿉니다.

탐색 scratch 배열은 세대로 분리하고 결과를 값으로 소유하거나 배열 수명을 유지합니다. generation 검사가 해제된 pointer 접근을 안전하게 만들지는 않습니다. 동적 graph 변경은 재오픈과 별개로 snapshot·source version을 검증합니다.

## Weighted A*와 근사 비용 bound 계약

`w≥1`에서 `f=g+w*h`로 계산하며, `w>1`일 때는 h의 영향이 커져 일반 A*보다 목표 방향 후보를 더 앞세웁니다. 유한 graph, 비음수 비용, 허용적이고 비음수인 h, 필요한 재오픈, 최소 weighted-f 후보 선택, goal pop 종료를 모두 지킬 때에만 반환 비용 C에 대해 `C≤w*C*`라는 bound를 설명할 수 있습니다.

필요한 재오픈을 유지하면 최적 경로 위에 최적 접두 비용 g*로 발견된 frontier가 남습니다. 그곳의 h가 남은 최적 비용 이하이므로 `g*+w*h≤w*C*`이고, 최소 후보로 꺼낸 goal의 비용도 이를 넘지 않는다는 것이 근거입니다.

timeout 때 아무 후보 경로를 반환하거나 후보를 삭제하면 이 bound를 그대로 주장할 수 없습니다. 정확/근사/미완료를 구분하고 Dijkstra 기준의 도달성·비용비·노드·CPU·heap·p99를 비교합니다. 본문의 graph와 알고리즘은 학습용이며 실제 게임 맵 성능 측정은 아닙니다.

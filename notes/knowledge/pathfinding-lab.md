---
id: pathfinding-lab
title: 증분 경로 탐색 실습과 불변식
topic: 알고리즘
summary: 의존성 없는 Python 실습으로 BFS·Dijkstra·A*의 기준 결과와 LPA*·D* Lite의 g·rhs·km 갱신을 비교하고 동적 간선 변경과 양수 비용 경로 복원 안전성을 검증합니다.
questionIds: []
prerequisites: [pathfinding-foundations, dijkstra, astar, astar-frontier]
related: [path-execution, navigation-clearance, graph-search]
reviewedAt: '2026-09-18'
---

# 증분 경로 탐색 실습과 불변식

## 학습 목표

이 실습의 질문은 “맵이 바뀔 때 최단 경로를 다시 구한다”를 코드로 어떻게 안전하게 제한할 것인가입니다. 먼저 같은 directed graph에서 BFS·Dijkstra·A*를 실행해 정적 기준을 만들고, 다음으로 LPA*와 D* Lite가 이전 탐색의 `g`와 `rhs` 상태를 어떻게 재사용하는지 추적합니다. 마지막에는 독립 Dijkstra oracle과 경로 비용·도달성·경로 복원을 비교합니다.

실습은 `examples/knowledge/pathfinding-lab/pathfinding_lab.py`에 있습니다. 이 코드는 게임 엔진 adapter가 아니며 Recast/Detour bake·query를 실행하지 않습니다. 따라서 “증분 알고리즘의 자료구조와 불변식은 실행했다”라고만 말할 수 있고, 실제 NavMesh·충돌·crowd integration을 실행했다고 말할 수 없습니다.

## 기본 모델

유한한 그래프를 `G=(V,E)`로 두고 간선 `u→v`의 비용을 `c(u,v)`라고 합니다. 정적 탐색의 비용은 유한하고 비음수여야 하며, 증분 planner의 비용은 유한하고 양수여야 합니다. 음수 간선이 있으면 Dijkstra의 “가장 작은 후보를 꺼낸 순간 확정” 논리가 깨지므로 입력 단계에서 거절합니다. `INF`는 그래프에 존재하지만 현재 출발점에서 도달하지 못한 정점에만 사용하며, 그래프에 없는 시작점·목표는 `unreachable`이 아니라 입력 오류입니다.

정적 탐색은 다음처럼 구분합니다.

| 알고리즘 | 우선순위 | 이 lab의 반환·종료 의미 |
| --- | --- | --- |
| BFS | FIFO 층 순서 | 모든 간선 비용이 1일 때 전체 거리장을 완성 |
| Dijkstra | 누적 `g` | 비음수 비용의 기준 oracle. 목표가 pop되면 목표 비용을 확정 |
| A* | `g+h` | `h=0`이면 Dijkstra. 목표를 처음 발견한 순간이 아니라 정당한 최소 후보 pop에서 종료 |
| LPA* | `(min(g,rhs)+h, min(g,rhs))` | 고정 start/goal에서 변경된 비용의 영향을 재전파 |
| D* Lite | `(min(g,rhs)+h(start,node)+km, min(g,rhs))` | goal에서 역방향 상태를 유지하고 start 이동과 edge 변경을 수리 |

LPA*의 `g`는 시작점에서의 비용이고, D* Lite의 `g`는 목표까지의 비용입니다. 따라서 LPA*는 `g[u] + cost(u,v) == g[v]`인 간선을 따라가고, D* Lite는 `cost(u,v) + g[v] == g[u]`인 successor를 선택합니다. 두 방향을 섞으면 올바른 거리 상태에서도 경로를 복원하지 못합니다. 이 구현의 증분 planner는 양수 간선만 허용하며, 복원에서는 cycle과 그래프 크기를 넘는 경로를 거절합니다.

기본 휴리스틱은 0입니다. 사용자 휴리스틱의 admissibility·consistency는 코드가 증명하지 않습니다. A*는 목표까지의 하한이어야 하고, 증분 planner의 휴리스틱은 비용 변경 뒤에도 일관성과 해당 논문의 삼각 부등식 조건을 유지해야 합니다. NaN·변하는 callback·과대 추정값을 넣는 것은 지원 계약 밖입니다. 작은 예제의 oracle 비교를 일반 그래프 전체의 증명으로 확대하지 않습니다.

## 불변식 도출

### LPA*의 `g`와 `rhs`

LPA*에서는 출발점의 `rhs[start]=0`으로 두고, 다른 정점은 다음 one-step lookahead 값을 가집니다.

```text
rhs[v] = min over predecessors u of (g[u] + c(u,v))
```

`g[v]`는 지금까지 확정해 전파한 값이고 `rhs[v]`는 현재 `g` 상태로 한 단계 계산한 가장 좋은 값입니다. `g[v] == rhs[v]`이면 그 정점은 locally consistent입니다. 다르면 priority queue에 있어야 합니다. 이 차이를 queue에 넣지 않으면 바뀐 edge가 goal까지 전파되지 않습니다.

`g[v] > rhs[v]`인 경우 더 싼 경로가 발견된 것이므로 `g[v]=rhs[v]`로 낮추고 successor를 갱신합니다. 반대로 비용 증가로 기존 값이 무효가 되면 정점을 `INF`로 올린 뒤 자신과 successor를 다시 갱신합니다. queue pop은 저장 당시 key가 현재 key와 같은지 확인해야 하며, 같지 않은 stale entry를 확장하지 않습니다.

LPA*의 종료 조건은 `goal`이 consistent이고 queue 최솟값이 goal의 현재 key보다 작지 않은 것입니다. 목표가 단지 queue에 들어갔거나 `rhs[goal]`이 한 번 계산됐다는 이유만으로 반환하지 않습니다.

### D* Lite의 역방향 상태

D* Lite는 목표에서 시작하는 방향으로 `rhs[goal]=0`을 두고, 각 정점에서 successor를 향한 비용을 사용합니다.

```text
rhs[u] = min over successors v of (c(u,v) + g[v])
```

따라서 edge `u→v`가 바뀌면 영향을 직접 받는 정점은 `u`입니다. LPA*에서 같은 edge 변경이 `rhs[target]`을 다시 계산하는 것과 방향이 반대입니다. 이 한 줄을 혼동하면 비용 감소나 증가가 변경 원점에서 출발점까지 전달되지 않습니다.

D* Lite의 첫 key는

```text
(min(g[u], rhs[u]) + h(start, u) + km, min(g[u], rhs[u]))
```

입니다. `start`가 `s_last`에서 새 위치로 이동하면 `km`에 `h(s_last,new_start)`를 더한 뒤 `s_last`와 현재 start를 교체합니다. `km`은 이전 queue 항목을 전부 다시 계산하지 않고도 priority 기준이 이동한 사실을 반영하는 누적 보정입니다. 이 lab에서는 heuristic을 Manhattan으로 둔 작은 4방향 grid에서 이동 거리 1이 `km=1`로 관찰됩니다.

### 비음수와 확정 경계

Dijkstra의 정적 oracle은 모든 간선이 비음수라는 계약을 검사합니다. 그래야 이미 처리한 prefix 뒤에 간선 하나를 더해 누적 비용이 다시 내려가지 않습니다. LPA*/D* Lite도 이 lab에서 같은 계약을 사용합니다. 증분 queue를 쓴다고 음수 비용을 허용할 수 있는 것은 아닙니다. 이 구현은 경로 복원과 상태 전파가 엄격히 진행한다는 단순한 교육 계약을 위해 증분 planner 입력에서 양수 간선만 허용합니다. zero-cost 간선은 BFS·Dijkstra·A*와 별도 복원 guard 실험에서만 다룹니다.

zero-cost 간선은 정적 탐색에서 허용하지만 “거리의 엄격한 증가”를 전제로 증분 parent·successor 복원을 구현해서는 안 됩니다. `seen` 집합과 최대 경로 길이 검사가 필요합니다. 같은 비용 tie는 stable node order로 하나를 선택할 수 있지만, tie-break는 최적성의 증명이 아닙니다.

## 단계별 예제

다음 네 정점 그래프를 사용합니다.

```text
S→A 2, A→G 2
S→B 1, B→G 5
```

초기 LPA*에서 `rhs[S]=0`입니다. `S`가 전파되면 `rhs[A]=2`, `rhs[B]=1`이 되고, 이어 `rhs[G]=min(g[A]+2, g[B]+5)=4`가 됩니다. 따라서 경로는 `S→A→G`, 비용 4입니다.

이제 `B→G`를 5에서 1로 낮춥니다.

| 단계 | 상태 변화 | 확인할 값 |
| --- | --- | --- |
| 0 | 기존 계획 | `S→A→G`, 비용 4 |
| 1 | `B→G` 감소 통지 | Dijkstra 전체 재실행 없이 target 원점 `G`의 `rhs` 재계산 |
| 2 | queue가 불일치 정점을 pop | `B` 경유 값 2가 기존 `g[G]=4`보다 낮아짐 |
| 3 | successor 선택 | `S→B→G`, 비용 2 |
| 4 | `A→G`를 10으로 증가 | 이미 더 좋은 `S→B→G`는 유지 |

여기서 `notify_edge_change`를 호출하지 않으면 graph 객체의 edge 값만 바뀌고 planner의 `rhs/g` queue는 바뀌지 않습니다. 이것이 “데이터를 바꿨으니 증분 planner가 알아서 안다”라는 오해가 실패하는 지점입니다.

D* Lite 예제는 3×3 4방향 grid의 `(0,0)`에서 `(2,0)`으로 시작합니다. 초기 경로는 직선 세 칸이고 비용 2입니다. start를 `(1,0)`으로 이동하면 `km`이 1이 되고 남은 경로는 `(1,0)→(2,0)`, 비용 1입니다. 이어 `(1,0)→(2,0)`의 비용을 5로 올리면 직접 간선 비용은 5지만 아래쪽 세 간선의 우회 비용은 3이므로 D* Lite가 우회 경로를 내야 합니다. 매번 같은 graph snapshot을 새로 만든 Dijkstra와 결과 비용을 비교해 증분 상태의 정합성을 확인합니다.

```diagram
{"title":"변경된 간선에서 목표까지 상태 전파","caption":"LPA*는 변경 edge의 도착 정점을, D* Lite는 변경 edge의 출발 정점을 다시 계산한다. 두 방식 모두 locally inconsistent 상태를 queue에 넣고 goal/start 경계까지 전파한다.","rows":[[{"id":"change","label":"간선 비용 변경","detail":["decrease 또는 increase","유한·비음수 계약"]}],[{"id":"state","label":"g·rhs 불일치","detail":["LPA*: rhs(target)","D* Lite: rhs(source)"]}],[{"id":"queue","label":"priority queue 전파","detail":["stale key 폐기","양수 간선 계약"]}],[{"id":"result","label":"경로·비용 검증","detail":["successor chain cycle 검사","Dijkstra oracle 대조"]}]],"edges":[{"from":"change","to":"state","label":"dirty vertex"},{"from":"state","to":"queue","label":"inconsistent push"},{"from":"queue","to":"result","label":"consistent boundary"}]}
```

## 코드 흐름

`Graph`는 정점 순서와 directed adjacency를 보존합니다. `set_edge`는 한 방향의 기존 parallel edge를 제거하고 하나의 비용으로 교체합니다. `validate`는 모든 간선의 endpoint·유한성·비음수를 검사하므로, 목표에 빨리 도달하는 입력이라도 뒤쪽 음수 간선을 정상 입력으로 통과시키지 않습니다.

`dijkstra`는 decrease-key 대신 `(distance snapshot, sequence, node)`를 새로 push합니다. pop 당시 snapshot이 현재 `distance[node]`와 다르면 stale entry를 버립니다. 비용을 낮출 때 `parent`도 같은 블록에서 갱신합니다. 이 결과는 A*와 증분 planner가 맞아야 하는 독립 oracle입니다.

`astar`는 `g+h`를 사용하지만 단순히 closed를 영구 봉인하지 않습니다. 더 싼 `g`가 발견되면 `closed.discard`로 다시 queue에 넣습니다. 이 lab의 기본 heuristic은 0이므로 Dijkstra와 같은 확정 순서를 갖지만, 함수 인자로 inconsistent heuristic을 넣어도 parent cost가 현재 `g`와 같은지 검사합니다.

`LPAStar._update_vertex`는 start가 아닌 정점의 `rhs`를 predecessor `g`로 재계산합니다. edge 변경 `source→target`의 경우 target을 dirty로 지정합니다. `compute_shortest_path`는 `g>rhs`이면 값을 낮추고 successor를 전파하며, `g<rhs`이면 `INF`로 올려 다시 계산합니다. 증분 planner는 이 구현의 엄격한 진행 계약 때문에 양수 간선만 받습니다.

`DStarLite._update_vertex`는 goal이 아닌 정점의 `rhs`를 successor `g`로 계산합니다. edge 변경에서는 source를 dirty로 지정합니다. `move_start`는 먼저 `km`을 누적하고 나서 현재 start를 변경합니다. `path`는 g-value를 이용해 매 단계 `edge cost + g[successor] == g[current]`를 만족하는 successor를 고르며, `reconstruct_successor_path`가 cycle·missing successor·그래프 크기 초과를 거절합니다. LPA*는 start에서의 거리이므로 `g[current] + edge cost == g[successor]`인 순방향 간선을 따라 복원합니다. D* Lite의 목표 방향 거리와 식의 방향을 혼동하지 않습니다. 두 증분 구현은 양수 간선만 허용합니다.

## 실행 절차

저장소 루트에서 다음 명령을 실행합니다.

```bash
python3 examples/knowledge/pathfinding-lab/pathfinding_lab.py --test
python3 examples/knowledge/pathfinding-lab/pathfinding_lab.py
```

`--test`는 표준 `unittest`로 다음을 검사합니다.

- 모든 비용이 1인 그래프에서 BFS와 Dijkstra의 비용·경로 복원
- 가중 그래프에서 Dijkstra oracle과 A* 비용 일치
- 음수 간선 입력의 명시적 거절
- LPA* edge decrease와 edge increase
- D* Lite start 이동, `km` 갱신, edge increase 후 우회
- 정적 탐색의 zero-cost tie와 successor cycle 보호
- 증분 planner의 zero-cost 입력 거절
- reachable과 unreachable의 구분

2026-09-18 macOS 27 arm64, Python 3.9.6에서 저장소 코드의 8개 테스트를 통과했습니다.

## 실패 진단

### 비용이 맞지 않는 경우

먼저 결과 path의 각 edge를 다시 더해 보고 `g[start]` 또는 `g[goal]`과 비교합니다. 비용이 다르면 `parent`/successor 갱신과 비용 갱신이 서로 다른 시점에 일어났거나, parallel edge를 잘못 선택한 것입니다. 다음으로 Dijkstra를 같은 변경 후 graph에서 다시 실행합니다. 증분 결과가 oracle과 다르면 dirty endpoint 방향, `g/rhs` 갱신, stale key 판별을 확인합니다.

### 변경 뒤 옛 경로가 남는 경우

edge의 실제 값만 바꾸고 `notify_edge_change`를 호출했는지 확인합니다. LPA*는 변경 edge의 target, D* Lite는 source를 update해야 합니다. 그 vertex가 locally inconsistent인데 queue에 들어가지 않았다면 propagation이 시작되지 않습니다.

### start 이동 뒤 이상한 queue 순서

`km`을 새 start까지의 heuristic 거리만큼 누적했는지, `s_last`를 이전 start로 유지했는지 확인합니다. `km`을 매번 0으로 초기화하거나 start를 먼저 바꿔 old/new 거리를 계산하면 key가 동일한 기준을 반영하지 않습니다.

### 무한 루프 또는 잘못된 성공

zero-cost 간선에서 비용이 줄지 않는다는 이유만으로 종료를 판정하지 않습니다. `seen` 집합, 최대 graph-size bound, goal 도달, 실제 edge 존재, path cost 일치를 모두 검사합니다. parent 또는 successor cycle은 `unreachable`이 아니라 `PathError`인 내부 상태 오류입니다.

### stale 결과를 운영 결과로 오해하는 경우

이 lab은 graph object를 동기적으로 변경하고 즉시 planner를 호출합니다. 실제 서비스의 map version, profile version, goal generation, snapshot lifetime, cancellation, worker permit은 구현 범위 밖입니다. 따라서 이 코드의 통과를 늦은 callback 폐기나 동시성 안전성의 증거로 확대하지 않습니다.

## 원문·연구 근거

D* Lite의 원 논문 PDF와 LPA* 원문 PDF는 이번 환경에서 readable text를 확보하지 못했습니다. D* Lite PDF URL은 404였고, 다른 PDF 응답은 raw PDF object/compressed stream으로 반환되어 `g`, `rhs`, key, `updateVertex`, `computeShortestPath`의 exact quote와 page/section을 검증할 수 없었습니다. 그러므로 아래 publication entry의 abstract/metadata와 이 lab의 독립 실행 검증을 분리합니다.

- Koenig·Likhachev, [D* Lite publication entry](https://publications.ri.cmu.edu/d-lite/), 2002. 확인 가능한 abstract 범위: “reuse information from previous searches”, “fast replanning methods in artificial intelligence and robotics”. 빠른 재계획과 이전 탐색 정보 재사용의 연구 범위를 뒷받침하지만, 이 노트의 수식이나 구현이 원문과 문자 그대로 같다는 근거는 아닙니다.
- Koenig·Likhachev·Furcy, [Lifelong Planning A* publication entry](https://publications.ri.cmu.edu/lifelong-planning-a/), 2004. 확인 가능한 abstract 범위: “an incremental version of A*”, “it reuses those parts of the previous search tree that are identical to the new one.” 증분 탐색과 이전 트리 재사용의 연구 범위를 뒷받침하지만, 이 lab의 API 계약이나 성능 수치를 보장하지 않습니다.
- [기존 길찾기 모델 노트](/tech-interview/notes/pathfinding-foundations/) — Grid·NavMesh·Voxel 상태 모델과 비용 의미.
- [기존 Dijkstra 노트](/tech-interview/notes/dijkstra/) — 비음수 비용, lazy heap, stale entry, 목표 확정.
- [기존 A* 노트](/tech-interview/notes/astar/) — 허용성·일관성·재오픈·경로 복원.
- [기존 경로 실행 노트](/tech-interview/notes/path-execution/) — map/goal/profile version과 늦은 결과 폐기 경계.

## 실행 범위

이 노트와 코드는 원래 연구 알고리즘의 모든 공식 기능을 다루지 않습니다. 포함 범위는 directed finite graph, exact-ish numeric nonnegative costs, synchronous edge updates, fixed goal, D* Lite start movement, zero-cost tie, independent Dijkstra oracle, bounded path reconstruction입니다.

제외 범위는 Grid footprint와 corner collision, NavMesh corridor와 Recast/Detour API, voxel bake, dynamic obstacle perception, reservation/local avoidance, concurrent workers, persistence, telemetry, distributed cancellation, production memory/latency SLA입니다. 특히 Recast/Detour 실행은 하지 않았습니다. 실제 운영 적용은 이 lab의 통과만으로 승인하지 않고, 동일한 invariants를 제품 snapshot·version·collision·lifetime 계약에 다시 연결해야 합니다.

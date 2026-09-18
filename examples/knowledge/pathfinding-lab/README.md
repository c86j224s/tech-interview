# 경로 탐색 증분 계획 실습

이 실습은 의존성 없는 Python 표준 라이브러리만으로 BFS, Dijkstra, A*, LPA*, D* Lite를 실행하고 작은 그래프에서 서로의 결과를 비교합니다. 목적은 게임 엔진·Recast·Detour의 통합이 아니라, 비음수 비용과 증분 탐색 상태(`g`, `rhs`, priority key, `km`, `start` 변경)를 관찰할 수 있는 독립 reference lab입니다.

## 실행 환경

- 검증 기준: Python 3.9 이상
- 외부 패키지: 없음
- 네트워크·클라우드·실제 자격 증명: 사용하지 않음
- 비용 계약: 정적 탐색은 유한한 실수형 비음수 간선을 허용합니다. LPA*/D* Lite는 이 구현의 경로 복원·진행 계약상 양수 간선만 허용하며, 음수·비유한 값과 zero-cost 입력은 명시적으로 거절합니다.
- 자원 경계: 예제 그래프는 고정된 소형 그래프이며, 테스트는 전체 그래프를 메모리에 둡니다. 운영용 무제한 그래프나 실시간 엔진 맵을 뜻하지 않습니다.

## 코드 위치

실습 코드와 노트는 다음 경로에 있습니다.

```text
examples/knowledge/pathfinding-lab/pathfinding_lab.py
notes/knowledge/pathfinding-lab.md
```

2026-09-18 Python 3.9.6에서 8개 테스트를 통과했습니다.

## 실행 명령

저장소 루트에서 다음 명령을 실행합니다.

```bash
python3 examples/knowledge/pathfinding-lab/pathfinding_lab.py --test
python3 examples/knowledge/pathfinding-lab/pathfinding_lab.py
```

첫 명령은 BFS·Dijkstra·A*를 Dijkstra 기준 결과와 비교하고, LPA*의 간선 비용 감소·증가, D* Lite의 start 이동·`km` 증가·간선 비용 증가, 정적 탐색의 zero-cost tie, 증분 planner의 zero-cost 입력 거절, unreachable, 경로 cycle 보호를 검사합니다. 두 번째 명령은 대표 경로와 비용 변화를 출력합니다.

예상 데모 출력의 의미는 다음과 같습니다. tie-break나 Python 버전의 출력 순서는 달라질 수 있지만 비용과 경로의 유효성은 같아야 합니다.

```text
oracle dijkstra: ['S', 'B', 'A', 'C', 'G'] cost= 7
astar: ['S', 'B', 'A', 'C', 'G']
lpa initial: ['S', 'A', 'G'] cost= 4
lpa after decrease: ['S', 'B', 'G'] cost= 2
dstar initial: [(0, 0), (1, 0), (2, 0)] km= 0
...
```

D* Lite에서 `(1,0)→(2,0)` 비용을 5로 올리면 현재 위치 `(1,0)`에서 목표까지 직접 가는 비용은 5가 되고, 다른 세 간선 우회 비용 3을 선택합니다. 이 결과를 full Dijkstra와 다시 비교하는 것이 핵심 확인입니다.

## 실패 주입

1. `test_nonnegative_contract`의 `-1`을 유지하면 Dijkstra가 첫 탐색 전에 `ValueError`를 내야 합니다. 음수 입력을 억지로 최단 결과로 반환하지 않습니다.
2. `test_lpa_edge_decrease_and_increase`에서 `notify_edge_change` 호출을 지우면 LPA*의 `rhs`가 새 간선을 알지 못하므로 증분 결과가 stale해집니다. 테스트가 실패하면 edge change를 dirty state에 연결하지 않은 것입니다.
3. `test_dstar_move_start_edge_increase_and_km`에서 `move_start`의 `km` 누적을 지우면 start가 바뀐 뒤 priority key가 이전 기준에 머물러 증분 repair의 전제가 깨집니다.
4. `_restore_parent` 또는 `reconstruct_successor_path`의 cycle guard를 지우고 cycle policy 테스트를 실행하면 무한 복원 위험이 생깁니다. 이 실습은 비정상 부모를 빈 성공 경로로 숨기지 않습니다.
5. D* Lite의 `_update_vertex`에서 `g[successor]`가 아니라 `rhs[successor]`를 사용하면 reverse dynamic-programming 의미가 바뀌며 oracle 비교가 실패합니다.
6. LPA* 또는 D* Lite의 경로 복원에서 `edge cost + g[successor]`의 최솟값만 고르게 바꾸면 zero-cost cycle을 고를 수 있습니다. `edge cost + g[successor] == g[current]` 검사를 지우면 cycle guard가 `PathError`를 내는지 확인합니다.

## 범위와 한계

이 코드는 directed graph의 비용 변경과 start 이동을 학습시키는 최소 구현입니다. 실제 Grid collision, agent footprint, reservation, NavMesh polygon reference, Recast bake/query, voxelization, multi-thread worker lifetime, cancellation, network service, persistence, telemetry는 포함하지 않습니다. Recast/Detour 실행을 했다고 주장하지 않으며 이 lab에서 검증한 것은 Python 자료구조와 알고리즘 상태뿐입니다.

LPA*와 D* Lite의 논문 원문 PDF는 이번 실행 환경에서 readable text로 확보하지 못했습니다. 따라서 README와 노트의 공식 연구 인용은 원문 수식의 검증으로 가장하지 않고, 공개 publication metadata/abstract와 코드의 독립 테스트를 구분합니다.

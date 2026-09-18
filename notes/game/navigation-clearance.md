---
id: navigation-clearance
title: 경로 공간·모서리 이동·Agent Clearance
topic: 게임 서버
summary: NavMesh/격자/복셀의 표면·셀·부피를 비교하고 해상도 손실·대각 corner·장애물 팽창·profile별 cache·clearance의 기하 전제와 포털을 설명합니다.
questionIds: [navmesh-grid-voxel, voxel-resolution-clearance-loss, grid-diagonal-corner, obstacle-inflation-profile-storage, shared-clearance-map-query]
---

# 경로 공간·모서리 이동·Agent Clearance

경로 탐색의 그래프는 단순히 비어 있는 위치의 목록이 아니라 특정 몸체가 실제로 통과할 수 있다는 공간 모델입니다. 이 노트는 표면·셀·복셀 표현과 agent profile을 연결하고, 계획된 경로와 실제 이동 가능성 사이의 검증 경계를 설명합니다.

## 빈 Cell과 몸체 통과 공간의 구분

`S # / # G`인 2×2 격자에서 S와 G가 비어도 대각선으로 두 벽 모서리 사이를 몸체가 통과할 수 있는지는 별도입니다. 대각을 금지할지, 두 직교 cell을 모두 요구할지, 다른 접촉 모델을 쓸지 정합니다. A*·JPS·충돌·client 예측이 같은 규칙을 사용해야 합니다.

cell 중심 모델을 벗어나면 실제 footprint sweep과 벽 접촉 등호·수치 여유를 확인합니다. 작은 반경이라는 이유만으로 “한쪽만 비면 항상 통과”로 일반화하지 않습니다. 큰 몸체는 목적지 하나가 아니라 여러 cell과 중간 이동 부피를 검사합니다.

## 이동 공간 차원과 변경 패턴에 따른 표현 선택
선택 순서는 먼저 이동 자유도와 몸체 모델을 정하고, 다음으로 장애물 변경 빈도·조회 지연·profile 수·메모리 예산을 비교하는 방식이 적절합니다. 지상 단일 profile의 정적 공간이면 NavMesh가 단순할 수 있지만, 건설로 cell이 자주 바뀌거나 다층 부피를 다뤄야 하면 grid·voxel의 갱신 범위가 더 직접적인 계약이 됩니다.

| 표현 | 강점 후보 | 추가 비용 |
| --- | --- | --- |
| NavMesh | 지상 표면 polygon·portal·긴 빈 공간 | bake·동적 지역 재생성·profile |
| grid | cell 점유·건설/파괴·명확한 이웃 | 해상도·계단 모양·많은 node |
| voxel | 다층·동굴·3D 부피·수직 이동 | 부피에 따른 memory·파생 갱신 |

NavMesh는 지상 2.5D 표면의 polygon과 portal을 연결하고 여러 층으로 이어지는 경로를 표현할 수 있지만, 자유롭게 날아다니는 3D 부피 전체를 같은 graph로 표현하는 모델은 아닙니다. NavMesh와 grid/voxel처럼 지역별 표현을 섞을 때는 상위 portal에서 하위 공간의 입구·출구, 높이, agent profile, version이 현재 요청과 맞는지 확인합니다. 상위 graph에 연결이 있다는 사실만으로 하위 공간에서 실제로 이동할 수 있다는 증명이 되지는 않습니다.

## 3D Cell 해상도와 공간 정보 손실

같은 영역에서 cell 한 변을 두 배로 하면 3D cell 수는 약 1/8입니다. 그러나 좁은 통로·얇은 벽·작은 층간 높이가 같은 cell에 섞일 수 있습니다. 조금이라도 고체가 있으면 막는 보수 voxelization은 안전한 길을 잃을 수 있고 center만 비어 있으면 통과시키는 방식은 얇은 벽을 놓칠 수 있습니다.

최소 폭·높이·경사·agent footprint와 정렬에 따른 최악 오차로 해상도를 정합니다. 고해상도 원본 형상과 실제 경로·sweep을 대조하고 필요한 지역만 finer resolution을 쓸 때 경계 portal도 검사합니다.

```diagram
{"title":"원본 형상과 Agent 조건에서 이동 공간을 만듭니다","caption":"화살표는 파생 관계입니다. 고체 여부만으로 이동성을 정하지 않고 반경·높이·경사·능력과 같은 source version을 적용합니다.","rows":[[{"id":"geometry","label":"원본 지형·재질·동적 장애물"},{"id":"profile","label":"반경·높이·경사·이동 능력"}],[{"id":"derive","label":"팽창·clearance·portal 생성"}],[{"id":"graph","label":"profile/version별 경로 공간"}],[{"id":"movement","label":"실제 이동 직전 형상 재검증"}]],"edges":[{"from":"geometry","to":"derive","label":"물리 근거"},{"from":"profile","to":"derive","label":"통과 조건"},{"from":"derive","to":"graph","label":"완성 파생 데이터"},{"from":"graph","to":"movement","label":"계획≠미래 보장"}]}
```

## 장애물 팽창과 몸체 중심의 점 경로 변환
진단용 최소 사례로 폭 `2r`, `2r`보다 작은 통로, 대각선으로 맞닿은 두 장애물을 각각 검사합니다. 접촉을 금지하면 등호에서 실패하고, cell center만 검사하면 segment 중간의 벽 침범을 놓칠 수 있으므로 계획 결과와 실제 sweep 결과가 달라지는 지점을 별도로 기록합니다.

원형 agent가 2D에서 회전 없이 병진한다면, 장애물에 반경 `r`인 원판을 더한 Minkowski sum을 agent 중심이 들어갈 수 없는 금지 영역으로 바꿀 수 있습니다. 그래서 폭 `W`인 통로는 접촉 등호와 수치 여유를 포함해 대략 `W>2r`이어야 하며, 격자로 근사하면 여기에 양자화 오차가 더해집니다. 이 계산은 원형 footprint의 평면 병진에 한정되므로 높이·경사·선회·비원형 회전까지 반경 하나로 표현하지는 못합니다.

profile마다 전체 맵 복사본을 만들면 조회가 단순하지만 storage·재생성 비용이 늘어납니다. 공통 clearance field+profile별 질의/cache는 memory를 줄일 수 있지만 distance metric·샘플 위치·해상도·보수 오차를 정의해야 합니다. cell center의 `clearance≥r`만으로 두 center 사이 segment 전체의 여유까지 자동 보장하지 않습니다.

## profile 간 안전 경로의 단방향 재사용 조건

같은 형상 계열·높이·능력·규칙·source에서 큰 반경이 안전한 경로는 작은 반경에도 안전할 수 있습니다. 반대로 작은 agent 경로는 큰 agent에 재사용할 수 없습니다. 높이·수영·경사 능력이 다르면 반경 대소만으로 판단하지 않습니다. profile version과 map/overlay version을 cache key에 포함합니다.

미로딩 영역은 빈 공간이 아니라 unknown으로 보류·차단하고 실제 reader 수명도 유지합니다. 좁은 통로·층 경계·대각 corner·음수 좌표·동적 문·다양한 footprint를 기준 sweep과 비교합니다. 이 노트는 이동 공간 설계이며 실제 NavMesh bake·clearance 구현 시험 결과는 아닙니다.

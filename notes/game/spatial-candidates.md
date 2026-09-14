---
id: spatial-candidates
title: 공간 후보의 보수성·Grid·AABB Tree·계층 전환
topic: 게임 서버
summary: broad/narrow phase·swept 범위·형상/레이어 snapshot을 구분하고 cell floor·hash 충돌·다중 등록·grid/tree 비용·승격/강등 중 누락과 수명을 설명합니다.
questionIds: [collision-broad-narrow-phase, collision-grid-aabb-tree-choice, collision-layer-index-update, spatial-hash-grid, hierarchical-grid-promotion-dedup]
---

# 공간 후보의 보수성·Grid·AABB Tree·계층 전환

## 후보 축소는 실제 충돌을 빼도 된다는 뜻이 아닙니다

n개 물체의 모든 쌍은 n(n−1)/2입니다. broad phase는 AABB·원 등 보수 경계로 가능성 있는 쌍을 추리고 narrow phase는 실제 캡슐·박스·mesh·trigger·접촉 규칙을 검사합니다. broad phase false positive는 추가 비용이지만 false negative는 정밀 단계가 복구할 수 없는 누락입니다.

시간 범위도 보수적으로 덮어야 합니다. 선형 병진은 시작·끝 형상을 포함한 swept AABB로 한 tick의 이동을 감쌀 수 있습니다. 이전 cell과 현재 cell만 합치면 중간 cell을 놓칩니다. 회전·곡선 운동은 endpoint box 합만으로 부족해 중간 궤적을 포함한 bound나 별도 continuous 검사가 필요합니다.

## Cell 크기는 Query와 Update 비용의 절충입니다

cell side s, 반경 R이면 각 축에서 `[floor((x-R)/s), floor((x+R)/s)]` 범위를 조회합니다. 작은 s는 cell당 후보를 줄이지만 조회할 cell·hash lookup·큰 객체 다중 등록·이동 update가 늘어납니다. 큰 s는 등록이 단순해도 hotspot 후보가 늘 수 있습니다.

음수 x=-1,s=16은 floor division으로 cell=-1이어야 합니다. 0 방향 truncate는 cell0에 잘못 넣습니다. hash bucket 충돌은 실제 cell 동일성이 아니므로 bucket 안에서 원래 cell 좌표를 비교합니다.

| 구조 | 유리한 조건 후보 | 비용 |
| --- | --- | --- |
| uniform grid | 비슷한 크기·국소 이동 | hotspot·큰 물체 다중 등록 |
| spatial hash | 큰 희소 공간 | hash lookup·bucket 충돌 |
| dynamic AABB tree | 크기 차이·다양한 질의 | update·회전·pointer·tree 품질 |
| hierarchical grid | 여러 크기 규모 | 관련 level 모두 조회·전환 관리 |

## 큰 객체는 중심 Cell만으로 놓칠 수 있습니다

형상이 여러 cell에 걸치면 AABB 전체 등록 또는 크기 상한을 고려한 query 확장·별도 큰 객체 구조가 필요합니다. 한 query에서 여러 번 찾은 객체는 ID+generation 방문 집합으로 dedup하고 쌍은 canonical ordered pair로 중복 제거합니다. dedup과 실제 객체 lifetime 보호는 다릅니다.

```diagram
{"title":"보수 후보를 실제 형상과 정책으로 좁힙니다","caption":"화살표는 검사 단계입니다. 위치뿐 아니라 활성·레이어·형상·이동 시간 범위를 같은 snapshot에서 읽어 후보 누락을 막습니다.","rows":[[{"id":"snapshot","label":"tick snapshot · 위치·형상·layer"}],[{"id":"index","label":"swept bound·grid/tree 후보"}],[{"id":"dedup","label":"ID·generation·pair dedup"}],[{"id":"narrow","label":"정밀 형상·TOI·게임 정책"}],[{"id":"effect","label":"안정 event ID로 효과 확정"}]],"edges":[{"from":"snapshot","to":"index","label":"보수적 포함"},{"from":"index","to":"dedup","label":"중복 후보 허용"},{"from":"dedup","to":"narrow","label":"수명 보호"},{"from":"narrow","to":"effect","label":"최종 판정"}]}
```

## Layer 변경도 후보 집합 변경입니다

위치가 그대로여도 collision mask·활성 상태가 바뀌면 새로 충돌해야 하는 쌍이 생깁니다. layer별 index/filter를 사용한다면 변경을 반영해야 합니다. 같은 tick snapshot의 위치·형상·layer를 읽거나 갱신 동안 옛/새 후보를 보수적으로 함께 유지하고 최종 단계에서 해당 일관된 정책을 검사합니다.

삭제·ID 재사용에는 generation, 메모리 접근에는 참조 보호가 필요합니다. version을 읽으려 이미 해제된 pointer에 접근하는 것은 안전하지 않습니다.

## 승격·강등은 누락 없는 전환이어야 합니다

큰 객체를 상위 level로 옮길 때 old에서 제거하고 new에 추가하기 사이 빈틈이 있으면 query가 놓칠 수 있습니다. tick snapshot 교체 또는 전환 동안 양쪽 등록·조회 후 dedup을 사용합니다. query는 자기 level만이 아니라 관련 모든 크기 level을 보수적으로 포함합니다. 셀 크기 전체 변경도 index version·이중 조회·전환 cutoff가 필요합니다.

임계 주변의 크기/밀도 진동은 hysteresis·최소 유지로 줄이되 query correctness를 바꾸지 않습니다. 최악 hotspot에서는 실제 후보 수 자체가 많아 구조만으로 O(n²) 상호작용을 제거할 수 없을 수 있습니다.

## 동일 장면에서 누락 검사를 먼저 합니다

작은 장면의 전수 정밀 충돌 쌍이 후보 집합의 부분집합인지 확인합니다. 균일·hotspot·최대 크기·긴 sweep·layer 전환·음수 cell·삭제/재생성을 시험하고 update p99·query p99·candidate 수·dedup·memory·narrow CPU를 함께 비교합니다. 이 노트는 공간 index 설계이며 실제 물리 엔진 benchmark 결과는 아닙니다.

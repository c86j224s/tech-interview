---
id: spatial-tree-foundations
title: 공간 트리와 BVH
topic: 자료구조
summary: 공간을 분할하는 옥트리와 객체 경계를 묶는 BVH를 구별하고 보수 후보 질의, 큰 객체, refit·rebuild, 동시 전환과 수명 계약을 설명합니다.
questionIds: []
prerequisites: [tree-foundations]
related: [dda-boundaries, voxel-semantics, voxel-version-bundle, spatial-candidates]
reviewedAt: '2026-09-17'
---

# 공간 트리와 BVH

## 후보 단계와 정밀 판정

게임 월드에서 물체 n개를 모든 쌍으로 비교하면 가능한 쌍 수는 `n(n-1)/2`입니다. 공간 인덱스는 이 비용을 줄이기 위해 위치나 경계가 만날 가능성이 있는 후보를 모으지만, 실제 충돌이나 시야 차단을 최종 판정하지는 않습니다.

이 두 단계를 broad phase(넓은 후보 단계)와 narrow phase(정밀 판정 단계)라고 부릅니다. broad phase가 조금 많은 후보를 내는 false positive는 뒤 단계가 제거할 수 있습니다. 반면 실제로 충돌하는 쌍을 후보에서 빠뜨리는 false negative는 뒤 단계가 복구할 수 없으므로, 인덱스는 후보 집합이 실제 판정 집합을 포함하도록 보수적으로 설계해야 합니다.

질의 종류를 먼저 고정합니다. 점, AABB(축과 평행한 경계 상자), ray(광선), frustum(카메라 시야를 자르는 절두체), swept volume(한 시간 구간의 이동 부피)은 노드 경계를 방문하는 조건이 다릅니다. 정적 장면의 구성 비용과 빠르게 움직이는 projectile의 갱신 비용도 같은 숫자로 비교할 수 없습니다.

## 옥트리와 BVH의 구조 차이

옥트리(octree)는 3차원 영역을 여덟 개의 자식 영역으로 나누는 공간 분할 트리입니다. 보통 노드는 자신의 공간 상자, 깊이, 분할 여부, 저장 객체를 갖습니다. 자식 위치는 상자의 여덟 부분 중 어느 곳에 속하는지로 정해집니다.

BVH(bound volume hierarchy)는 객체를 잎에 두고, 내부 노드가 자손 객체의 경계를 감싸는 계층입니다. 내부 노드가 월드를 균등한 공간 조각으로 나눌 필요는 없습니다. 객체 묶음의 경계가 작고 겹침이 적으며, 갱신과 질의 비용이 workload에 맞는지가 핵심입니다.

따라서 옥트리의 중심 질문은 “공간을 어떤 영역으로 나눌까”이고 BVH의 중심 질문은 “이 객체 묶음을 어떤 bound로 감쌀까”입니다. 둘 다 DFS나 반복 스택으로 순회하지만, 자식 의미와 갱신 비용은 다릅니다. OpenVDB의 Tree 같은 희소 3차원 계층도 공간 계층이라는 점은 공유하지만, 일반 옥트리나 BVH의 불변식을 그대로 주장할 수는 없습니다.

```diagram
{"title":"공간 분할과 객체 경계 계층","caption":"옥트리는 영역을 나누고 BVH는 객체의 경계를 묶습니다. 어느 쪽이든 후보 검사 뒤 실제 형상 판정이 필요합니다.","rows":[[{"id":"world","label":"월드와 객체 집합"}],[{"id":"octree","label":"옥트리 · 영역 8분할"},{"id":"bvh","label":"BVH · 객체 경계 묶음"}],[{"id":"candidate","label":"교차 후보 집합"}],[{"id":"narrow","label":"정밀 형상·시간 판정"}]],"edges":[{"from":"world","to":"octree","label":"공간 분할"},{"from":"world","to":"bvh","label":"객체 묶음"},{"from":"octree","to":"candidate","label":"영역 교차"},{"from":"bvh","to":"candidate","label":"경계 교차"},{"from":"candidate","to":"narrow","label":"보수 후보"}]}
```

## 분할과 포함 불변식

uniform octree(균일 옥트리)는 정한 깊이와 상자 규칙을 반복하고, adaptive octree(적응형 옥트리)는 객체 수나 경계 복잡도에 따라 필요한 노드만 나눕니다. 객체 수가 적어도 무조건 깊게 나누면 노드와 포인터만 늘어납니다. 깊이 상한, 최소 영역 크기, 한 노드 최대 객체 수를 함께 둬야 한 점에 몰린 입력이 무한 분할로 이어지지 않습니다.

객체가 한 자식 영역에 완전히 들어갈 때만 아래로 내리고, 여러 자식에 걸치면 현재 노드에 두는 정책은 중복 등록을 줄입니다. 반대로 모든 교차 자식에 등록하면 질의 구현은 단순해질 수 있지만 같은 객체가 여러 번 나옵니다. 어느 정책이든 등록, query, dedup의 계약을 한 세트로 정합니다.

BVH 내부 AABB는 모든 자손 leaf의 AABB를 포함해야 합니다. leaf가 이동한 뒤 조상 상자를 갱신하지 않으면 실제 교차하는 쌍이 가지치기에서 사라집니다. bound를 크게 잡으면 누락 위험은 줄지만 불필요한 하강과 후보 수가 늘어납니다.

loose octree(느슨한 옥트리)는 자식의 논리 영역보다 큰 bound를 허용하여 경계 근처 이동 때 재등록을 줄이는 변형입니다. 논리적인 분할 영역과 객체를 안전하게 감싸는 loose bound를 한 필드로 섞지 않습니다. query가 어느 필드를 기준으로 내려가는지 명시해야 합니다.

## 질의 경계와 보수성

AABB 질의는 query 상자와 node bound가 교차하면 그 노드를 방문합니다. 면에 닿기만 한 경우를 포함할지, 부동소수점 여유를 얼마로 둘지는 narrow phase의 접촉 정책과 연결합니다. 후보 단계에서 닿음을 포함하고 정밀 단계에서 엄격한 내부 교차를 쓰는 선택은 가능하지만, 보수 후보를 너무 좁혀 실제 쌍을 버리면 안 됩니다.

ray 질의는 ray-AABB 교차의 시간 구간을 계산해 구간이 유효한 자식만 방문합니다. 방향 성분이 0이면 나눗셈을 강행하지 않고 평행 경계 규칙을 적용합니다. 복셀 DDA가 cell 경계를 순회한다면 BVH 질의는 cell 대신 node bound를 순회할 뿐이고, 경계 포함 정책은 [Voxel DDA의 경계 시간과 Supercover](/tech-interview/notes/dda-boundaries/)의 원칙과 분리해서 적용합니다.

frustum 질의는 bound가 평면 하나에 대해 완전히 바깥이면 가지치기합니다. swept AABB는 선형 병진에서 시작과 끝 형상을 감싸는 보수 상자가 될 수 있지만, 회전·곡선 운동의 모든 중간 형상을 포함한다고 자동으로 보장하지 않습니다. 운동 모델에 맞는 더 큰 bound나 narrow phase의 연속 접촉 검사가 필요합니다.

## 4×4 공간의 후보 추적

2차원으로 축소한 4×4 공간을 사용하겠습니다. 객체 A는 작은 영역에 있고, 큰 객체 O의 AABB는 x=1.5부터 3.5, y=1.5부터 2.5입니다. projectile P는 한 tick 동안 이동하므로 끝점이 아니라 swept 범위를 질의합니다.

옥트리식 분할에서 O를 교차하는 네 자식에 모두 등록하면 같은 O가 네 번 발견될 수 있습니다. 공통 부모에만 보관하면 하위 자식만 교차하는 query에서도 부모 저장 객체를 확인해야 합니다. 두 정책 모두 O를 포함한다면 후보 보수성은 유지되지만, 부모 저장 객체를 누락하지 않는 방문 계약이 필요합니다.

BVH에서는 O를 하나의 leaf bound로 두고 A와 P를 다른 leaf에 둡니다. P의 swept bound와 O의 leaf bound가 교차하면 후보가 됩니다. 이후 실제 도형과 시간을 narrow phase에서 검사합니다. O가 이동했는데 내부 AABB를 refit하지 않으면 새 위치를 지나가는 P가 old bound 밖에서 잘못 제거될 수 있습니다.

| 단계 | 옥트리 상태 | BVH 상태 | 후보 의미 |
| --- | --- | --- | --- |
| 등록 | O를 자식들 또는 공통 부모에 보관 | O leaf bound 작성 | 정밀 충돌 아님 |
| P 이동 | sweep이 통과하는 영역 조회 | P leaf bound 또는 sweep 갱신 | 이동 중 영역 포함 |
| 하강 | 교차 node의 자식 방문 | 교차 internal bound의 자식 방문 | false positive 허용 |
| 수집 | O 중복 가능 | leaf pair 중복 정책 적용 | ID로 dedup |
| 판정 | 실제 shape·시간 검사 | TOI·접촉 정책 검사 | 최종 효과 확정 |

## Refit과 Rebuild의 갱신 경계

BVH refit(재적합)은 이동한 leaf의 새 AABB를 기록하고, 그 부모부터 루트까지 자식 bound의 합집합을 다시 계산하는 작업입니다. 구조를 다시 묶지 않으므로 작은 이동을 빠르게 반영할 수 있습니다. 다만 refit은 객체의 그룹 배치 자체를 개선하지 않습니다.

객체가 계속 이동하면 sibling bound의 겹침이 커지고 ray가 여러 하위 트리를 방문할 수 있습니다. 이때 refit만 반복하면 query 비용이 상승합니다. 평균 방문 노드 수, overlap 비율, 후보 수, 특정 leaf 깊이, query p99를 관측하고, 품질 임계치에서 부분 또는 전체 rebuild(재구성)를 선택합니다.

rebuild는 객체를 다시 묶어 새로운 트리 모양을 만드는 작업입니다. 정적 장면은 초기 구성 비용을 감수하기 쉽고, 동적 장면은 주기·품질 임계·작업 예산을 조합합니다. 새 트리를 만드는 동안 old tree를 계속 읽을지, 완료 후 원자적으로 교체할지 결정하지 않으면 query가 반쯤 갱신된 링크를 볼 수 있습니다.

옥트리도 hotspot에 객체가 몰리면 최대 깊이에 도달한 뒤 후보 수가 많을 수 있습니다. 빈 영역의 split node는 merge로 줄일 수 있지만 query와 구조 변경이 겹치면 writer 잠금, 이중 버퍼, immutable snapshot 중 하나가 필요합니다. 트리 구조만 바꾸어 실제 hotspot의 모든 객체 쌍을 없앨 수 있는 것은 아닙니다.

## 큰 객체와 중복 후보

중심점만 한 cell에 넣으면 큰 객체의 표면이 멀리 있는 cell을 차지해도 그 사실이 인덱스에 반영되지 않습니다. AABB 전체를 등록하거나, 객체의 크기만큼 query를 확장하거나, 큰 객체용 별도 구조를 조회합니다. 중심 좌표는 저장 편의를 제공하지만 공간 extent를 대신하지 않습니다.

여러 자식이나 여러 level에 등록된 객체는 `objectId + generation`으로 한 번만 처리합니다. ID만 사용하면 삭제 뒤 같은 ID를 재사용한 새 객체와 옛 객체를 합칠 수 있습니다. 후보 쌍은 `(min(idA,idB), max(idA,idB))`처럼 정렬해 A-B와 B-A를 한 사건으로 만듭니다.

dedup은 구조상의 중복만 제거합니다. query가 leaf를 읽는 동안 객체가 해제될 수 있으므로 snapshot pin, 참조 보호, 또는 호출자가 보유할 lease가 별도로 필요합니다. generation이 맞더라도 이미 free된 포인터를 읽는 것은 안전하지 않습니다.

## 전환과 동시성

계층형 grid나 loose octree에서 객체가 크기·속도 임계치를 넘으면 다른 level로 승격할 수 있습니다. old level에서 먼저 지우고 new level에 나중에 넣으면 그 사이 query가 객체를 놓칩니다. 한 tick snapshot을 통째로 바꾸거나, 전환 동안 old와 new 양쪽에 등록하고 둘을 조회한 뒤 dedup합니다.

양쪽 등록은 전환 중 후보 누락을 줄이지만, old 등록을 제거하는 순간과 reader가 old 구조를 다 읽은 순간은 다를 수 있습니다. query version이 old snapshot을 사용 중이면 그 구조와 객체를 즉시 free하지 않습니다. logical generation은 늦은 update의 적용을 막고, reader lifetime은 메모리 회수를 늦추는 별도의 역할입니다.

hysteresis(상·하향 임계치를 다르게 두는 완충)는 경계 진동으로 인한 update 비용을 줄입니다. 크기가 8을 넘을 때 승격하고 6보다 작아질 때만 강등하면 7 근처의 반복 전환을 완화합니다. 이 규칙은 후보를 보수적으로 만드는 불변식이 아니라 전환 빈도를 줄이는 운영 정책입니다.

## 투사체와 시간 축

projectile이 한 tick에 x=0에서 10으로 이동하고 정지 벽이 x=4에서 5라면 끝점만 검사할 때 벽을 통과할 수 있습니다. index에는 시작과 끝 형상을 감싼 swept bound를 넣고, 후보를 모은 뒤 최초 접촉 시간 TOI를 계산합니다.

여러 후보가 있으면 같은 기준 시각의 TOI를 비교하고 동률은 안정 object ID로 정합니다. 접촉 후 반사·관통·정지에 따라 남은 시간을 다시 검사할 수 있지만, 접촉 직후 같은 면을 무한히 재처리하지 않도록 진행량과 반복 상한을 둡니다. 이 단계는 [연속 충돌·TOI·수치 여유와 관통 순서](/tech-interview/notes/continuous-contact/)의 시간 매개변수와 사건 규칙을 따릅니다.

space index가 old 위치를 읽고 narrow phase가 new 위치를 읽으면 하나의 설명 가능한 판정이 되지 않습니다. tick, source generation, object generation을 후보와 정밀 판정에 함께 묶어 같은 snapshot을 사용합니다.

## 의사코드와 메모리 수명

아래는 특정 엔진 API가 아닌 BVH AABB 질의의 의사코드입니다. `intersects`는 보수적인 bound 교차 함수이고, `pin`은 결과가 호출자에게 반환된 뒤에도 객체가 살아 있도록 handle을 만든다고 가정합니다.

```text
queryAabb(tree, queryBox):
    reader = tree.acquireSnapshot()
    result = []
    seen = empty set
    try:
        stack = [reader.root]
        while stack is not empty:
            node = stack.pop()
            if not intersects(node.bound, queryBox):
                continue
            if node.isLeaf:
                handle = reader.pin(node.objectId, node.generation)
                if handle is valid and handle.key not in seen:
                    seen.add(handle.key)
                    result.append(handle)
                continue
            stack.push(node.left)
            stack.push(node.right)
        return completed(result)
    finally:
        reader.release()
```

`result`가 반환된 뒤에도 handle이 객체를 붙잡는다는 수명 계약이 핵심입니다. 만약 handle이 reader release와 함께 무효화된다면 reader를 반환 객체 안에 포함하거나, 결과를 복사된 불변 값으로 만들거나, 호출자의 명시적 lease를 사용해야 합니다. 단순히 `finally`에서 reader를 해제하고 raw pointer를 반환하면 dangling pointer가 됩니다.

후보 수나 시간 예산을 넘으면 결과를 “충돌 없음”으로 축약하지 않습니다. `truncated`, `snapshotVersion`, `visitedNodes`, `candidateCount`를 함께 반환해 호출자가 보류, 보수 차단, 재시도 중 하나를 선택하게 합니다.

## 선택 기준과 검증 범위

비슷한 크기의 물체가 국소적으로 움직이고 직사각형 cell 질의가 많으면 uniform grid가 단순할 수 있습니다. 크기 편차가 크고 ray·overlap 질의가 다양하며 이동 leaf 수가 관리 가능하면 BVH를 후보로 둡니다. 큰 희소 공간과 위치 기반 질의는 spatial hash나 adaptive octree를 검토하되, pointer와 hash 비용을 실제 workload로 비교합니다.

작은 장면의 전수 AABB 교차 집합을 기준으로 octree·BVH 후보의 포함 관계를 비교합니다. 균일 분포, hotspot, 최대 깊이, 큰 객체, 음수 좌표, 긴 sweep, 경계 ray, leaf 삭제, refit 뒤 rebuild, 승격·강등 중 query를 포함합니다. 누락률 0을 목표로 하되 이번 장의 수치는 측정 결과가 아닙니다.

누락이 의심되면 전수 정밀 후보와 인덱스 후보의 차이를 먼저 계산합니다. 누락이면 분할 경계, 음수 좌표, sweep, 큰 객체 등록, old/new 전환을 추적합니다. 후보가 과도하면 bound 크기, BVH 품질, 중복 제거, hotspot의 실제 쌍 수를 따로 확인합니다.

## 참고 자료와 검증 범위

- [공간 후보의 보수성·Grid·AABB Tree·계층 전환](/tech-interview/notes/spatial-candidates/) — repository note, 2026-09-17 확인. broad/narrow phase, swept 범위, 큰 객체, dedup, 계층 전환의 근거입니다.
- [Voxel DDA의 경계 시간과 Supercover](/tech-interview/notes/dda-boundaries/) — repository note, 2026-09-17 확인. 경계 질의와 접촉 의미를 연결하는 데 사용했습니다.
- [연속 충돌·TOI·수치 여유와 관통 순서](/tech-interview/notes/continuous-contact/) — repository note, 2026-09-17 확인. swept 후보, TOI, 반복 상한을 연결하는 데 사용했습니다.
- [복셀 점유·재질·동적 Overlay와 희소 저장](/tech-interview/notes/voxel-semantics/) — repository note, 2026-09-17 확인. 희소 3차원 표현과 객체 수명 경계를 비교하는 데 사용했습니다.
- 일반 옥트리·BVH의 설명은 repository notes와 직접 계산한 예제로 제시했습니다. OpenVDB 13.1.0 문서는 공간 트리와 동일한 일반 BVH 계약의 근거로 사용하지 않았습니다.
- 실행 범위 — repository 빌드·테스트·물리 엔진 benchmark·OpenVDB API compilation을 실행하지 않았습니다. 4×4 추적은 설명용 손계산이며 measured query p99나 누락률이 아닙니다.

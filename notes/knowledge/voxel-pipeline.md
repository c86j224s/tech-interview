---
id: voxel-pipeline
title: 복셀 저장·메시·충돌 파이프라인
topic: 게임 서버
summary: 복셀 청크를 의미가 보존되는 원본으로 저장하고 메시·LOD·충돌·내비게이션 파생물을 버전과 독자 수명에 맞게 게시하는 흐름을 설명합니다.
questionIds: []
prerequisites: [game-server-foundations, spatial-tree-foundations]
related: [navigation-clearance, continuous-contact, path-execution, spatial-candidates]
reviewedAt: '2026-09-17'
---

# 복셀 저장·메시·충돌 파이프라인

## 원본과 파생물의 층위

복셀 시스템은 “한 칸이 비었는가”를 담은 배열 하나로 끝나지 않습니다. 정적 지형과 재질은 월드를 재현할 원본이고, 문과 물체의 점유는 자주 바뀌는 동적 층이며, 렌더링 메시·충돌 인덱스·agent별 이동 공간은 규칙으로 계산되는 파생물입니다.

source(원본)는 지형과 재질 같은 사실을 보존합니다. overlay(덧씌움 층)는 문 열림이나 객체 점유처럼 원본을 매번 다시 인코딩하지 않고 더하거나 뺄 수 있는 변화를 기록합니다. derived artifact(파생 산출물)는 특정 source, 이웃 경계, profile, rules에서 계산된 결과이므로 원본과 같은 권위를 자동으로 갖지 않습니다.

파생 결과에는 source version, 이웃 의존 version, profile version, rules version을 함께 기록합니다. 원본에 새 벽이 생겼는데 옛 collision artifact를 권위 판정에 사용하면 새 벽을 통과할 수 있습니다. 반면 화면용 mesh가 잠시 늦는 것을 허용할지는 제품 bundle 정책으로 명시할 수 있습니다.

이 글은 저장에서 게시까지의 공통 경계를 설명합니다. 특정 엔진의 최신 API나 성능을 약속하지 않으며, 공식 문서가 확인한 라이브러리 역할과 프로젝트 고유의 수명 계약을 구분합니다.

```diagram
{"title":"복셀 원본과 파생 결과 게시","caption":"원본 변경과 파생 결과 완성은 다른 사건입니다. 각 결과의 입력 버전을 대조한 뒤 호환되는 묶음을 게시합니다.","rows":[[{"id":"source","label":"지형·재질 원본"},{"id":"halo","label":"이웃 경계·버전"}],[{"id":"mesh","label":"렌더링 메시"},{"id":"collision","label":"충돌 데이터"},{"id":"nav","label":"이동 공간"}],[{"id":"check","label":"입력 버전·호환성 검사"}],[{"id":"publish","label":"원자적 루트 교체"}]],"edges":[{"from":"source","to":"mesh","label":"표면 생성"},{"from":"source","to":"collision","label":"고체 판정"},{"from":"halo","to":"nav","label":"경계·통과 조건"},{"from":"mesh","to":"check","label":"완성 결과"},{"from":"collision","to":"check","label":"완성 결과"},{"from":"nav","to":"check","label":"완성 결과"},{"from":"check","to":"publish","label":"현재 목표와 일치"}]}
```

## 청크 좌표와 이웃 의존성

청크 크기를 `C=16`이라 하면 world cell coordinate `x`는 `chunk=floor(x/C)`, `local=x-chunk*C`로 나눕니다. `x=-1`은 chunk `-1`, local `15`입니다. 정수 나눗셈을 0 방향으로 자르면 `-1`을 chunk 0으로 넣는 오류가 생기므로 음수 경계를 반드시 포함합니다.

한 청크의 면을 만들더라도 인접 청크의 경계 cell을 읽어야 합니다. halo(경계 여유 영역)는 이웃의 경계 값을 복사해 생성 작업 중 반복 조회를 줄이는 저장 영역입니다. halo는 값만 복사하는 캐시가 아니라 어느 source chunk의 어느 version을 복사했는지 기록해야 하는 의존성입니다.

6면의 face visibility만 판단하면 이웃 한 cell이 충분할 수 있지만, 큰 agent의 collision, smoothing, 긴 ray는 더 넓은 영역을 읽을 수 있습니다. 따라서 halo 폭을 보편적으로 한 칸으로 고정하지 않고 생성 알고리즘의 footprint로 계산합니다.

미로딩 chunk, 로딩된 empty, 실제 solid, unknown은 서로 다른 상태입니다. hash lookup miss를 empty로 돌려주면 미로딩 벽을 통과할 수 있으므로 collision은 보수 차단하고, path나 시야는 보류·부분 결과·잠정 결과 가운데 명시된 정책을 사용합니다.

## 저장 표현과 의미 보존

16³ 청크는 `4096`개 cell입니다. 1-bit 점유 bitmap의 payload는 `4096/8=512 bytes`입니다. 재질이 네 종류라면 점유 bit만으로는 부족하고, 네 재질을 2-bit index로 표현하는 배열은 `4096×2/8=1024 bytes`이며 palette metadata가 추가됩니다.

다섯 번째 재질을 추가하면 2-bit로 표현할 수 없어 3-bit index로 전체 repack이 필요할 수 있습니다. 논리적으로 한 cell을 O(1)에 변경해도 encoded block은 전체 재인코딩이 될 수 있습니다. single-material block, palette block, raw fallback 사이의 전환과 palette 정리 시점을 데이터 수명과 함께 정합니다.

조밀 배열은 local index와 이웃 계산이 단순하고 국소 접근이 좋지만 빈 공간도 차지합니다. hash chunk는 존재하는 청크만 찾고 내부를 연속 배열로 둘 수 있습니다. adaptive octree는 큰 균일 영역을 상위 값이나 tile로 표현할 수 있지만 split·merge와 pointer 비용이 늘어납니다.

OpenVDB 13.1.0 문서의 overview는 3차원 격자로 양자화한 희소 volumetric data를 계층 구조와 도구로 다루며, Tree·Transform·metadata를 Grid에 묶는 모델을 설명합니다. Tree의 값은 voxel, tile, background 형태로 저장될 수 있고 active/inactive 해석은 application-specific입니다. 이를 게임의 occupied, empty, walkable과 자동으로 같다고 번역하지 않습니다.

NanoVDB FAQ는 NanoVDB를 static-topology 구현으로 설명합니다. 값은 바꿀 수 있지만 tree topology는 바꿀 수 없고, pointer-less contiguous layout과 공간적으로 연관된 voxel 접근을 위한 배치가 제공된다고 설명합니다. 따라서 동적으로 split·merge하는 world writer와 GPU·읽기 중심의 표현을 같은 역할로 선택하지 않습니다.

## 메시 생성과 표면 의미

가장 단순한 meshing은 solid cell의 여섯 면을 검사해 이웃이 비어 있을 때 face를 출력합니다. 청크 밖 이웃은 halo에서 읽고, material boundary·투명 재질·물 표면처럼 “비어 있지 않음”만으로 숨길 수 없는 면은 별도의 semantic rule로 둡니다.

vertex 순서와 normal 방향은 좌표계 계약으로 고정합니다. winding(정점 순서)이 뒤집히면 back-face culling에서 면이 사라질 수 있고, 청크마다 경계 규칙이 다르면 seam이 생깁니다. 같은 source와 halo를 읽는 두 작업이 같은 면 포함 규칙을 공유해야 합니다.

greedy meshing은 같은 재질과 방향의 인접 면을 큰 사각형으로 합쳐 vertex와 triangle 수를 줄입니다. 병합 조건에는 재질, 투명도, 조명 경계가 포함될 수 있으며 한 cell 변경이 합쳐진 큰 면을 깨는 범위를 다시 계산해야 합니다. 낮은 vertex 수가 모든 workload에서 더 빠르다는 뜻은 아닙니다.

marching cubes 계열은 연속 scalar field의 등가면을 cell 사이에 배치하므로 binary occupancy를 어떤 field 값으로 해석할지와 ambiguous case를 정해야 합니다. dual contouring 계열은 sharp feature 보존을 노릴 수 있지만 edge 교차, vertex 배치, 비다양체 topology를 별도로 다뤄야 합니다. 알고리즘 이름보다 입력 의미와 결과 artifact 계약이 먼저입니다.

## 청크 경계와 LOD seam

인접한 16³ 청크 A와 B에서 A의 +x 마지막 cell이 solid이고 B의 -x 첫 cell이 empty라면, A가 B의 halo를 읽지 않고는 경계 face를 결정할 수 없습니다. B가 뒤늦게 벽을 추가하면 A가 복사한 halo version은 stale 상태가 됩니다.

A가 source version 10이고 B version 4를 halo로 복사했다면, B가 version 5에서 경계 cell을 solid로 바꾸는 순간 A의 `halo.sourceVersion=4`와 현재 B version 5가 달라집니다. A mesh를 그대로 최신 결과라고 게시하지 않고 경계 mesh를 dirty로 표시하거나, old mesh와 보수 collision을 별도로 유지합니다.

| 사건 | A mesh | collision | 다음 동작 |
| --- | --- | --- | --- |
| B v4, A halo v4 | 경계 생성 가능 | v4 조합 | bundle 후보 |
| B v5에서 벽 추가 | halo stale | 새 벽 반영 필요 | A 경계 무효화 |
| safety overlay 게시 | old render 가능 | 새 벽 우선 차단 | collision 먼저 공개 |
| A mesh·nav 완료 | 새 경계 생성 | 호환 version 검사 | root 원자 교체 |

LOD(level of detail)는 관찰 거리나 화면 오차에 따라 서로 다른 정밀도의 메시를 고르는 정책입니다. Unity의 거리 임계치나 cross-fade API를 이 글의 계약으로 주장하지 않습니다. 해당 조사에서 시도한 Unity 6 LOD 공식 URL은 HTTP 404였으므로 제품별 세부는 보류합니다.

coarse와 fine mesh의 shared boundary vertex 수가 1 대 2처럼 달라지면 T-junction이 생길 수 있습니다. 한쪽 삼각형 변의 중간에 다른 vertex가 놓이는 상태이며 crack의 원인이 됩니다. transition cell, stitch triangle, transition geometry, skirt 가운데 하나를 선택하되 topology와 normal 규칙을 함께 정의합니다. skirt는 시각적 틈을 가릴 뿐 collision이나 실제 경계 일관성을 대신하지 않습니다.

## 충돌과 DDA 파생

ray를 `p(t)=o+t*d`로 두면 DDA는 현재 cell에서 다음 x/y/z 경계를 만나는 `tMax` 중 가장 작은 값을 골라 다음 cell로 이동합니다. 방향 성분이 0이면 해당 축의 step과 `tMax`를 무한대로 두어 0으로 나누지 않습니다.

cell 크기 1, 시작 `o=(0.25,0.25)`, 방향 `d=(1,0.5)`이면 시작 cell은 `(0,0)`, 첫 x 경계 시간은 0.75, 첫 y 경계 시간은 1.5입니다. 방문은 `(0,0) → (1,0) → (1,1) → (2,1)` 순서입니다. d가 정규화되지 않았으므로 t는 world distance가 아니며, 종료 조건도 같은 매개변수로 둡니다.

두 축 경계가 같은 t에 만나는 corner에서 내부 통과만 세는 규칙과 닿는 모든 cell을 후보로 포함하는 supercover가 다릅니다. collision, visibility, navigation이 같은 접촉 의미를 사용할 필요는 없지만 각각의 정책을 traversal과 테스트에 고정합니다.

반경이 있는 투사체는 중심선 DDA만으로 충분하지 않습니다. swept AABB나 팽창된 금지 공간으로 후보를 넓힌 뒤 shape intersection과 TOI를 계산합니다. 미로딩 chunk는 empty가 아니라 unknown이며, collision은 보수 차단하고 bounded pending을 반환할 수 있습니다. [Voxel DDA의 경계 시간과 Supercover](/tech-interview/notes/dda-boundaries/)와 [연속 충돌·TOI·수치 여유와 관통 순서](/tech-interview/notes/continuous-contact/)의 경계 계약을 함께 적용합니다.

## Clearance와 navigation 파생

agent가 통과할 수 있는 공간은 cell 중심 하나가 아니라 몸체 footprint가 지나갈 수 있는 부피입니다. 2D 원형 agent가 회전 없이 병진한다면 장애물에 반경 r인 원판을 더하는 Minkowski sum으로 중심점 경로 문제로 바꿀 수 있습니다. 폭 W 통로는 이상적인 조건에서도 대략 `W>2r`이고, 접촉 등호와 양자화 여유를 추가로 정합니다.

높이, 경사, 계단, 비원형 회전, 수영과 비행 능력은 반경 하나로 표현되지 않습니다. profile별 source, overlay, rules version을 cache key에 넣습니다. cell center의 clearance가 충분해도 두 중심 사이 선분 전체의 여유가 자동으로 보장되는 것은 아니므로 실행 직전 shape sweep이 필요합니다.

Recast 공식 overview는 triangle mesh를 voxelize하고 agent가 이동할 수 없는 voxel을 filter한 뒤 region과 polygon을 거쳐 navmesh를 만드는 pipeline으로 설명합니다. 공식 integration 문서는 Recast 생성, Detour runtime query, DetourTileCache의 dynamic obstacle 및 re-baking 역할을 구분합니다. 이 페이지에는 프로젝트 release identifier가 표시되지 않았으므로 특정 배포 버전의 API 계약으로 확대하지 않습니다.

공식 설명은 모듈 역할과 pipeline 경계를 뒷받침하지만 특정 프로젝트의 tile ownership, obstacle update lifetime, agent profile 수치를 정하지 않습니다. navmesh tile artifact에는 입력 triangle 또는 voxel source, 영향 영역, profile, version, 생성 상태를 기록하고, 계획 결과를 실행 가능성의 영구 보장으로 취급하지 않습니다.

## Version bundle과 게시 순서

source 변경 이벤트는 파생 결과 완성 이벤트와 다릅니다. 새 벽이 기록된 직후 collision이 옛 버전이라면 이동을 보수적으로 막는 safety overlay를 먼저 게시할 수 있습니다. 이후 mesh, collision, navmesh를 생성하고 허용 조합을 확인합니다.

권장 순서는 `source change → affected halo invalidate → safety collision overlay → mesh/collision/nav derivation → compatibility check → atomic root swap`입니다. generation은 늦은 job이 최신 root를 덮지 못하게 하는 식별자입니다. reader pin, reference count, epoch는 옛 결과를 언제 회수할지 정하는 수명 보호이며 generation과 같은 역할이 아닙니다.

한 job이 생성되는 동안 source가 다시 바뀌면 이전 결과를 최신 결과로 착각하지 않습니다. 완료 시 target generation과 현재 목표를 비교해 옛 결과를 권위 root에 적용하지 않고, 최신 목표 하나로 작업을 합칠 수 있습니다. 폐기한 결과의 메모리와 snapshot lease는 cancellation completion까지 추적해 반환합니다.

## Streaming 운영과 장애 진단

streaming 상태를 `unloaded → loading → decoded → deriving → published → evicting`으로 나눌 수 있습니다. 실패와 취소는 별도 상태로 기록하고, render prefetch, collision, navigation, player 주변 요청에 우선순위와 CPU·메모리·네트워크 예산을 분리합니다.

플레이어가 청크 경계를 빠르게 왕복하면 prefetch queue가 포화될 수 있습니다. 이때 collision query를 empty로 바꾸지 않고 unknown 또는 blocked로 처리합니다. 오래된 render-only job은 취소할 수 있지만 reader가 붙은 원본 block은 즉시 free하지 않습니다. 같은 청크에 대한 여러 요청은 최신 목표 version으로 합치되, 취소 통지가 실제 작업 종료를 뜻한다고 가정하지 않습니다.

운영 지표는 resident bytes, queue depth, dirty age, safety overlay age, artifact lag, stale result discard 수, unknown block 비율, navmesh 재생성 p99를 포함할 수 있습니다. 다만 이 장에서 해당 수치를 측정하지 않았으며, 숫자 version 차이를 시간 지연으로 해석하지 않도록 age를 별도로 기록합니다.

누락된 벽은 source decode, overlay 적용, halo version, collision artifact 호환성, reader snapshot 순서로 추적합니다. 화면 crack은 경계 vertex 규칙, LOD pair, stitch topology, normal continuity를 확인합니다. 길이 막힘은 clearance profile과 stale nav tile을 collision false positive와 구분합니다.

## 의사코드와 lease 수명

아래는 특정 엔진 API가 아닌 버전이 맞는 bundle을 게시하는 의사코드입니다. `build`는 입력 version을 읽는 동안 source와 halo snapshot lease를 보유하고, `publishIfCurrent`는 현재 목표 generation과 비교해 원자적으로 root를 교체한다고 가정합니다.

```text
rebuildChunk(chunkId, target):
    source = null
    halo = null
    try:
        source = acquireSourceSnapshot(chunkId, target.sourceVersion)
        if source is absent:
            return pending_or_blocked("unknown source")
        halo = acquireHaloSnapshots(source, target.neighborVersions)
        if halo is incomplete:
            return pending_or_blocked("unknown halo")
        mesh = buildMesh(source, halo, target.rulesVersion)
        collision = buildCollision(source, halo, target.profileVersion)
        nav = buildNavigation(source, halo, target.profileVersion)
        bundle = makeBundle(source, halo, mesh, collision, nav)
        require bundle.compatible(target)
        return publishIfCurrent(chunkId, target.generation, bundle)
    finally:
        if halo is not null:
            halo.release()
        if source is not null:
            source.release()
```

이 코드는 실제 컴파일 가능한 플랫폼 API가 아니라 lease와 오류 경계를 보여 주는 의사코드입니다. source가 없는 정상 보류, halo incomplete, build 예외, compatibility 거절, stale publish를 서로 다른 상태로 기록해야 합니다. `publishIfCurrent`가 실패했다고 bundle 자체가 잘못된 것은 아니며, 더 최신 target이 먼저 게시된 경우일 수 있습니다.

`finally`에서 lease를 해제한 뒤 반환 bundle이 source나 halo의 raw pointer를 계속 참조하면 dangling pointer가 됩니다. bundle이 독립 소유 복사본인지, 결과에 lease를 포함하는지, publish된 root가 별도의 소유권을 갖는지 구현 API에서 고정합니다.

## 검증 범위와 참고 자료

검증 기준에는 음수 world coordinate, 면·모서리·꼭짓점 이웃, 단일 voxel, material boundary, palette 4→5 재질, 인접 청크 LOD 조합, T-junction, camera 왕복, 얇은 벽, narrow passage, door overlay, 미로딩 ray/path, 늦은 job completion을 포함합니다.

이번 검토에서는 repository 빌드·테스트, OpenVDB/NanoVDB API 컴파일, Recast bake, 실제 benchmark를 실행하지 않았습니다. 수치 trace는 직접 계산한 설명이고 p99, crack 길이, 누락률은 측정 결과가 아닙니다.

- [복셀 점유·재질·동적 Overlay와 희소 저장](/tech-interview/notes/voxel-semantics/) — repository note, 2026-09-17 확인. 의미 층, palette/bitmap, reader 수명을 사용했습니다.
- [청크 경계·Halo·파생 데이터의 Version Bundle](/tech-interview/notes/voxel-version-bundle/) — repository note, 2026-09-17 확인. halo, generation, 원자 게시를 사용했습니다.
- [Voxel DDA의 경계 시간과 Supercover](/tech-interview/notes/dda-boundaries/) — repository note, 2026-09-17 확인. 경계 cell과 unknown 정책을 사용했습니다.
- [경로 공간·모서리 이동·Agent Clearance](/tech-interview/notes/navigation-clearance/) — repository note, 2026-09-17 확인. profile별 clearance와 nav 경계를 사용했습니다.
- [연속 충돌·TOI·수치 여유와 관통 순서](/tech-interview/notes/continuous-contact/) — repository note, 2026-09-17 확인. swept shape와 TOI를 사용했습니다.
- [OpenVDB Overview](https://www.openvdb.org/documentation/doxygen/overview.html) — 제공된 자료 기준 OpenVDB 13.1.0 documentation, 2026-09-17 확인. Tree/Transform/Grid, voxel/tile/background, active/inactive 설명을 사용했습니다. 페이지의 실시간 현재성은 독립 검증하지 않았습니다.
- [NanoVDB FAQ](https://www.openvdb.org/documentation/doxygen/NanoVDB_FAQ.html) — 제공된 자료 기준 OpenVDB 13.1.0 documentation, 2026-09-17 확인. static topology와 pointer-less contiguous layout 설명을 사용했습니다. 성능 보장으로 확대하지 않았습니다.
- [NanoVDB Build Instructions](https://www.openvdb.org/documentation/doxygen/NanoVDB_HowToBuild.html) — 제공된 자료 기준 OpenVDB 13.1.0 documentation, 2026-09-17 확인. self-contained core와 optional dependency 경계를 확인했습니다.
- [OpenVDB 13.1.0 Release Notes](https://www.openvdb.org/documentation/doxygen/changes.html#v13_1_0_changes) — 13.1.0, 2026-09-16으로 표시된 release notes, 2026-09-17 확인. 버전·날짜 식별에만 사용했으며 최신 release라는 주장은 하지 않았습니다.
- [OpenVDB 13.1.0 Release Page](https://github.com/AcademySoftwareFoundation/openvdb/releases/tag/v13.1.0) — v13.1.0 tag를 식별하는 공식 release page, 2026-09-17 확인. release page identity만 사용했으며 최신 상태나 API endpoint로 해석하지 않았습니다.
- [Recast Navigation](https://recastnav.com/) 및 [Building and Integrating](https://recastnav.com/md_Docs_2__2__BuildingAndIntegrating.html) — 공식 페이지, 2026-09-17 확인 자료. 페이지에 release identifier가 표시되지 않아 버전 불명으로 기록했습니다. voxelize→filter→region→polygon→navmesh와 DetourTileCache의 모듈 역할만 주장합니다.
- Unity LOD 문서는 <https://docs.unity3d.com/6000.0/Documentation/Manual/mesh-level-of-detail.html>을 시도했으나 HTTP 404였으므로 Unity-specific threshold, cross-fade, seam 계약에는 사용하지 않았습니다.
- OpenVDB `13.1.0`은 2026-09-16 릴리스로 표시된 문서와 release page의 버전 식별에만 사용했습니다. 2026-09-17 현재 최신 버전이라는 주장은 하지 않습니다. 이 장은 학습용 설명이며 라이브러리 실행 검증 결과가 아닙니다.

---
id: recast-voxel-reference-lab
title: 복셀 경계와 Recast Tile 수명 실습
topic: 게임 서버
summary: 엔진 없는 복셀 reference와 고정 Recast Navigation tile-cache harness로 좌표·면·halo·충돌·generation·nav query·tile memory 수명을 분리해 검증합니다.
questionIds: []
prerequisites: [voxel-pipeline, spatial-tree-foundations, pathfinding-foundations]
related: [voxel-semantics, voxel-version-bundle, dda-boundaries, navigation-clearance, continuous-contact, navigation-production]
reviewedAt: '2026-09-18'
---

# 복셀 경계와 Recast Tile 수명 실습

```diagram
{"title":"복셀 파생 결과 게시","caption":"원본과 halo를 읽은 파생 결과는 입력 버전을 확인한 뒤 게시합니다.","rows":[[{"id":"source","label":"복셀 원본","detail":["권위 상태"]},{"id":"halo","label":"이웃 halo","detail":["버전 입력"]}],[{"id":"derive","label":"파생 작업","detail":["mesh·collision·nav"]}],[{"id":"check","label":"버전 검사","detail":["stale 차단"]}],[{"id":"publish","label":"원자적 게시","detail":["호환 결과"]}]],"edges":[{"from":"source","to":"derive","label":"source 읽기"},{"from":"halo","to":"derive","label":"경계 읽기"},{"from":"derive","to":"check","label":"결과 입력 기록"},{"from":"check","to":"publish","label":"현재 상태 일치"}]}
```

## 실습 목표

이 실습은 하나의 거대한 “복셀 엔진”을 만들지 않습니다. 먼저 엔진과 무관한 작은 Python reference로 복셀 월드의 저장·메시·충돌·재생성 계약을 고정하고, 그 다음 Recast Navigation의 실제 C++ API를 별도 harness로 연결합니다. 둘을 나누는 이유는 복셀 원본과 파생 산출물의 불변식은 직접 검증할 수 있지만, Recast의 tile-cache ownership과 query state는 해당 라이브러리의 헤더·구현·빌드에 의존하기 때문입니다.

이 패키지가 보이는 범위는 다음과 같습니다.

- world coordinate를 `floor` 기반 chunk/local coordinate로 나누고 음수 경계를 보존합니다.
- 인접 chunk의 halo가 없을 때 “empty”로 추정하지 않고 `unknown` 또는 `blocked`로 반환합니다.
- 6방향 face visibility와 제한된 greedy rectangle 병합을 실행합니다.
- 수정한 chunk와 6면 이웃을 dirty로 표시하고, snapshot generation이 늦은 결과를 거부할 근거가 됩니다.
- AABB collision oracle은 실제 shape solver가 아니라 고체 복셀과 미로딩 공간을 보수적으로 구분합니다.
- coarse boundary의 한 edge와 fine boundary의 두 span에서 T-junction이 생기는 topology를 고정하고, stitch geometry가 필요한 이유와 이 예제의 한계를 명시합니다.
- Recast `v1.6.0`을 고정한 CMake harness에서 navmesh query, tile layer encode/decode, tile-cache 초기화·update·teardown을 호출하도록 준비합니다. 2026-09-18 공식 고정 소스를 받아 macOS에서 빌드·실행했습니다.

Recast harness가 게임 엔진 충돌이나 실제 dynamic obstacle streaming을 증명한다고 말하지 않습니다. Python AABB oracle은 제한된 기준 판정입니다. C++ harness는 빈 cache뿐 아니라 4×4 walkable layer를 추가하고, 영역 전체를 덮는 box obstacle의 추가·제거에 따라 polygon이 사라졌다 복원되는 것을 검사합니다. 여러 타일 streaming과 동시 reader는 별도 범위입니다.

## 기본 모델

복셀 하나의 의미를 `occupied` 하나로 축약하면 저장은 단순하지만 질의의 전제가 사라집니다. 이 실습은 다음 층을 분리합니다.

1. **Source** — chunk의 local solid set과 세대입니다. source는 사실의 권위입니다.
2. **Halo dependency** — 면 생성이 읽은 이웃 chunk의 `(chunkId, generation)` 집합입니다. halo는 단순 값 복사가 아니라 입력 version을 가진 의존성입니다.
3. **Derived mesh** — solid cell의 이웃이 비어 있을 때 출력한 face 목록과 제한적인 greedy 결과입니다. material, transparency, lighting boundary는 이 reference에 없습니다.
4. **Collision oracle** — moving AABB와 고체 voxel AABB의 겹침을 검사합니다. 미로딩 chunk는 `unknown_blocked`입니다.
5. **Snapshot generation** — 작업이 읽은 source/halo 상태와 현재 목표를 비교하는 논리 세대입니다. generation은 reader가 메모리를 붙잡아 주는 lease나 epoch가 아닙니다.

청크 크기를 `C=4`로 둔 것은 trace를 짧게 하기 위한 선택입니다. 일반식은 `chunk=floor(world/C)`, `local=world-chunk*C`입니다. 그래서 `world=-1`은 `chunk=-1`, `local=3`입니다. 0 방향 정수 나눗셈을 사용하면 이 값이 chunk 0 또는 local -1로 잘못 들어가며, 경계 face와 halo invalidation이 모두 틀어집니다.

메시 생성은 각 solid cell의 여섯 방향을 봅니다. 이웃이 solid이면 face를 생략하고, 이웃이 empty이면 face를 냅니다. 이웃 chunk가 load되지 않았으면 face를 내지 않고 `UnknownChunk`를 발생시킵니다. “없는 hash key=empty”는 미로딩 벽을 화면·충돌에서 누락시키므로 금지합니다.

Greedy 병합은 같은 방향·같은 평면에 있는 unit face를 직사각형으로 합칩니다. 구현은 material이 없는 reference이므로 실제 renderer에 복사할 수 없습니다. 생산 구현에서는 material, alpha, lightmap seam, normal, UV, winding을 병합 조건에 포함하고 변경 면적만 다시 계산해야 합니다.

## 작업 상태 trace

첫 trace는 두 chunk의 경계와 generation을 사용합니다.

| 순서 | 사건 | 상태와 판단 |
| --- | --- | --- |
| 1 | A는 `(0,0,0)` generation 10, B는 `(1,0,0)` generation 4 | A가 B 경계를 읽어 mesh 후보를 만들 수 있습니다. snapshot은 B generation 4를 기록합니다. |
| 2 | B의 world `(4,0,0)`을 solid로 변경 | B generation은 5가 되고 A와 면을 공유하는 A chunk가 dirty가 됩니다. |
| 3 | A의 예전 결과가 완료 | 결과가 B generation 4를 가리키면 현재 B generation 5와 불일치하므로 권위 root에 게시하지 않습니다. |
| 4 | A가 새 halo를 읽어 재생성 | 새 snapshot은 B generation 5를 기록하고 현재 target과 일치할 때 게시 후보가 됩니다. |

이 trace에서 dirty set은 A 하나만이 아니라 수정 chunk와 6면 이웃을 포함합니다. 실제 생성 footprint가 모서리·꼭짓점·큰 agent·긴 ray를 읽는다면 6면만 표시하는 단순 invalidation을 넓혀야 합니다. 영향 영역을 모를 때 좁게 잡아 누락시키는 것보다 보수적으로 넓게 잡는 편이 안전합니다.

Python reference의 `snapshot_generation_trace()`는 위 trace의 네 문장을 반환하고, `run_tests()`는 예전 snapshot과 새 snapshot의 차이를 assert합니다. 이것은 메모리 reclamation을 검증하는 테스트가 아닙니다. 늦은 결과 적용 방지만 generation의 범위입니다.

## Coarse와 Fine Seam의 topology

왼쪽 coarse patch는 `[0,2]×[0,2]`, 오른쪽 fine patch는 `[2,4]×[0,2]`입니다. 공유 변 `x=2`에서 fine 쪽은 `y=1`에 중간 꼭짓점이 있지만 coarse quad에는 없습니다. 그대로 삼각화하면 T-junction이 생깁니다.

`seam_example()`은 coarse 경계에 `(2,1)`을 넣고 중심 `(1,1)`에서 다섯 삼각형을 생성합니다. 두 patch의 공유 변 집합이 `[(2,0),(2,1)]`, `[(2,1),(2,2)]`로 일치하고 coarse 면적 합계가 4인지 검사합니다. 실제 삼각형 좌표를 생성하는 평면 2:1 예제이지만 일반적인 Transvoxel, normal·material 연속성, collision seam이나 GPU rasterization을 구현한 것은 아닙니다.

## 충돌 oracle과 미로딩 공간

`collision_oracle()`은 moving AABB에 겹칠 가능성이 있는 integer voxel box를 순회합니다. 고체 voxel을 만나면 `solid_hit`을 반환하고, 필요한 chunk가 없으면 `unknown_blocked`를 반환합니다. 아무 고체도 없고 모든 읽기가 성공하면 `clear`입니다.

이 oracle은 다음을 일부러 하지 않습니다.

- 중심선 DDA만으로 반경 있는 shape의 충돌을 근사하지 않습니다. 실제 게임에서는 swept AABB를 broad phase로 쓰고 shape intersection과 TOI를 별도로 계산해야 합니다.
- 회전, 경사, capsule, continuous contact, 반사·관통 사건을 처리하지 않습니다.
- 후보 방문 범위는 100,000개 이하로 제한하지만 wall-clock 시간 budget과 reader lease는 구현하지 않습니다.

따라서 이 함수의 `clear`는 “이 제한된 snapshot과 축 정렬 voxel box에 고체가 없었다”는 뜻이지 미래 tick에서도 안전하다는 뜻이 아닙니다. unknown을 empty로 바꾸지 않는 것이 이 작은 oracle의 핵심 안전 계약입니다.

## 코드 walkthrough

`examples/knowledge/recast-voxel-lab/voxel_reference.py`의 실행 순서는 다음과 같습니다.

1. `floor_divmod()`와 `split_voxel()`이 음수 좌표를 처리합니다.
2. `World.put_chunk()`는 local coordinate가 `[0,C)`인지 검사하고 source를 등록합니다.
3. `World.cell()`은 chunk miss를 `None`으로 보존합니다. 이 `None`이 halo unknown입니다.
4. `World.visible_faces()`는 각 solid cell의 6방향을 읽고 unknown이면 중단합니다.
5. `greedy_rectangles()`는 방향·평면별 face 집합에서 같은 행의 폭과 높이를 확장합니다. 단순 reference이므로 material key가 없습니다.
6. `World.set_solid()`는 해당 source generation과 전체 target generation을 증가시키고 수정 chunk와 이웃을 invalidation합니다.
7. `collision_oracle()`는 AABB 교차 뒤 `None`, `True`, `False`를 각각 unknown, solid, empty 정책으로 변환합니다.
8. `seam_example()`은 coarse 변 분할 뒤 삼각형을 생성하고 공유 변 집합과 면적 보존을 검사합니다.

실행 entrypoint에는 빈 함수나 가짜 성공 결과를 두지 않았습니다. 모든 assert는 계산된 상태를 대상으로 하며 마지막 PASS 문자는 모든 테스트를 통과한 경우에만 출력됩니다.

## Recast 모델과 수명

Recast 공식 문서는 Recast를 navmesh generation, Detour를 runtime pathfinding·navmesh queries, DetourTileCache를 runtime dynamic obstacle·re-baking 역할로 구분합니다. 이 실습은 그 역할 경계를 따라 소스에 직접 링크합니다.

공식 `v1.6.0` release API와 CMake 자료에서 확인한 고정점은 다음과 같습니다. release page의 날짜 표시는 fetched 응답에서 연도·시간대가 제공되지 않은 값으로, tag·CMake source의 stable identity와 구분합니다.

- release tag: `v1.6.0`
- annotated tag object: `b4554541b658630816dba41466eb1cefb624519e`
- 실제 checkout commit: `6dc1667f580357e8a2154c28b7867bea7e8ad3a7`
- release page publication: `21 May 17:52` (the fetched page did not expose year or time zone)
- CMake library version: `1.6.0`, C++98 global property
- 필요한 runtime targets: `RecastNavigation::Recast`, `RecastNavigation::Detour`, `RecastNavigation::DetourTileCache`

이 버전 고정은 “현재 최신”이라는 뜻이 아닙니다. fetched release page에는 `v1.6.0`보다 최신 stable release 표시가 없었지만, 그 결과만으로 2026-09-18의 stable latest를 증명하지 않습니다. 다른 release나 unreleased main의 동작을 이 harness의 계약으로 추론하지 않습니다.

단일 polygon navmesh fixture에서는 `dtCreateNavMeshData()`가 만든 buffer를 `dtNavMesh::addTile(..., DT_TILE_FREE_DATA, ...)`에 넘깁니다. 성공 뒤에는 navmesh가 data를 소유하므로 fixture가 다시 free하지 않습니다. 성공 이전 failure라면 fixture destructor가 소유한 buffer를 회수해야 합니다. 이 ownership은 raw pointer의 편의가 아니라 addTile flags와 teardown 순서의 계약입니다.

Tile-cache layer는 `dtBuildTileCacheLayer()`로 압축하고 `dtDecompressTileCacheLayer()`로 풀어 header round-trip을 확인합니다. decompressed layer는 `dtFreeTileCacheLayer()`로 allocator와 함께 해제하고, 압축 builder output은 cache의 `addTile(..., DT_COMPRESSEDTILE_FREE_DATA, ...)` 성공 뒤 cache로 소유권을 넘깁니다. allocator·compressor·mesh process는 cache보다 오래 살도록 선언 순서를 고정합니다.

`dtTileCache::update()`는 공식 v1.6.0 구현에서 한 호출에 최대 하나의 queued tile을 rebuild하며, obstacle request 처리·tile queue·up-to-date 플래그가 별도 상태입니다. 이 harness는 초기 빈 cache를 확인한 뒤 non-empty layer를 추가하고, box obstacle 추가·제거마다 최대 32회 update로 완료를 기다립니다. `DT_OBSTACLE_PROCESSED`, walkable polygon 제거, 제거 후 복원을 검사합니다. 특히 구현상 tile insertion failure가 이전 tile 제거 뒤에 발생할 수 있고 자동 rollback이 보장되지 않으므로, 운영 wrapper는 실패 시 안전 정책과 재생성 상태를 별도로 설계해야 합니다.

`dtNavMeshQuery`는 `init(nav, maxNodes)` 뒤 nearest polygon과 path query를 실행합니다. path 결과는 polygon reference의 corridor이며, 실제 이동 waypoint·shape sweep·최신 voxel source 검증을 포함하지 않습니다. polygon reference의 mesh 변경 뒤 유효성, 일반 thread safety, reader 수명은 이 API smoke test의 범위 밖입니다.

## 실행 명령

저장소 루트에서 Python reference를 먼저 실행합니다.

```sh
python3 examples/knowledge/recast-voxel-lab/voxel_reference.py
```

예상 출력은 다음과 같습니다.

```text
PASS voxel_reference: coordinate, face, greedy, halo, AABB, seam, generation
```

Recast source는 별도로 준비해야 합니다. package는 다운로드하지 않습니다. 공식 tag와 commit을 확인한 source tree를 사용합니다.

```sh
git -C "$HOME/src/recastnavigation-v1.6.0" rev-parse HEAD
cmake -S examples/knowledge/recast-voxel-lab/recast-harness \
  -B examples/knowledge/recast-voxel-lab/recast-harness/build \
  -DRECAST_SOURCE_DIR="$HOME/src/recastnavigation-v1.6.0" \
  -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
  -DCMAKE_BUILD_TYPE=Debug
cmake --build examples/knowledge/recast-voxel-lab/recast-harness/build --parallel 2
examples/knowledge/recast-voxel-lab/recast-harness/build/recast_lifetime_harness
```

정상 output은 다음과 같습니다.

```text
PASS recast_lifetime_harness: query, layer round-trip, cache init/update/teardown
```

CMake는 `RECAST_SOURCE_DIR`가 git checkout이며 pinned v1.6.0 commit인지 먼저 확인한 뒤, Recast, Detour, DetourTileCache CMake files를 확인하고 source tree의 top-level CMake를 `EXCLUDE_FROM_ALL`로 추가합니다. `RECASTNAVIGATION_DEMO`, `RECASTNAVIGATION_TESTS`, `RECASTNAVIGATION_EXAMPLES`를 끄므로 SDL2·Catch2·demo build를 요구하지 않습니다. build directory는 package 안에 두고 병렬도 2로 제한합니다.

## 실패 주입과 진단

### 음수 좌표 실패

`split_voxel((-1,0,0))`가 `((-1,0,0),(3,0,0))`이 아니면 C/C++식 0 방향 나눗셈을 의심합니다. 먼저 chunk/local 계산을 독립 함수로 분리하고, `-C`, `-C-1`, `0`, `C-1`, `C`를 표로 비교합니다. 이 실패는 face 누락보다 먼저 고쳐야 halo lookup이 의미를 갖습니다.

### Halo 누락 실패

이웃 chunk를 `put_chunk()`하지 않은 상태에서 `visible_faces()` 또는 `mesh_snapshot()`을 호출하면 `UnknownChunk`여야 합니다. `False`나 empty face 목록이 나오면 load miss가 empty로 축약된 것입니다. collision에서는 같은 조건이 `unknown_blocked`여야 하며, 그렇지 않으면 미로딩 벽을 통과하는 안전성 결함입니다.

### Stale generation 실패

B를 generation 4에서 5로 바꾼 뒤 A의 예전 snapshot을 게시하면 안 됩니다. log에는 target generation, source generation, halo dependency, job id를 함께 남깁니다. 단순 generation 비교는 raw memory lifetime을 해결하지 않으므로, 실제 비동기 builder에서는 immutable snapshot·pin·epoch 중 하나를 추가합니다.

### Seam 실패

coarse boundary vertex 수가 1 span이고 fine boundary가 2 span이면 T-junction이 의도적으로 재현됩니다. 화면의 crack만 skirt로 가리면 collision과 normal이 여전히 어긋날 수 있습니다. 진단은 pair별 topology, edge split 위치, winding, normal continuity를 출력하고, 실제 physics mesh가 같은 transition geometry를 읽는지 확인하는 순서입니다.

### Recast configure 실패

`RECAST_SOURCE_DIR`가 v1.6.0 source tree가 아니면 configure가 `Missing Recast/CMakeLists.txt` 같은 명시 오류로 종료해야 합니다. 소스를 자동 다운로드하거나 임의 main branch로 바꾸지 않습니다. tag commit이 다르면 version mismatch로 중단합니다.

### Recast query 실패

`findNearestPoly()`가 status success여도 polygon reference가 0인지 확인합니다. `findPath()`의 status success는 buffer가 충분하다는 조건과 함께 보고하고, `DT_BUFFER_TOO_SMALL`을 완전한 경로로 해석하지 않습니다. query object의 node budget과 mesh lifetime을 로그에 남깁니다.

### Tile memory 실패

`DT_TILE_FREE_DATA`로 navmesh에 넘긴 buffer를 fixture destructor에서 다시 free하면 double free가 됩니다. 반대로 addTile failure 뒤 buffer를 잃으면 leak입니다. 소유권 상태를 `created → transferred`로 추적하고, transfer 직후 local pointer를 null로 만드는 것이 진단 기준입니다.

### Tile-cache update 실패

`upToDate=true`는 이 호출 시점에 queued obstacle request와 tile rebuild queue가 비었다는 의미이지, 애플리케이션의 source·mesh·collision이 최신이라는 의미가 아닙니다. 실제 obstacle rebuild를 붙일 때는 update status, queue depth, tile ref, input generation, replacement failure를 별도 기록합니다.

## 실제 검증 범위

### 실행한 항목

Python reference는 2026-09-18 이 환경에서 실행했고 다음을 통과했습니다.

- 음수 chunk/local 변환
- 인접 chunk face 생성과 경계 벽 변경
- 단순 greedy rectangle 병합
- solid hit와 unknown blocked AABB oracle
- coarse/fine 공유 변 분할, 삼각형 생성과 면적 보존
- halo generation 변경과 stale snapshot 차이

### C++ 실행과 미검증 경계

공식 v1.6.0 checkout의 실제 HEAD `6dc1667f580357e8a2154c28b7867bea7e8ad3a7`을 확인하고 CMake configure·build·query·layer round-trip·장애물 추가/제거 재빌드를 통과했습니다. macOS SDK의 C++ 헤더 검색 경로를 명시해야 하는 환경에서는 `-isysroot "$(xcrun --show-sdk-path)" -isystem "$(xcrun --show-sdk-path)/usr/include/c++/v1"`을 C++ 컴파일 옵션에 추가합니다. upstream 헤더의 정수 변환 경고와 중복 라이브러리 링크 경고가 있었으며 경고 없는 빌드라고 주장하지 않습니다.

ASan·UBSan을 켠 Recast 실행, 다중 타일 갱신, allocator 실패 주입, query buffer truncation과 동시 reader의 reference invalidation은 추가 검증 대상입니다. 한 타일의 성공 경로는 게임 엔진 통합이나 운영 장애 복구의 증거가 아닙니다.

## 공식 근거와 적용 범위

- [Recast Navigation v1.6.0 release](https://github.com/recastnavigation/recastnavigation/releases/tag/v1.6.0) — `v1.6.0` release page와 `21 May 17:52` publication 표시를 확인했습니다. fetched page에는 연도·시간대가 없었고, 더 최신 stable release 표시도 없었지만 이것만으로 2026-09-18의 stable latest를 주장하지 않습니다.
- [v1.6.0 tag API](https://api.github.com/repos/recastnavigation/recastnavigation/git/ref/tags/v1.6.0) — annotated tag object `b4554541b658630816dba41466eb1cefb624519e`를 확인했습니다. source pin identity에만 적용합니다.
- [v1.6.0 top-level CMake](https://raw.githubusercontent.com/recastnavigation/recastnavigation/v1.6.0/CMakeLists.txt) — CMake minimum, library version, C++98 property, component directories와 build options 근거입니다. 이 문서의 harness가 demo/tests를 끄는 결정에 적용합니다.
- [Building and Integrating](https://recastnav.com/md_Docs_2__2__BuildingAndIntegrating.html) — source-level integration, Recast/Detour/TileCache module roles, memory hook와 build option 설명에 적용합니다. 페이지에 release identifier가 없어 일반 integration guidance와 v1.6.0 source inspection을 분리했습니다.
- [DetourTileCache class reference](https://recastnav.com/classdtTileCache.html) — `init`, `addTile`, `removeTile`, obstacle APIs, `update`의 documented shape와 의미에 적용합니다. page version이 불명확하므로 exact lifetime contract는 pinned v1.6.0 header/implementation과 함께 확인해야 합니다.
- [v1.6.0 DetourTileCache implementation](https://raw.githubusercontent.com/recastnavigation/recastnavigation/v1.6.0/DetourTileCache/Source/DetourTileCache.cpp) — tile memory ownership flag, one tile rebuild per update, queue completion, insertion failure cleanup의 source-level 근거입니다.
- [dtNavMeshQuery reference](https://recastnav.com/classdtNavMeshQuery.html) — query init/node budget, nearest polygon/path result, buffer/status caveat에 적용합니다. release/API revision은 page에서 확정하지 않았습니다.
- [voxel-pipeline](/tech-interview/notes/voxel-pipeline/) — repository note, 2026-09-17 확인. chunk floor, halo version, face/greedy, seam, collision, generation bundle의 기존 개념을 재사용했습니다.
- [voxel-semantics](/tech-interview/notes/voxel-semantics/) — repository note, 2026-09-17 확인. source와 dynamic overlay의 의미 분리 및 unknown 정책을 연결했습니다.
- [voxel-version-bundle](/tech-interview/notes/voxel-version-bundle/) — repository note, 2026-09-17 확인. halo invalidation, safety boundary, root swap와 reader lifetime 구분을 연결했습니다.
- [spatial-tree-foundations](/tech-interview/notes/spatial-tree-foundations/) — repository note, 2026-09-17 확인. broad-phase AABB와 실제 정밀 판정의 분리를 적용했습니다.
- [pathfinding-foundations](/tech-interview/notes/pathfinding-foundations/) — repository note, 2026-09-17 확인. NavMesh/Detour path result가 실행 직전 shape 검증을 대체하지 않는다는 경계를 재사용했습니다.
- [dda-boundaries](/tech-interview/notes/dda-boundaries/) — repository note, 2026-09-17 확인. voxel traversal과 supercover의 경계 의미를 구분했습니다.
- [continuous-contact](/tech-interview/notes/continuous-contact/) — repository note, 2026-09-17 확인. swept AABB·TOI·반복 상한을 실제 oracle 범위와 분리했습니다.

이 노트는 Recast의 모든 공식 기능, 모든 allocator/compressor 구현, 모든 tile streaming 시나리오를 다루지 않습니다. 검증 가능한 작은 경계를 유지하고, 실제 운영 통합은 source pin·build output·lifetime·queue·failure telemetry를 추가로 확인하는 별도 작업으로 남깁니다.

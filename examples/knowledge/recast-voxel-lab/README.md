# 복셀·Recast 실행 경계 실습

Python reference와 실제 Detour/TileCache C++ API를 분리해서 실행합니다.

- `voxel_reference.py`: 음수 청크 좌표, halo unknown, 면 생성·greedy 병합, AABB oracle, 평면 coarse/fine stitch 삼각형, 입력 세대 비교
- `recast-harness/`: 고정 v1.6.0 소스에 링크한 navmesh query, layer round-trip, 장애물 추가·제거와 타일 재생성

## 실행

저장소 루트에서 실행합니다. Recast 소스는 별도로 준비하며 빌드 스크립트가 자동 다운로드하지 않습니다.

```sh
python3 examples/knowledge/recast-voxel-lab/voxel_reference.py
git -C "$HOME/src/recastnavigation-v1.6.0" rev-parse HEAD
# expected: 6dc1667f580357e8a2154c28b7867bea7e8ad3a7
cmake -S examples/knowledge/recast-voxel-lab/recast-harness \
  -B examples/knowledge/recast-voxel-lab/recast-harness/build \
  -DRECAST_SOURCE_DIR="$HOME/src/recastnavigation-v1.6.0" \
  -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DCMAKE_BUILD_TYPE=Debug
cmake --build examples/knowledge/recast-voxel-lab/recast-harness/build --parallel 2
examples/knowledge/recast-voxel-lab/recast-harness/build/recast_lifetime_harness
```

macOS SDK의 C++ 헤더가 기본 검색 경로에서 누락된 경우 CMake C++ 옵션에 `-isysroot "$(xcrun --show-sdk-path)" -isystem "$(xcrun --show-sdk-path)/usr/include/c++/v1"`을 추가합니다.

## 실제 검증

2026-09-18 macOS arm64에서 Python 검사를 통과했고, 공식 v1.6.0 checkout에 링크하여 C++ 빌드·query·layer round-trip·장애물 재빌드를 통과했습니다. upstream 정수 변환 경고와 중복 라이브러리 링크 경고가 있었으며 경고 없는 빌드라고 주장하지 않습니다.

평면 stitch는 공유 변 집합과 면적을 검사하는 작은 예제입니다. 일반 Transvoxel, GPU crack rasterization, normal·material·물리 seam은 아닙니다. AABB oracle도 실제 shape sweep을 대체하지 않습니다. 게임 엔진, 다중 타일 streaming, 동시 reader, allocator 실패, 운영 성능과 Recast sanitizer 실행은 미검증입니다.

[학습 노트](https://c86j224s.github.io/tech-interview/notes/recast-voxel-reference-lab/)

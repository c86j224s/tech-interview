# 고정 Recast CMake 수명 실습

## 버전 고정

공식 tag는 `v1.6.0`입니다. annotated tag object `b4554541b658630816dba41466eb1cefb624519e`와 실제 checkout commit `6dc1667f580357e8a2154c28b7867bea7e8ad3a7`은 다른 객체입니다. CMake는 후자를 `git rev-parse HEAD`와 비교합니다. 최신 버전이라고 주장하지 않습니다.

빌드 명령과 macOS SDK 옵션은 [상위 README](../README.md)에 있습니다. 외부 의존성은 Recast 소스이며 CMake가 자동 다운로드하지 않습니다.

## 확인 경계

- 단일 polygon tile 생성과 `DT_TILE_FREE_DATA` 소유권 이전
- nearest polygon·path query
- 압축 layer encode/decode
- 4×4 layer의 연결 정보와 walkable polygon 생성
- box obstacle 처리 뒤 polygon 제거, obstacle 제거 뒤 polygon 복원
- 최대 32회 update의 bounded drain과 정상 cache teardown

압축 layer의 `addTile(..., DT_COMPRESSEDTILE_FREE_DATA, ...)`가 성공하면 cache가 byte buffer를 소유합니다. decompressed layer는 allocator로 별도 해제합니다. allocator·compressor·mesh processor는 cache보다 오래 유지합니다.

## 실행 결과와 한계

2026-09-18 macOS arm64에서 공식 checkout으로 컴파일·링크·실행을 통과했습니다. Recast 소스의 정수 변환 경고와 중복 라이브러리 링크 경고가 있었습니다. 전체 지형 voxelization, 일반 path buffer truncation, 다중 타일 streaming, 동시 query reader, allocator 실패 주입, ASan·UBSan 및 성능 시험은 수행하지 않았습니다. 실패 assertion은 프로세스를 종료하며 모든 실패 경로의 RAII 정리를 검증하는 예제는 아닙니다.

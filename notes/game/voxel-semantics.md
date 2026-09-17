---
id: voxel-semantics
title: 복셀 점유·재질·동적 Overlay와 희소 저장
topic: 게임 서버
summary: 고체와 agent 이동성을 분리하고 정적 벽/문/객체의 독립 의미·profile cache·dense/hash chunk/octree·palette/bitmap 갱신·압축 수명을 설명합니다.
questionIds: [voxel-occupancy-representation, voxel-static-dynamic-overlay, voxel-sparse-storage, voxel-palette-bitmap-update-cost]
---

# 복셀 점유·재질·동적 Overlay와 희소 저장

## 고체 점유와 Agent별 이동성

물은 수영 가능 agent와 지상 agent에게 다르고 낮은 통로는 작은 몸체만 통과할 수 있습니다. 원본의 재질·고체 부피, 동적 문/객체 점유, 반경·높이·경사·계단·비행 능력을 나눕니다. 하나의 occupied bit는 저장은 작지만 필요한 질의 조건을 잃을 수 있습니다.

예를 들어 물 위를 수영할 수 있어도 지상 agent가 그 cell을 걸을 수 있다는 뜻은 아니므로, 조회는 같은 source/profile/overlay version에서 clearance(주변 여유), 지지면, 필요한 부피, 이동 능력을 함께 읽습니다. 비행 agent는 발밑 cell 하나가 비어 있는지만 보지 않고 이동하는 전체 3D footprint를 검사합니다. 이 결과를 cache에 저장한다면 조회에 사용한 원본·profile·overlay·규칙 version에 종속시켜 서로 다른 버전의 결과를 섞지 않습니다.

## 문 shape contribution 제거와 잔여 고체 점유

문을 열어 문 shape의 contribution을 제거해도 같은 cell에 문틀이나 뒤 벽의 contribution이 남아 있으면 그 고체를 false로 바꾸지 않습니다. 독립 고체들의 union만 계산하는 층에서는 OR가 적절할 수 있지만, 물·위험·투명도·agent 능력은 별도 의미로 읽고 하나의 boolean에 합치지 않습니다. 삭제할 때는 문 객체가 추가한 contribution만 되돌립니다.

| 층 | 보존할 의미 |
| --- | --- |
| 정적 source | 재질·고체·지형 version |
| 동적 overlay | 문·물체 ID/generation·현재 상태 |
| 파생 이동성 | clearance·높이·경사·source/profile |
| 질의 결과 | 통과·동적 차단·여유 부족·unknown |

문이나 물체가 자주 바뀌는 동안 정적 압축 block을 매번 다시 인코딩하지 않으려면, 변경된 객체의 contribution을 overlay 층에 따로 기록할 수 있습니다. 조회는 정적 block을 읽은 뒤 overlay를 함께 적용하고, overlay 깊이가 커져 읽기 비용이 늘기 전에 정적 block과 합치는 임계와 version 교체 시점을 관리합니다.

## Hash Chunk와 희소 월드 저장 선택

조밀 배열은 cell index 계산·이웃 순회가 단순하지만 빈 부피도 차지합니다. hash chunk는 존재하는 영역만 찾고 내부를 연속 배열로 두어 국소 locality를 얻습니다. octree는 큰 균일 빈/동일 재질 영역을 상위 node로 묶지만 복잡한 경계·한 cell 수정에서 split/merge·pointer 비용이 늘 수 있습니다.

```diagram
{"title":"저장 표현과 게임 질의 의미를 분리합니다","caption":"화살표는 조회 경로입니다. 압축이 원본 재질·동적 객체의 독립 의미를 지우지 않고 profile에 맞는 이동성을 계산하게 합니다.","rows":[[{"id":"storage","label":"dense·hash chunk·octree·압축 block"}],[{"id":"static","label":"정적 재질·고체"},{"id":"dynamic","label":"동적 overlay·객체별 점유"}],[{"id":"profile","label":"agent profile·clearance·현재 version"}],[{"id":"query","label":"충돌·시야·이동성별 결과"}]],"edges":[{"from":"storage","to":"static","label":"원본 decode"},{"from":"static","to":"profile","label":"물리 조건"},{"from":"dynamic","to":"profile","label":"독립 contribution"},{"from":"profile","to":"query","label":"질의 의미 적용"}]}
```

hash에 청크가 없다는 사실은 로딩 중·영역 부재·명시적 빈 공간을 구분해야 합니다. 포맷 변환 실패도 empty로 반환하지 않습니다. 넓은 희소 공간이어도 active 영역의 무작위 query가 많으면 pointer/hash overhead가 dense보다 클 수 있습니다.

## Palette와 Bitmap의 정보 표현 차이

16³=4096 cell의 1-bit 점유 bitmap은 payload 512 bytes입니다. 4개 재질 palette의 2-bit index 배열은 1024 bytes에 palette metadata가 추가됩니다. bitmap만으로 네 재질을 표현할 수 없으므로 공정 비교는 같은 의미를 보존해야 합니다.

palette에 다섯 번째 재질을 추가하면 최소 index 폭이 2→3bit로 커져 전체 repack이 필요할 수 있습니다. 한 cell 수정이라고 항상 O(1)이 아닙니다. single-material block·palette·raw array 전환, 삭제 뒤 palette 정리, compression/decode·branch·cache·추가 복사 비용을 측정합니다.

## 새 Block 게시와 옛 Reader 수명 관리

새 block을 완성한 뒤 version을 붙여 게시해도, 진행 중인 ray/path reader는 잠시 옛 block을 계속 읽을 수 있으므로 그 수명이 끝날 때까지 옛 block을 유지합니다. 최대 reader 수명은 취소·완료·admission 정책으로 정할 값이지, 아직 살아 있는 참조를 강제로 free해도 된다는 뜻은 아닙니다. 저장 포맷 version과 terrain source version은 서로 다른 변경 축으로 기록합니다.

6/26 이웃 조회·임의 query·국소 수정·넓은 ray·복잡한 경계·load/unload·palette 폭 증가를 같은 데이터로 비교합니다. 저장 bytes·resident memory·update/query p99·streaming·retained old blocks를 봅니다. 이 노트는 표현 설계이며 실제 voxel 저장 엔진 benchmark 결과는 아닙니다.

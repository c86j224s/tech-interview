---
id: voxel-version-bundle
title: 청크 경계·Halo·파생 데이터의 Version Bundle
topic: 게임 서버
summary: 음수 좌표·unloaded/empty·질의 폭·이웃 무효화·halo sourceVersion을 관리하고 안전 overlay·호환 조합·원자 게시·stale job·reader 수명과 지연 SLO를 설명합니다.
questionIds: [voxel-chunk-boundaries, voxel-halo-version-consistency, voxel-derived-data-update, derived-data-version-lag-slo]
---

# 청크 경계·Halo·파생 데이터의 Version Bundle

복셀 서버에서 좌표 계산, 이웃 경계, 충돌·경로·시야 산출물은 서로 다른 수명의 데이터지만 같은 원본 변경에 의존합니다. 이 노트는 저장 경계와 물리 경계를 먼저 분리하고, sourceVersion을 따라 호환 bundle만 게시하는 방법과 오래된 reader를 안전하게 회수하는 방법을 설명합니다.

## 청크 경계의 저장 경계와 물리 경계 구분

검산 표를 만들 때 `x=-17,-16,-1,0,15,16`을 각각 floor division으로 계산하고 local이 항상 0..15인지 확인합니다. 그 다음 agent 반경 1의 query를 chunk 경계에 놓아 필요한 halo가 한 셀인지, ray 길이에 따라 여러 chunk인지 비교하면 저장 단위와 물리 질의 폭을 같은 것으로 가정하는 오류가 드러납니다.

chunk size C=16에서 world cell −1은 chunk −1·local15입니다. `chunk=floor(x/C)`, `local=x−chunk*C`로 local을 0..C−1에 둡니다. 양수만 시험하면 0 방향 나눗셈의 오류를 놓칩니다. 면·모서리·꼭짓점에서 이웃 chunk가 관련되고 footprint나 긴 ray는 더 넓은 영역을 요구합니다.

미로딩·로딩된 empty·실제 고체·알 수 없는 상태를 나눕니다. hash lookup miss를 무조건 empty로 반환하면 벽을 통과할 수 있습니다. collision은 보수 차단·path는 보류/명시 부분 결과·시야는 잠정 상태처럼 기능별 정책과 최대 대기를 정합니다.

## Halo 원본과 sourceVersion 기록

A가 B version 4의 경계를 복사하고 B가 version 5에서 벽을 추가하는 시간선을 기록하면 A의 halo 값만 봐서는 현재성을 알 수 없습니다. sourceChunk, sourceVersion, 포함 영역을 함께 저장하고 version 5 변경이 영향을 받는 halo를 dirty로 표시해야 하며, dirty를 empty로 해석하지 않는 기능별 정책이 필요합니다.

ghost cell/halo는 이웃 chunk를 매번 찾아가지 않도록 그 경계 영역을 복사해 둔 값입니다. A의 halo가 B version4를 복사한 뒤 B가 version5에서 벽을 만들면 A가 보는 경계는 낡으므로, halo마다 source chunk ID·sourceVersion·포함 영역을 저장합니다. B의 경계가 바뀔 때는 그 정보로 영향받는 이웃 halo와 파생 데이터를 찾아 invalidation을 전파합니다.

각 chunk의 version 숫자가 서로 같아야 한다는 뜻은 아닙니다. 요청이 요구하는 snapshot/의존 version 집합이 실제 원본과 맞는지 검사합니다. 불일치·미갱신을 empty로 위장하지 않고 보류·현재 source 재조회·보수 차단을 적용합니다. halo 폭은 고정 한 cell이 아니라 사용 query·agent radius·생성 dependency에 맞춥니다.

```diagram
{"title":"원본·Halo·파생 산출물을 같은 의존 Version으로 연결합니다","caption":"화살표는 생성 의존입니다. 필수 산출물의 허용 조합을 확인한 bundle만 게시하고 늦게 끝난 옛 job은 최신을 덮지 못합니다.","rows":[[{"id":"source","label":"원본 chunk·이웃 version 집합"}],[{"id":"halo","label":"halo sourceVersion·영향 영역"}],[{"id":"collision","label":"충돌·경로 산출물"},{"id":"visual","label":"시야·표시 산출물"}],[{"id":"bundle","label":"호환 bundle·원자 root 게시"}]],"edges":[{"from":"source","to":"halo","label":"경계 의존 복사"},{"from":"halo","to":"collision","label":"source/profiles"},{"from":"halo","to":"visual","label":"source/규칙"},{"from":"collision","to":"bundle","label":"필수 안전 검사"},{"from":"visual","to":"bundle","label":"허용 지연 검사"}]}
```

## 원본 변경과 파생 결과 완성의 사건 구분

게시 조건은 “배열 파일이 생겼다”가 아니라 필요한 source version 집합과 profile/rules가 맞는 모든 artifact가 준비됐다는 사실입니다. 예를 들어 collision은 새 벽을 반영했지만 visual mesh가 늦은 경우 화면만 옛 모습일 수 있으나, 새 path가 옛 collision과 맞지 않으면 권위 이동에 사용하지 않는 식으로 조합을 명시합니다.

source에 새 벽이 기록됐는데 collision artifact가 옛 version이면, collision이 그 벽을 보지 못해 이동이 통과할 수 있습니다. 그래서 각 artifact에 sourceVersion·생성 상태·profile/rules·영향 영역을 붙이고, 새 배열을 완성한 뒤 필요한 artifact들의 호환 조합을 확인합니다. 조건을 통과한 bundle에서만 pointer를 한 번 전환하고, 생성 중인 배열은 reader와 공유하지 않습니다.

| 조합·상황 | 가능한 정책 예 |
| --- | --- |
| 새 벽·옛 collision | 즉시 보수 overlay·진입 보류 |
| 새 collision·옛 장식 mesh | 화면만 제한적으로 허용 |
| 새 path·맞지 않는 collision | 권위 이동에 사용 금지 |
| 생성 중 source 재변경 | old 결과 폐기·최신 target coalesce |
| halo unknown | 경계 query 보류·재조회 |

허용 조합은 게임별로 명시해야 합니다. 모든 기능을 항상 동시에 최신으로 만들기 어렵다고 아무 조합이나 사용해도 되는 것은 아닙니다.

## 임시 안전층 지속 시간과 운영 목표

장애를 분류할 때 version 차이만 보지 말고 dirty age, overlay age, queue age를 함께 봅니다. source 변경이 잦은 chunk에서 오래된 job이 계속 완료된다면 최신 target으로 합치고 stale 결과 폐기 수를 올려야 하며, overlay가 오래 지속되면 안전성은 유지돼도 플레이 가능성이 SLO를 위반할 수 있습니다.

새 벽을 즉시 막는 overlay는 collision 누락을 줄이지만, 파생 결과가 늦게 갱신된 채 오래 남으면 길을 불필요하게 막습니다. 따라서 source 변경부터 필수 파생 결과를 게시하기까지의 지연, 가장 오래된 dirty 영역, 임시 overlay age, 재생성 queue, stale 결과 폐기 수, version 불일치 거절 수를 SLO(서비스 수준 목표)와 경보로 추적합니다. version 숫자의 차이는 변경 빈도가 다르면 경과 시간을 뜻하지 않으므로 age도 별도로 측정합니다.

계속 바뀌는 chunk는 최신 목표 하나로 job을 합치되 안전층을 먼저 갱신합니다. 한 늦은 job이 최신 root를 덮지 못하도록 현재 목표 version 조건을 검사합니다. 정확한 영향 범위를 모르면 더 넓은 invalidation으로 안전성을 우선합니다.

## Root 교체와 옛 Reader 수명

재현 실험은 reader가 옛 root를 pin한 상태에서 writer가 새 root를 게시하고, reader 종료 전 옛 메모리를 회수하려는 순서를 넣습니다. 예상 결과는 logical generation 검사만으로 회수를 허용하지 않고 reader 수명 계약이 끝난 뒤에만 reclamation하는 것입니다. 그렇지 않으면 stale 적용과 별개로 dangling pointer가 생깁니다.

ray/path 작업이 chunk를 읽는 동안에는 chunk를 pin하거나 immutable snapshot·참조계수·RCU처럼 reader 수명을 붙잡는 방법을 사용합니다. logical generation은 늦게 끝난 결과의 stale 적용을 막는 식별자이고, reclamation epoch는 reader가 끝난 뒤에만 메모리를 회수하도록 하는 별도 보호 계약이 필요합니다. generation 숫자만 비교해서는 이미 해제된 dangling pointer를 안전하게 만들 수 없습니다.

음수 좌표·모서리 이웃·경계 수정·load 중 ray·이웃 unload·연속 파괴/복원·job crash·동시 세 기능 query를 시험합니다. 이 노트는 version/수명 설계이며 실제 streaming voxel 엔진 실험 결과는 아닙니다.

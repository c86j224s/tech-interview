---
id: voxel-version-bundle
title: 청크 경계·Halo·파생 데이터의 Version Bundle
topic: 게임 서버
summary: 음수 좌표·unloaded/empty·질의 폭·이웃 무효화·halo sourceVersion을 관리하고 안전 overlay·호환 조합·원자 게시·stale job·reader 수명과 지연 SLO를 설명합니다.
questionIds: [voxel-chunk-boundaries, voxel-halo-version-consistency, voxel-derived-data-update, derived-data-version-lag-slo]
---

# 청크 경계·Halo·파생 데이터의 Version Bundle

## 청크 경계는 저장 경계이지 물리적 벽이나 빈 공간이 아닙니다

chunk size C=16에서 world cell −1은 chunk −1·local15입니다. `chunk=floor(x/C)`, `local=x−chunk*C`로 local을 0..C−1에 둡니다. 양수만 시험하면 0 방향 나눗셈의 오류를 놓칩니다. 면·모서리·꼭짓점에서 이웃 chunk가 관련되고 footprint나 긴 ray는 더 넓은 영역을 요구합니다.

미로딩·로딩된 empty·실제 고체·알 수 없는 상태를 나눕니다. hash lookup miss를 무조건 empty로 반환하면 벽을 통과할 수 있습니다. collision은 보수 차단·path는 보류/명시 부분 결과·시야는 잠정 상태처럼 기능별 정책과 최대 대기를 정합니다.

## Halo에도 어느 원본을 복사했는지 기록합니다

ghost cell은 이웃 query 비용을 줄이는 복사본입니다. A의 halo가 B version4를 복사했는데 B가 version5로 벽을 만들었다면 A의 경계 판정은 낡습니다. halo source chunk ID·sourceVersion·포함 영역을 기록하고 경계 변경을 이웃 halo와 파생 데이터 invalidation으로 전파합니다.

각 chunk의 version 숫자가 서로 같아야 한다는 뜻은 아닙니다. 요청이 요구하는 snapshot/의존 version 집합이 실제 원본과 맞는지 검사합니다. 불일치·미갱신을 empty로 위장하지 않고 보류·현재 source 재조회·보수 차단을 적용합니다. halo 폭은 고정 한 cell이 아니라 사용 query·agent radius·생성 dependency에 맞춥니다.

```diagram
{"title":"원본·Halo·파생 산출물을 같은 의존 Version으로 연결합니다","caption":"화살표는 생성 의존입니다. 필수 산출물의 허용 조합을 확인한 bundle만 게시하고 늦게 끝난 옛 job은 최신을 덮지 못합니다.","rows":[[{"id":"source","label":"원본 chunk·이웃 version 집합"}],[{"id":"halo","label":"halo sourceVersion·영향 영역"}],[{"id":"collision","label":"충돌·경로 산출물"},{"id":"visual","label":"시야·표시 산출물"}],[{"id":"bundle","label":"호환 bundle·원자 root 게시"}]],"edges":[{"from":"source","to":"halo","label":"경계 의존 복사"},{"from":"halo","to":"collision","label":"source/profiles"},{"from":"halo","to":"visual","label":"source/규칙"},{"from":"collision","to":"bundle","label":"필수 안전 검사"},{"from":"visual","to":"bundle","label":"허용 지연 검사"}]}
```

## 원본 변경과 세 파생 결과 완성은 다른 사건입니다

새 벽은 source에 있지만 collision은 옛 version이면 이동이 통과할 수 있습니다. 각 artifact에 sourceVersion·생성 상태·profile/rules·영향 영역을 둡니다. 완성된 새 배열을 만들고 필요한 호환 조합을 확인한 뒤 pointer를 한 번 전환합니다. 생성 중 배열을 공유하지 않습니다.

| 조합·상황 | 가능한 정책 예 |
| --- | --- |
| 새 벽·옛 collision | 즉시 보수 overlay·진입 보류 |
| 새 collision·옛 장식 mesh | 화면만 제한적으로 허용 |
| 새 path·맞지 않는 collision | 권위 이동에 사용 금지 |
| 생성 중 source 재변경 | old 결과 폐기·최신 target coalesce |
| halo unknown | 경계 query 보류·재조회 |

허용 조합은 게임별로 명시해야 합니다. 모든 기능을 항상 동시에 최신으로 만들기 어렵다고 아무 조합이나 사용해도 되는 것은 아닙니다.

## 임시 안전층의 지속 시간도 운영 목표입니다

새 벽을 즉시 막는 overlay는 안전하지만 오래 남으면 불필요하게 길을 막습니다. source→필수 파생 게시 지연·가장 오래된 dirty 영역·임시 overlay age·재생성 queue·stale 폐기·version 불일치 거절을 SLO/경보로 둡니다. version 숫자 차이는 변경 빈도가 다르면 시간을 대표하지 않으므로 age도 측정합니다.

계속 바뀌는 chunk는 최신 목표 하나로 job을 합치되 안전층을 먼저 갱신합니다. 한 늦은 job이 최신 root를 덮지 못하도록 현재 목표 version 조건을 검사합니다. 정확한 영향 범위를 모르면 더 넓은 invalidation으로 안전성을 우선합니다.

## Root 교체 뒤에도 옛 Reader는 살아 있습니다

ray/path 작업이 참조한 chunk를 pin하거나 immutable snapshot·참조계수·RCU 등 실제 lifetime 보호를 사용합니다. logical generation은 stale 적용을 막고 reclamation epoch 같은 구현은 별도의 보호 계약을 갖습니다. 숫자 비교만으로 dangling pointer를 안전하게 만들 수 없습니다.

음수 좌표·모서리 이웃·경계 수정·load 중 ray·이웃 unload·연속 파괴/복원·job crash·동시 세 기능 query를 시험합니다. 이 노트는 version/수명 설계이며 실제 streaming voxel 엔진 실험 결과는 아닙니다.

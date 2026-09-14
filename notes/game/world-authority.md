---
id: world-authority
title: 공간 Handoff의 권위 전환과 경계 전투
topic: 게임 서버
summary: 상태 복사·입력 drain·최종 delta·내구 cutover·router cache를 나누고 저장 지점 epoch·실패 복구·보류 입력·교차 전투 snapshot/단일 효과 owner를 설명합니다.
questionIds: [world-partition-handoff, cross-boundary-combat-authority]
---

# 공간 Handoff의 권위 전환과 경계 전투

## 복사본이 생겼다고 새 Owner가 된 것은 아닙니다

character를 server A에서 B로 복사한 뒤 둘 다 공격·보상을 처리하면 중복 효과가 생깁니다. handoff ID·단조 owner epoch를 발급하고 상태 준비와 권위 전환을 구분합니다. 관찰 replica는 근처 상태를 볼 수 있어도 권위 쓰기 경로가 아닙니다.

## 마지막 입력과 Delta 뒤에 전환점을 둡니다

| 단계 | 보존할 사실 |
| --- | --- |
| 준비 | B의 snapshot·예정 epoch g+1 |
| 유입 정리 | A의 신규 입력 차단·처리 중 drain |
| 최종 반영 | 마지막 delta·lastAppliedInput·event 위치 |
| 권위 commit | 내구 owner B,g+1·handoff state |
| routing | router의 새 owner/epoch·stale cache 처리 |
| 완료 | old 접근 정리·보류 입력·대사 |

전환 중 짧게 입력을 보류하면 단순합니다. 무중단이 필요하면 bounded buffer에 handoff ID·sequence로 저장하고 마지막 적용 prefix 뒤의 입력만 한 번 처리합니다. ACK가 유실돼도 같은 handoff 상태를 조회해 재개해야 합니다.

```diagram
{"title":"최종 상태 반영과 내구 권위 Commit을 분리합니다","caption":"화살표는 handoff 단계입니다. B 준비 응답만으로 authority를 바꾸지 않고 실제 저장 지점이 새 epoch만 허용하도록 합니다.","rows":[[{"id":"a","label":"A · 현재 owner g"}],[{"id":"prepare","label":"B 준비 · snapshot g+1 후보"}],[{"id":"drain","label":"A drain·마지막 delta/input"}],[{"id":"commit","label":"내구 cutover · owner B,g+1"}],[{"id":"route","label":"새 routing·옛 epoch 쓰기 거절"}]],"edges":[{"from":"a","to":"prepare","label":"상태 복사"},{"from":"prepare","to":"drain","label":"준비 확인"},{"from":"drain","to":"commit","label":"최종 반영 확인"},{"from":"commit","to":"route","label":"권위 전환점"}]}
```

## Fencing은 Router의 믿음이 아니라 저장 경계입니다

A가 “아직 owner”를 확인한 뒤 멈췄다가 cutover 후 쓰면 사전 조회만으로 막지 못합니다. 실제 state/event/보상 저장이 expected epoch를 원자 검사해야 합니다. router cache에는 owner와 epoch를 같이 저장하고 mismatch면 재조회합니다. stable account/character와 권리 key를 유지해 handoff마다 보상을 새로 만들지 않습니다.

cutover 전 B 실패면 A 유지 또는 조정자 재개 정책을, cutover 후 실패면 이미 바뀐 권위를 기준으로 복구를 정합니다. A가 drain 중 죽었다면 기록된 prefix·원장으로 미확인 입력을 찾아 재전달하되 dedup합니다. 단순 timeout을 근거로 양쪽을 owner로 살리지 않습니다.

## 경계 양쪽 전투는 한 캐릭터 Owner만 정해도 끝나지 않습니다

A server의 공격자와 B server의 대상이 서로 다른 현재 snapshot을 읽고 각각 피해를 확정하면 중복·모순입니다. 공격 ID·기준 tick·양쪽 state/history snapshot·handoff epoch와 피해 확정 owner를 정합니다. 공유 판정 영역이나 읽기 snapshot 조합을 쓰더라도 피해/보상 효과는 하나의 권위 경로에서만 생성합니다.

지연된 공격은 기록된 tick/rewind 정책으로 검증하고 현재 대상 세대·상태에 적용합니다. 관찰 replica가 damage를 직접 쓰거나 과거 hitbox snapshot의 체력을 현재 state에 덮지 않습니다. 같은 공격 재전달과 다른 접촉을 안정 ID로 구분합니다.

## 경계 Hysteresis는 권위 중복 허가가 아닙니다

경계 왕복 때 매틱 이동을 줄이기 위해 완충 구간·최소 유지 시간을 둘 수 있습니다. 폭이 커지면 한 server 부하와 관찰 범위도 커져 입력 보류·handoff 반복률·p99를 비교합니다. 언제나 유효 writer는 계약된 하나여야 합니다.

준비/ACK 전후 crash·늦은 delta·옛 router·경계 전투·접속 종료·보상 event·옛 epoch 쓰기를 시험합니다. 이 노트는 권위 이전 설계이며 실제 분산 게임 server handoff를 실행한 결과는 아닙니다.

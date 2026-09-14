---
id: continuous-contact
title: 연속 충돌·TOI·수치 여유와 관통 순서
topic: 게임 서버
summary: endpoint tunneling·점/부피 sweep·상대 운동·보수 broad phase를 설명하고 최초 접촉·남은 시간·동점·시작 내부·반복 상한·사건 dedup을 구분합니다.
questionIds: [continuous-collision, collision-toi-numerical-margin, piercing-projectile-contact-order]
---

# 연속 충돌·TOI·수치 여유와 관통 순서

## 두 끝점이 벽 밖이어도 그 사이에 벽이 있습니다

점 투사체가 x=0에서 x=10으로 한 tick에 움직이고 벽이 [4,5]에 있으면 끝점 overlap은 둘 다 false입니다. 이동 구간을 보지 않아 생기는 **tunneling**입니다. tick을 올려도 최대 속도·최소 벽 두께에 대한 보장이 없으면 완전히 사라지지 않습니다.

점에 가까운 투사체는 ray/segment를, 반경 있는 구·캡슐·박스는 shape sweep을 사용합니다. 중심선만 검사하면 옆 벽에 닿는 몸체를 놓칩니다. 선형 병진의 swept AABB로 보수 후보를 찾고 narrow phase에서 실제 최초 충돌 시점 TOI를 계산합니다. 회전/곡선은 중간 형상을 포함한 별도 bound가 필요합니다.

## TOI는 같은 시간 매개변수에서 비교합니다

위 점 예시의 정적 벽 진입은 정규화 구간 t∈[0,1]에서 t=0.4입니다. 반경 r=0.5인 원/구를 적절한 축 방향 벽과 검사하면 중심이 x=3.5에서 접촉하므로 t=0.35입니다. 이는 단순 평면 접촉 예이며 일반 모서리는 정확한 Minkowski/shape 검사가 필요합니다.

대상도 움직이면 상대 위치·상대 속도와 양쪽 형상·기준 시각을 사용합니다. 현재 투사체와 옛 대상 등 서로 다른 tick을 무심코 섞지 않습니다. 시작부터 내부면 새 진입과 달라서 depenetration·마지막 안전 위치·소멸 같은 정책을 적용합니다.

```diagram
{"title":"첫 접촉 뒤 남은 시간만 다시 검사합니다","caption":"화살표는 한 tick 안의 순차 처리입니다. 모든 TOI를 동일 기준에 연결하고 반복 상한에서 명시적인 안전 결과를 반환합니다.","rows":[[{"id":"sweep","label":"권위 시작 상태·전체 이동 sweep"}],[{"id":"toi","label":"최초 TOI·안정 동점 선택"}],[{"id":"contact","label":"정지·반사·관통·피해 사건"}],[{"id":"remaining","label":"남은 시간·갱신된 상태 재검사"}],[{"id":"end","label":"종료 또는 반복 상한의 안전 처리"}]],"edges":[{"from":"sweep","to":"toi","label":"보수 후보→정밀 판정"},{"from":"toi","to":"contact","label":"접촉 규칙"},{"from":"contact","to":"remaining","label":"시간·속도 갱신"},{"from":"remaining","to":"end","label":"진행량·횟수 제한"}]}
```

## 접촉 여유는 단위와 크기에 맞아야 합니다

수치 오차로 계산 위치가 표면 안쪽일 수 있어 마지막 확인된 안전 위치·보수 TOI·법선 방향 여유를 사용할 수 있습니다. 큰 임의 epsilon은 작은 틈을 막거나 물체를 밀어내 게임 규칙을 바꿉니다. world 단위·형상 크기·속도·정밀도에 맞춰 오차 bound와 접촉 등호를 정의합니다.

접촉 직후 t≈0의 같은 표면이 계속 나오면 수치 재접촉을 새 피해로 무한 처리하지 않습니다. 최소 시간/공간 진행·최대 iteration·접촉 manifold/대상 정책을 두고 상한에서는 안전 정지·소멸 등 명시 결과를 반환합니다. 예산 종료를 충돌 없음으로 처리하지 않습니다.

## 관통의 두 번째 유효 피해를 Dedup으로 지우지 않습니다

한 tick에 대상 A(t=.2),B(t=.6)를 만나면 TOI 순으로 처리하고 관통/반사 후 남은 경로를 다시 계산합니다. 같은 TOI의 동점은 안정 대상 ID 등으로 고정합니다. 동일 target 재접촉을 허용할지는 공격 규칙입니다.

| 식별 | 역할 |
| --- | --- |
| projectile ID+generation | 재사용된 투사체 구분 |
| 기준 tick·contact ordinal | 한 tick의 여러 사건 구분 |
| target ID+generation | 대상 재생성 구분 |
| event ID | 같은 사건 재전달 제거 |

projectile+tick만 dedup key로 쓰면 B의 유효 피해도 사라질 수 있습니다. tick 경계 접촉은 반열린 구간 등 일관된 귀속이나 안정 event ID로 두 번 세지 않게 합니다. 최종 위치·충돌 시각은 client 시각 효과와 구분해 보냅니다.

## 끝점 검사와 정밀 기준을 대조합니다

얇은 벽·고속·낮은 tick·움직이는 대상·평행/모서리·시작 내부·연속 반사·관통·t=0/1을 시험합니다. miss·중복 효과·반복 상한·CPU를 함께 봅니다. 이 노트는 충돌 설계이며 실제 물리 엔진의 수치 강건성을 시험한 결과는 아닙니다.

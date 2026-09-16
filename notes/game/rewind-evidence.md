---
id: rewind-evidence
title: Rewind 판정의 시각·Hitbox 이력·공정성
topic: 게임 서버
summary: 서버 관측 입력 시각과 rewind 상한·tick/보간 상태·장애물 시간 일치·history 압축 오차·현재 효과 한 번 적용·공격자/피격자 trade-off를 설명합니다.
questionIds: [lag-compensation-rewind, rewind-tick-interpolation-evidence, rewind-window-abuse-limits, hitbox-history-compression]
---

# Rewind 판정의 시각·Hitbox 이력·공정성

## 공격자가 본 대상과 현재 서버 대상은 다를 수 있습니다

입력이 도착할 때 대상은 이미 이동했지만 공격자 화면에서는 조준점 안에 있었을 수 있습니다. 서버가 인정한 과거 시점의 hitbox history로 판정하면 불일치를 줄일 수 있습니다. 그러나 client timestamp를 무제한 허용하면 임의의 유리한 과거를 고를 수 있습니다.

발사가 늦게 도착하면 서버는 수신 시각을 기준으로 RTT/jitter 관측값, input sequence와 session, 발사 빈도, 입력의 허용 연령을 함께 보고 과거 판정 시각을 계산합니다. RTT/2는 경로가 비대칭이면 정확한 one-way delay가 아니므로, 그 추정값과 별도로 되돌아갈 수 있는 hard rewind window를 제한합니다. 미래 timestamp가 오거나 값이 갑자기 변하거나 같은 상한에 반복해서 닿으면 그 시도를 기록하고 거절하거나 허용 범위 끝으로 절단합니다.

## 실제 Tick과 보간은 다른 종류의 근거입니다

| 방식 | 이점 | 주의점 |
| --- | --- | --- |
| 저장 tick state | 확정된 sample·재현 용이 | sample 간 시간 오차 |
| 두 sample 보간 | 화면 시점에 가까울 수 있음 | 중간 state가 실제 유효하다는 보장 없음 |
| 변화 event+sample | teleport·shape 전환 보존 | 재구성·version 관리 |

teleport 직전 sample과 직후 sample을 직선으로 섞으면 두 위치 사이를 실제로 지나지 않았는데도 벽 안에 있는 중간 state를 만들 수 있습니다. 그래서 문 개폐나 stance/hitbox profile 전환처럼 상태가 끊기는 지점은 연속 이동 보간에 넣지 않고, 저장된 sample/event 경계에서 나눠 읽습니다. 어떤 경우에 보간할지와 허용 오차(tolerance)·불연속(discontinuity)을 정하고 같은 입력·policy version으로 다시 계산합니다.

## 대상뿐 아니라 관련 장애물의 시간도 맞춥니다

캐릭터의 hitbox만 과거로 돌리고 문을 현재 상태로 읽으면, 당시에는 닫혀 있던 엄폐물이 지금은 열린 것처럼 판정될 수 있습니다. 따라서 attack 유형마다 공격자·대상·문/벽·투사체 궤적을 같은 기준 시각에서 읽을지 정하고, hitscan(발사 순간 한 번 계산하는 공격)과 시간에 걸쳐 움직이는 projectile을 분리합니다. 후자를 한 번의 ray로 바꾸면 비행 중 경로와 장애물 접촉을 같은 방식으로 재현할 수 없기 때문입니다.

```diagram
{"title":"과거 이력을 읽고 현재 권위 경로에 효과를 적용합니다","caption":"화살표는 판정과 효과입니다. 현재 world를 과거 값으로 덮어쓰지 않고 읽기 전용 snapshot으로 판정한 뒤 실제 체력·자원은 현재 owner가 한 번만 갱신합니다.","rows":[[{"id":"input","label":"발사 input·수신·허용 시각 검사"}],[{"id":"history","label":"동일 기준의 hitbox·장애물 history"}],[{"id":"judge","label":"tick/보간 정책·판정 snapshot ID"}],[{"id":"effect","label":"현재 owner · 공격 ID로 효과 확정"}]],"edges":[{"from":"input","to":"history","label":"bounded rewind"},{"from":"history","to":"judge","label":"읽기 전용 근거"},{"from":"judge","to":"effect","label":"과거 state 저장 금지"}]}
```

결과가 명중이어도 현재 체력·탄약·보상은 stable 공격 ID와 현재 owner/state 조건으로 한 번만 변경합니다. 판정 snapshot ID는 증거이고 같은 공격을 새 snapshot마다 다시 적용할 권리 key가 아닙니다.

## History 압축은 저장량과 판정 오차를 함께 바꿉니다

대상 N·보관 T초·sample f/s·sample bytes b라면 대략 N*T*f*b에 index/metadata가 추가됩니다. 예를 들어 1000×0.2×60×64는 768000 bytes의 단순 payload 근사입니다. 실제 hitbox 수·정렬·delta/base·allocator 비용은 별도입니다.

빠르게 움직이는 대상에서 sample 간격 Δt가 크면 두 sample 사이 위치를 거칠게 추정하게 됩니다. 회전·가속·teleport는 단순 속도 bound만으로 오차를 충분히 나타내지 못할 수 있으므로, 느린 대상과 같은 압축률을 강제하지 않고 profile·상태 전환 event·source version·base snapshot을 함께 보존합니다. quantization·delta compression으로 복원한 history의 오차와 조회 CPU를 측정하고, 원래 history로 낸 명중 결과와 대조합니다.

보관 밖 시각은 그럴듯하게 외삽하지 않고 거절·가장 오래된 허용 시각 등 명시 정책으로 처리합니다. 이력 제거는 진행 reader의 참조 수명을 고려합니다.

## 공격자 이득과 피격자의 엄폐 경험을 같이 봅니다

rewind를 늘리면 공격자 화면과 맞아도 피격자는 이미 숨었는데 맞는다고 느낄 수 있습니다. 공격 종류별 window·엄폐 시간 일관성·정상 고지연 영향·상한에 걸린 공격·엄폐 후 피격 비율을 함께 봅니다. 모든 화면을 동시에 정확히 만족시킨다는 보장이 아닙니다.

RTT/jitter·재전송·미래/과거 입력·moving wall·teleport·빠른 hitbox·압축·상한 경계를 시험합니다. 현재 world가 판정 중 오염되지 않는지와 같은 로그의 결과를 확인합니다. 이 노트는 rewind 설계이며 실제 게임 피격 공정성 실험 결과는 아닙니다.

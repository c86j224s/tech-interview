---
id: input-authority
title: 서버 입력 권위·Sequence Gap·예측 재적용
topic: 게임 서버
summary: 입력 의도와 확정 위치/피해를 구분하고 세션/엔티티 세대·형식/빈도/규칙 검증·명령과 최신 상태 gap·서버 Ack 이후 replay·시각 보정을 설명합니다.
questionIds: [authoritative-server-input, game-input-sequence-gap, client-prediction-input-replay]
---

# 서버 입력 권위·Sequence Gap·예측 재적용

## Client는 의도를 보내고 Server는 결과를 확정합니다

이동 방향·버튼·조준·대상·입력 번호는 client의 주장으로 받습니다. 최종 위치·피해 100·처치 여부를 그대로 저장하지 않습니다. session/character 권한·형식·입력 빈도·sequence를 먼저 검사하고 서버의 직전 상태·dt·속도·충돌·지형으로 허용 이동을 계산합니다.

공격은 현재 상태·cooldown·탄약/자원·거리·시야·팀·대상 generation을 검사합니다. 단순 이동 거리 threshold만으로 벽 통과·누적 speed·teleport를 모두 막지 못합니다. 비싼 ray/충돌은 유효한 입력과 budget 안에서 수행해 정상 형식의 고비용 요청도 제한합니다.

| 입력 정보 | 권위 검사 |
| --- | --- |
| 접속/캐릭터 ID | 인증 주체·현재 generation |
| sequence·시각 | 중복·gap·연령·허용 tick |
| 방향·조준 | 범위·유한 값·게임 제약 |
| 이동 결과 주장 | 서버 물리로 재계산 |
| 피해·자원 결과 주장 | 서버 전투·원장으로 확정 |

## Gap은 입력 의미에 따라 다르게 처리합니다

sequence 10 뒤에 12가 도착해도 11을 영원히 기다리지 말고, gap을 명령의 종류에 따라 해석합니다. item 사용·공격처럼 한 번의 실행이 의미인 명령은 누락과 중복을 ACK/retry 계약으로 처리하고, 최신 방향 상태는 정한 정책에 따라 중간 sample을 대체할 수 있습니다. 반대로 이동 입력의 duration이나 edge-trigger 버튼은 중간 값을 임의로 버리면 실행 의미가 달라지므로 같은 방식으로 생략하면 안 됩니다.

gap wait 시간·버퍼 수/bytes·허용 미래 번호·sequence wrap/session generation을 정합니다. 상한 밖이면 현재 snapshot과 마지막 확정 입력으로 resync하고 누락 명령을 성공처럼 표시하지 않습니다. 너무 오래된 입력·pause 중 입력의 tick 귀속도 공정한 서버 정책으로 기록합니다.

## 예측은 확정 상태 이후 입력만 다시 적용합니다

client가 101·102·103을 예측한 뒤 server가 101까지 적용한 상태 `S101`을 보내면, client는 먼저 예측 상태를 `S101`로 되돌리고 아직 확정되지 않은 102·103만 순서대로 재시뮬레이션합니다. 확정 prefix인 101을 다시 실행하면 이동이나 탄약 처리가 중복될 수 있기 때문입니다. 이미 재생한 발사 sound 같은 presentation 효과는 판정용 입력 replay와 분리해 다시 재생되지 않게 합니다.

```diagram
{"title":"확정 입력까지 버리고 남은 입력만 재적용합니다","caption":"화살표는 reconciliation 흐름입니다. 시각 보간은 사용자 표시를 부드럽게 할 수 있지만 서버 권위 충돌·자원 결과를 임의로 바꾸지 않습니다.","rows":[[{"id":"predict","label":"client 예측 · 101·102·103"}],[{"id":"ack","label":"server · S101·lastApplied101"}],[{"id":"replay","label":"S101에서 102·103만 replay"}],[{"id":"display","label":"현재 예측 상태·별도 시각 보정"}]],"edges":[{"from":"predict","to":"ack","label":"입력 송신·서버 확정"},{"from":"ack","to":"replay","label":"확정 prefix 제거"},{"from":"replay","to":"display","label":"표현과 판정 분리"}]}
```

## 공유할 규칙과 남는 오차를 명시합니다

server/client의 dt·충돌 shape·corner 규칙·profile·지형 version·난수 전제를 맞춥니다. 코드 공유도 플랫폼 부동소수점·실행 순서를 자동 일치시키지는 않습니다. 차이는 권위 상태로 보정하고 visual smoothing은 표시만 조절합니다. 보정 허용 폭을 치팅 허가 범위와 혼동하지 않습니다.

server 결과에는 기준 tick·마지막 적용 input·state version·필요한 reason code를 넣습니다. 내부 비밀 판정 자료를 과도하게 노출하지 않으면서 형식·권한·순서·규칙 오류를 구분해 진단합니다. 옛 session packet은 새 character generation에 적용되지 않아야 합니다.

## 고지연과 악성 입력을 같은 로그로 단정하지 않습니다

정상 RTT/jitter·중복·재정렬·gap·오래된 입력·비유한 숫자·비정상 속도·사거리 밖 공격·재접속을 시험합니다. 실제 input 원장·최종 위치·자원 증분·correction 분포·검증 CPU를 비교합니다. 이 노트는 권위 입력 설계이며 실제 게임 client/server를 실행한 결과는 아닙니다.

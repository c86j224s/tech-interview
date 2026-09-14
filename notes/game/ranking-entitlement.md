---
id: ranking-entitlement
title: 랭킹 Cutoff·봉인 Snapshot·보상 정정 원장
topic: 게임 서버
summary: 발생/수신 시각·허용 지연·샤드 watermark·규칙 version·잠정/확정 순위를 나누고 안정 권리 key·지급 응답 유실·별도 adjustment·사용 후 회수를 설명합니다.
questionIds: [ranking-cutoff-rewards, ranking-reward-adjustment-ledger]
---

# 랭킹 Cutoff·봉인 Snapshot·보상 정정 원장

## 화면 순위가 계속 바뀌어도 보상 입력은 봉인해야 합니다

시즌7의 점수를 발생 시각 기준으로 인정하고 마감 뒤 30초까지 받는다고 가정합니다. 그 창 안의 검증된 event와 이후 도착의 폐기/정정 대기 정책을 정합니다. client timestamp만으로 시즌 귀속을 허용하지 않고 server의 검증 가능한 tick·sequence·이벤트 근거를 사용합니다.

서버마다 “현재 12시”를 보는 것만으로 모든 shard가 같은 입력을 처리한 것은 아닙니다. shard별 마지막 처리 위치·watermark·dedup·부정 검증 상태·규칙 version을 확인하고 `season7,cutoffVersion184` 같은 봉인판을 만듭니다. 한 shard가 실패하면 자동 확정하지 않고 미완료 집계로 재개합니다.

## 잠정 순위와 확정 순위의 의미를 분리합니다

| 정보 | 역할 |
| --- | --- |
| 발생 시각·권위 tick | 어느 시즌의 유효 event인지 |
| 수신 시각 | 허용 지연 창 안인지 |
| 처리 위치·watermark | 입력 반영·누락 확인 |
| 규칙 version·동점 key | 같은 순위/보상 계산 |
| cutoff snapshot ID | 지급 판단의 고정 근거 |
| 권리 key | 같은 보상을 한 번 적용 |

동점은 score 외 안정 보조 key 또는 계약된 공동 순위 정책을 적용합니다. Top-K 표시와 보상 대상 산출이 같은 규칙을 읽어야 합니다. 잠정·마감 대기·확정·정정 상태를 사용자에게 구분합니다.

```diagram
{"title":"봉인된 순위에서 권리를 만들고 정정은 별도로 남깁니다","caption":"화살표는 계산과 지급 수명입니다. cutoff version은 근거이며 새 계산판마다 같은 권리를 새로 지급하는 키로 사용하지 않습니다.","rows":[[{"id":"events","label":"검증된 시즌 event·모든 shard 위치"}],[{"id":"cutoff","label":"규칙 고정·봉인 cutoff snapshot"}],[{"id":"entitlement","label":"account·season·rewardType 권리"}],[{"id":"grant","label":"실제 지급·내구 원장·결과 조회"}],[{"id":"adjust","label":"별도 adjustment ID·회수/차액"}]],"edges":[{"from":"events","to":"cutoff","label":"허용 지연 종료 확인"},{"from":"cutoff","to":"entitlement","label":"재현 가능한 대상"},{"from":"entitlement","to":"grant","label":"안정 멱등 key"},{"from":"grant","to":"adjust","label":"새 정정 사건"}]}
```

## 지급 응답을 잃어도 같은 권리 Key를 유지합니다

규칙상 한 번의 시즌 보상이라면 accountId·seasonId·rewardType 등으로 권리를 식별합니다. cutoff version은 왜 지급했는지의 metadata이지 정상 retry마다 다른 권리로 만드는 요소가 아닙니다. 실제 지급 성공 후 완료 표시 전에 죽으면 같은 key로 조회·멱등 재요청해야 합니다.

권리 원장과 잔액 변경이 같은 DB면 가능한 같은 transaction으로 묶고 event는 outbox로 연결할 수 있습니다. 다른 시스템이면 한쪽 성공/실패·dedup 보관 기간·외부 조회·대사를 명시합니다. provider가 멱등/조회를 지원하지 않으면 그 한계를 숨기지 않습니다.

## 부정 점수 정정은 과거 성공을 삭제하지 않습니다

원래 보상100에서 정정 후60이면 새 adjustment ID로 −40을 기록할 수 있습니다. 이미 80을 썼다면 단순 과거 snapshot 복원으로 정상 지출을 없애면 안 됩니다. 회수 가능 자산·차액·부채·다음 시즌 조정 등은 게임/운영 정책과 승인·안내에 따라 정합니다.

원래 권리·근거 cutoff·정정 이유·주체·새 계산판·적용 결과를 연결하고 adjustment 재전달은 한 번만 반영합니다. 같은 보상을 새 version마다 다시 지급하는 방식으로 정정하지 않습니다. 회수·외부 지급·원장 사이 부분 실패도 재개/대사합니다.

## 마감과 지급의 실패 경계를 시험합니다

마감 직전/직후·30초 경계·중복 점수·동점·샤드 실패·늦은 부정 판정·지급 응답 유실·사용 후 회수·중복 adjustment를 검사합니다. 동일 봉인판 재계산의 대상·권리·실제 지급이 일치하는지 봅니다. 이 노트는 보상 설계이며 실제 사용자 보상을 지급·회수한 결과는 아닙니다.

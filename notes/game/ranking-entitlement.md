---
id: ranking-entitlement
title: 랭킹 Cutoff·봉인 Snapshot·보상 정정 원장
topic: 게임 서버
summary: 발생/수신 시각·허용 지연·샤드 watermark·규칙 version·잠정/확정 순위를 나누고 안정 권리 key·지급 응답 유실·별도 adjustment·사용 후 회수를 설명합니다.
questionIds: [ranking-cutoff-rewards, ranking-reward-adjustment-ledger]
---

# 랭킹 Cutoff·봉인 Snapshot·보상 정정 원장

랭킹 보상은 화면에 보이는 현재 순위를 복사하는 일이 아니라, 허용된 event 집합을 규칙 버전과 cutoff으로 봉인하고 그 결과에서 계정별 권리를 한 번 만든 뒤 실제 지급을 대사하는 과정입니다. 잠정 순위와 확정 권리를 분리해야 늦은 event나 부정 정정이 과거 지급을 조용히 다시 쓰지 않습니다.

## 화면 순위 변동과 보상 입력 봉인

시즌7 점수는 event가 발생한 시각으로 귀속하고, 마감 뒤에는 30초 동안 도착한 event까지 받는다고 가정합니다. 운영 중에는 event의 발생 시각과 수신 시각을 각각 기록한 다음, 30초 창 안에 도착했고 검증된 event는 집계하고 그 뒤 도착한 event는 폐기할지 정정 대기로 둘지 결정합니다. client timestamp만으로 시즌 귀속을 정하지 않고, server가 확인할 수 있는 tick·sequence·이벤트 근거를 함께 읽습니다.

각 서버가 현재 시각 12시를 가리켜도 모든 shard가 같은 event까지 처리했다는 뜻은 아닙니다. shard별 마지막 처리 위치와 watermark(입력의 시간 진행을 추정하는 표시이며, 그 이후 늦은 사건이 절대 없다는 증명은 아님), 중복 제거(dedup) 상태, 부정 검증 상태, 규칙 version을 모아 `season7,cutoffVersion184` 같은 봉인판을 만든 뒤에만 확정합니다. 한 shard라도 실패하면 자동 확정하지 않고 미완료 집계로 남겨 재개합니다.
예를 들어 shard A의 watermark는 cutoff까지 도달했지만 shard B가 아직 처리 중이면 화면에 Top-K를 표시할 수 있어도 지급 snapshot은 봉인하지 않습니다. 봉인 후 provider 응답이 유실되면 새 cutoff version을 만들어 다시 지급하지 않고 기존 `account·season·rewardType` key의 상태 조회를 반복합니다. 정정이 발생하면 원래 권리와 연결된 별도 adjustment를 만들어 이미 사용된 보상과 대사합니다.

## 잠정 순위와 확정 순위의 의미 분리

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

## 지급 응답 유실과 권리 Key 유지

시즌 보상을 계정에 한 번만 주는 규칙이라면 `accountId·seasonId·rewardType` 등을 묶어 하나의 권리 key로 삼습니다. cutoff version은 왜 이 권리를 만들었는지를 설명하는 metadata일 뿐, 정상적인 retry마다 새 권리를 만드는 값은 아닙니다. 지급 provider가 성공 응답을 보냈지만 우리 쪽 완료 표시 전에 작업이 중단되면, 새 key를 만들지 말고 같은 key로 지급 상태를 조회한 뒤 멱등 재요청(반복해도 한 번만 반영되도록 한 재요청)을 합니다.

권리 원장과 잔액 변경이 같은 DB면 가능한 같은 transaction으로 묶고 event는 outbox로 연결할 수 있습니다. 다른 시스템이면 한쪽 성공/실패·dedup 보관 기간·외부 조회·대사를 명시합니다. provider가 멱등/조회를 지원하지 않으면 그 한계를 숨기지 않습니다.

## 부정 점수 정정과 과거 성공 보존

원래 보상100에서 정정 후60이면 새 adjustment ID로 −40을 기록할 수 있습니다. 이미 80을 썼다면 단순 과거 snapshot 복원으로 정상 지출을 없애면 안 됩니다. 회수 가능 자산·차액·부채·다음 시즌 조정 등은 게임/운영 정책과 승인·안내에 따라 정합니다.

정정할 때는 원래 권리와 근거 cutoff, 정정 이유와 주체, 새 계산판, 실제 적용 결과를 하나의 기록으로 연결합니다. 같은 adjustment가 다시 전달되어도 adjustment ID의 처리 기록과 실제 변경을 원자적으로 묶어 한 번만 적용하고, 새 version이 생겼다는 이유로 같은 보상을 다시 지급하지 않습니다. 회수·외부 지급·원장 중 일부만 성공한 부분 실패는 남은 작업을 재개하고 세 영역의 기록을 대사(서로 맞춰 확인)합니다.

## 마감·지급 실패 경계 시험

마감 직전/직후·30초 경계·중복 점수·동점·샤드 실패·늦은 부정 판정·지급 응답 유실·사용 후 회수·중복 adjustment를 검사합니다. 동일 봉인판 재계산의 대상·권리·실제 지급이 일치하는지 봅니다. 이 노트는 보상 설계이며 실제 사용자 보상을 지급·회수한 결과는 아닙니다.

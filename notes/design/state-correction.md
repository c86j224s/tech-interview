---
id: state-correction
title: 상태 전이 Guard·불확정 효과·정정 원장
topic: 설계
summary: enum·version·논리 작업 ID를 나누고 조건부 전이·외부 호출 의도·lease 세대·늦은 완료·종결 뒤 새 정정과 운영자 감사 경로를 설명합니다.
questionIds: [retry-safe-state-machine, terminal-state-correction-transition]
---

# 상태 전이 Guard·불확정 효과·정정 원장

## Enum은 가능한 이름이고 Guard는 가능한 변경입니다

PENDING·RUNNING·DONE을 만들었다고 두 요청이 동시에 PENDING을 읽고 외부 결제를 시작하지 못하는 것은 아닙니다. 현재 상태·사건·주체·금액·version·논리 작업 ID로 전이 guard를 정합니다. 배송 완료에서 일반 취소가 아니라 반품으로 가야 한다면 CANCELLED 값이 있다는 이유로 덮을 수 없습니다.

```sql
UPDATE orders
SET state = 'CANCELLED', version = version + 1
WHERE id = :id AND state = 'PENDING' AND version = :expected;
```

영향 행 0은 무조건 실패나 무조건 retry가 아닙니다. 최신 상태가 이미 같은 논리 요청으로 완료됐는지, 다른 요청과 충돌했는지, 금지 전이인지 조회합니다. version은 신선도, 작업 ID는 같은 의도의 반복을 식별하므로 서로 대체하지 않습니다.

## 외부 결과를 모르면 모른다는 상태를 둡니다

| 상태 구분 | 다음 행동 |
| --- | --- |
| 미실행·검증 거절 | 수정 또는 정상 거절 |
| 실행 의도 내구 기록 | 안정 key로 외부 호출 |
| 진행 중 | owner·기한·조회 |
| 성공 확인 | 원장·event·응답 기록 |
| 실패 확인 | 허용 retry/종결 |
| 결과 불확정 | 같은 key 조회·대사·멱등 재요청 |

외부 성공 후 로컬 기록 전에 죽으면 RUNNING만 남을 수 있습니다. 새 ID로 다시 결제하지 않고 원래 요청 ID·정규화 인자·결과 조회를 사용합니다. 상태를 더 만들었다는 사실만으로 복구가 되는 것이 아니라 각 상태의 owner·다음 행동·최대 체류·경보가 필요합니다.

```diagram
{"title":"확정 결과와 불확정 효과의 복구를 구분합니다","caption":"화살표는 허용 가능한 처리 흐름의 예입니다. timeout을 무조건 실패로 바꾸지 않고 조회·대사 뒤 새 사실을 기록합니다.","rows":[[{"id":"pending","label":"PENDING · 조건부 실행권"}],[{"id":"running","label":"RUNNING · 내구 의도·논리 key"}],[{"id":"known","label":"확인된 성공/실패"},{"id":"unknown","label":"불확정 · 조회·대사"}],[{"id":"correction","label":"필요 시 별도 정정 ID·원장"}]],"edges":[{"from":"pending","to":"running","label":"state/version guard"},{"from":"running","to":"known","label":"권위 결과 확인"},{"from":"running","to":"unknown","label":"응답 유실·중단"},{"from":"known","to":"correction","label":"새 정정 사건"},{"from":"unknown","to":"correction","label":"대사 후 필요한 보정"}]}
```

## 새 Owner는 옛 Worker의 늦은 쓰기를 제한합니다

lease로 작업을 회수할 때 generation을 올리고 완료 저장에 expected generation을 요구합니다. 옛 worker가 깨어나면 local 완료 기록은 거절할 수 있습니다. 하지만 이미 보낸 외부 결제는 이 검사로 취소되지 않아 외부 idempotency·조회·지원되는 fencing도 필요합니다. lease 만료는 process 종료 증거가 아닙니다.

## DONE을 PENDING으로 몰래 바꾸지 않습니다

정정·환불·재개는 기존 성공과 다른 새 사실입니다. 정정 ID·이유·주체·근거·선행 state/version을 가진 전이를 만들고 같은 정정을 한 번만 적용합니다. 이미 사용한 포인트나 외부 결제를 원래 snapshot으로 덮어쓰면 현재 거래를 잃거나 권리를 만들 수 있습니다. 조정 원장과 현재 조건을 검사합니다.

운영자 도구도 직접 enum 수정으로 guard를 우회하지 않고 동일한 명령·인가·감사 경로를 사용합니다. 상태와 알림 event를 함께 남겨야 하면 같은 transaction의 outbox/감사 기록으로 연결하고 전달 중복은 consumer에서 관리합니다.

## 금지 전이와 늦은 효과를 시험합니다

state×event 표의 금지 조합·동시 승인/취소·같은 작업 반복·외부 성공 후 crash·lease 인계·중복 정정·정정과 늦은 완료를 검사합니다. 오류 없음보다 실제 원장·불확정 체류·중복 결제 부재를 봅니다. 이 노트는 상태 설계이며 실제 외부 결제 API 실험 결과는 아닙니다.

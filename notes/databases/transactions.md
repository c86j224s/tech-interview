---
id: transactions
title: 트랜잭션과 동시 갱신의 실패
topic: 데이터베이스
summary: lost update·write skew를 실행 순서로 보고 잠금·버전·직렬화와 재시도를 연결합니다.
questionIds: [transaction-and-lost-update, db-mvcc-snapshot, db-isolation-write-skew, db-serializable-retry, db-select-for-update, db-optimistic-version-column, sqlserver-rcsi-snapshot, db-two-phase-commit]
---

# 트랜잭션과 동시 갱신의 실패

## 원자성과 격리는 다릅니다

transaction은 관련 변경을 commit 또는 rollback으로 묶는 원자 경계를 제공합니다. 그러나 두 transaction이 동시에 무엇을 읽고 어떤 충돌을 허용하는지는 격리 수준·엔진·질의에 달려 있습니다. 각각 transaction을 썼다는 이유만으로 모든 업무 규칙이 직렬 실행되는 것은 아닙니다.

## Lost update를 순서로 보기

초기 재고가 10일 때 A와 B가 각각 1을 차감한다고 하겠습니다.

| 단계 | A | B |
| --- | --- | --- |
| 1 | 재고 10 읽기 | |
| 2 | | 재고 10 읽기 |
| 3 | 계산한 9 저장 | |
| 4 | | 계산한 9 저장 |

최종 값은 9라서 차감 하나가 사라졌습니다. 두 연산을 짧은 조건부 갱신으로 표현하는 것이 한 대안입니다.

```sql
UPDATE inventory
SET remaining = remaining - 1,
    version = version + 1
WHERE id = :id
  AND remaining > 0;
```

`:id`는 설명용 바인딩 표기입니다. 실제 driver의 파라미터 API를 사용하고 영향 행 수를 확인합니다. 재고가 없거나 ID가 없거나 인가되지 않은 경우의 응답은 별도로 설계합니다. 이 문장은 요청 재시도 중 같은 판매를 두 번 차감하는 문제까지 해결하지는 않습니다.

## 낙관적 버전과 잠금 읽기

이미 읽은 version 7을 기반으로 문서를 저장하려면 `WHERE version=7`을 넣고 성공 시 8로 증가시킵니다. 충돌하면 새 값을 읽어 다시 계산하거나 사용자 병합을 요청합니다. version만 최신으로 바꿔 같은 옛 본문을 덮으면 보호를 우회합니다.

잠금 읽기는 `SELECT ... FOR UPDATE` 같은 기능으로 현재 행을 보호한 뒤 짧게 변경할 수 있습니다. 조회와 갱신이 같은 transaction에 있어야 합니다. 없는 행이나 범위 전체까지 보호되는지는 엔진·격리·인덱스에 따라 확인해야 합니다.

## Write skew는 다른 반례입니다

A·B 당직자가 모두 근무 중이고 ‘최소 한 명’이 필요합니다. 각 transaction이 다른 사람이 근무 중임을 읽고 자기 행만 퇴근으로 바꾸면 쓰기 행이 겹치지 않아도 두 명 모두 퇴근할 수 있습니다.

같은 행의 version만 보호해도 이 집합 조건은 남습니다. 공통 그룹 행을 잠그고 다시 검사하거나, 엔진의 직렬화 격리·제약·모델 변경으로 불변식을 보호합니다. MVCC는 읽기 버전을 고르는 방법이지 잠금·충돌·업무 규칙을 모두 없애는 기능이 아닙니다.

## 재시도 경계

직렬화 실패는 보통 transaction 전체를 새로 시작해 읽기·계산·쓰기를 다시 해야 합니다. 마지막 SQL만 실행하면 옛 분기를 재사용합니다. 재시도 횟수·deadline·지터를 제한합니다.

외부 결제·메일은 DB rollback에 포함되지 않습니다. transaction 재시도 안에 그대로 두면 중복될 수 있어 멱등 API·outbox·결과 조회와 연결합니다. commit 응답 유실은 미실행 증거가 아니므로 논리 요청 ID로 상태를 확인합니다.

## 실험 방법

두 세션의 읽기 직후에 barrier를 두고 쓰기 순서를 제어합니다. 최종 재고만 아니라 성공한 판매 수·원장·영향 행·오류 코드를 확인합니다. 엔진과 격리 설정, 인덱스, autocommit 여부를 기록합니다. 동일 이름의 격리 수준도 제품별 구현 차이를 확인해야 합니다.

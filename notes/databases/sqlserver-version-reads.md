---
id: sqlserver-version-reads
title: SQL Server RCSI·Snapshot·잠금 읽기의 시점
topic: 데이터베이스
summary: 문장과 거래 snapshot·설정·첫 접근을 구분하고 두 연결 SQL 순서·업데이트 충돌·UPDLOCK·버전 저장소 비용을 설명합니다.
questionIds: [sqlserver-rcsi-snapshot, sqlserver-updlock-version-read]
---

# SQL Server RCSI·Snapshot·잠금 읽기의 시점

## 동일 Transaction의 SELECT별 읽기 시점

RCSI는 READ_COMMITTED_SNAPSHOT 데이터베이스 옵션으로 READ COMMITTED의 일반 읽기에 행 버전을 사용하는 방식입니다. 보통 문장 시작의 커밋된 상태를 기준으로 하므로 같은 거래의 첫 SELECT와 두 번째 SELECT 사이 다른 세션의 commit을 볼 수 있습니다.

SNAPSHOT 격리를 쓰려면 데이터베이스에서 ALLOW_SNAPSHOT_ISOLATION을 허용하고 세션이 SNAPSHOT을 선택해야 하며, 한 거래가 읽기 기준으로 삼은 snapshot을 유지합니다. 다만 그 기준을 BEGIN의 벽시계 시각으로 단정하지 말고, 실제로는 첫 데이터 접근과 거래 명령 순서를 바꾸어 어느 시점의 커밋을 읽는지 확인해야 합니다. 같은 거래가 직접 쓴 값은 일반적으로 자기 읽기에서 보이므로, SNAPSHOT을 ‘항상 시작 당시 값만 보는 격리’라고 설명하면 자기 쓰기와 충돌 처리를 놓치게 됩니다.

## RCSI·SNAPSHOT·잠금 읽기의 동일 실행 순서 비교

아래는 별도로 준비한 테스트 DB에서 dbo.mvcc_demo(id=1,value=100)를 두고 실행하는 T-SQL 순서입니다. RCSI·SNAPSHOT 옵션 변경은 다른 세션에 영향을 줄 수 있어 운영 DB에 그대로 실행하지 않습니다. 이 노트는 옵션을 변경하지 않습니다.

```sql
-- 연결 A: 첫 실행은 RCSI가 켜진 DB의 READ COMMITTED
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
BEGIN TRANSACTION;
SELECT value FROM dbo.mvcc_demo WHERE id = 1; -- 100 기대
-- 여기서 멈추고 연결 B의 COMMIT 완료를 확인합니다.
```

```sql
-- 연결 B
BEGIN TRANSACTION;
UPDATE dbo.mvcc_demo SET value = 120 WHERE id = 1;
COMMIT;
```

```sql
-- 연결 A 재개
SELECT value FROM dbo.mvcc_demo WHERE id = 1; -- RCSI에서는 120 기대
ROLLBACK;
```

두 연결을 닫힌 상태로 정리하고 테스트값을 100으로 되돌린 뒤, A의 격리를 SNAPSHOT으로 바꾸어 같은 순서를 수행합니다. A가 첫 읽기로 기준을 확보하고 B가 commit한 뒤 두 번째 일반 SELECT는 100을 기대합니다. sleep으로 순서를 추측하지 말고 B commit 응답을 확인한 뒤 A를 재개합니다.

| 설정·조회 | A 첫 읽기 | B commit 후 A 일반 두 번째 읽기 | 쓰기 측면 |
| --- | --- | --- | --- |
| RCSI의 READ COMMITTED | 100 | 120 | 쓰기끼리 잠금·조정은 남음 |
| SNAPSHOT | 100 | 100 | 동시 변경한 행 갱신에 충돌 가능 |
| locking READ COMMITTED | 100 | 보통 후속 커밋 관찰 가능 | 대기·잠금 종류가 다름 |

표는 이 한 행 순서와 자기 쓰기 없음의 기대값입니다. 조회 종류·힌트·다른 transaction 상태가 바뀌면 다시 분석해야 합니다.

## Snapshot 읽기와 갱신 충돌 경로

A가 snapshot에서 100을 읽은 뒤 B가 120으로 바꾸고 commit한 상태에서 A가 같은 행을 UPDATE하면 SQL Server의 snapshot update conflict로 실패할 수 있습니다. 일반적으로 오류 3960 같은 제품 오류를 드라이버 분류로 처리하고 거래를 정리합니다. 실패한 UPDATE의 옛 계산만 반복하지 말고 새 거래에서 최신 읽기·판단부터 다시 수행합니다.

RCSI가 writer의 모든 잠금을 없애는 것은 아닙니다. 서로 다른 행을 바꾸며 집합 불변식을 깨는 write skew도 SNAPSHOT만으로 자동 해결되지 않습니다. 공통 잠금·제약·SERIALIZABLE 등의 더 넓은 경계를 검토합니다. 외부 결제·메일은 DB 재시도와 별도 멱등·outbox로 처리합니다.

```diagram
{"title":"읽기 기준과 쓰기 승인 조건은 별도입니다","caption":"화살표는 두 세션의 상태 변화입니다. A가 옛 값을 읽을 권한이 있어도 B가 바꾼 현재 행을 옛 판단으로 갱신할 권한까지 생기지 않습니다.","rows":[[{"id":"a","label":"A snapshot에서 100 읽기"}],[{"id":"b","label":"B가 120 commit"}],[{"id":"read","label":"A 일반 읽기는 100"},{"id":"write","label":"A UPDATE는 충돌 가능"}]],"edges":[{"from":"a","to":"b","label":"A 거래 유지"},{"from":"b","to":"read","label":"snapshot 가시성"},{"from":"b","to":"write","label":"현재 쓰기 조정"}]}
```

## UPDLOCK과 일반 버전 읽기의 경로 차이

`SELECT ... WITH (UPDLOCK)`은 A가 읽은 행을 나중에 갱신하려는 의도를 DB에 알리고 update lock을 요청하는 읽기입니다. 그 잠금은 일반적으로 거래가 끝날 때까지 유지되므로, A가 먼저 확보하면 B의 UPDATE가 같은 행에서 기다릴 수 있고 RCSI가 켜져도 이 명시적 잠금 요청이 없어지지 않습니다.

SNAPSHOT에서 이 힌트를 섞으면 일반 snapshot 읽기처럼 오래된 값을 잠금 없이 계속 돌려준다고 볼 수 없으며, 최신 행 확인과 갱신 충돌이 어느 순서에서 발생하는지는 실제 버전·옵션 조합으로 나누어 시험해야 합니다.

테스트에서는 A가 UPDLOCK을 먼저 얻은 경우 B의 UPDATE가 어디서 기다리는지, A가 일반 snapshot 읽기를 먼저 하고 B가 commit한 뒤 UPDLOCK을 요청한 경우 어떤 update conflict가 나는지 나눕니다. 대상이 없거나 범위 조건인 경우는 UPDLOCK 하나만으로 모든 신규 삽입·phantom을 막는다고 보지 않습니다. HOLDLOCK·격리·인덱스의 범위 보호는 별도입니다.

같은 SQL도 SQL Server 버전·DB 옵션·힌트 조합이 달라지면 관찰할 경로가 달라질 수 있으므로, A가 잠금을 얻는 경우와 snapshot을 먼저 읽는 경우를 별도 실행해야 합니다. 각 실행에서 잠금 리소스와 모드, 보유 시간, 실제 plan, 발생 오류를 함께 남겨야 ‘기다림’과 ‘update conflict’를 구분할 수 있습니다. 이 노트의 기대 결과는 위 조건을 갖춘 테스트 DB에서 재현한 뒤에만 특정 환경의 계약으로 사용해야 합니다.

## 읽기 대기와 Version Store 비용의 교환

오래된 snapshot이 남으면 필요한 이전 버전을 보관해야 합니다. 전통적인 tempdb version store와 ADR 구성의 persistent version store 등 버전·설정에 따라 위치와 관측이 달라집니다. 최장 거래·version 생성·정리·디스크·읽기 지연을 함께 봅니다.

연결 풀의 isolation·실패 transaction 상태를 다음 요청에 넘기지 않게 rollback·reset을 확인합니다. 현재 작업 환경에는 SQL Server가 없어 위 T-SQL과 UPDLOCK 경쟁을 실행하지 않았습니다. 기대 결과·실행 순서를 제시한 것이며 제품 실험 완료로 보고하지 않습니다.

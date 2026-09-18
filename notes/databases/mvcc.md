---
id: mvcc
title: MVCC의 읽기 시점과 버전 보존
topic: 데이터베이스
summary: 두 번의 조회 사이에 다른 거래가 커밋하는 예로 문장·트랜잭션 스냅샷을 비교하고 긴 독자가 버전 정리를 막는 이유를 설명합니다.
questionIds: [db-mvcc-snapshot, isolation-two-read-experiment, old-transaction-version-retention]
---

# MVCC의 읽기 시점과 버전 보존

## 보고서 조회 중 변경과 다중 버전 보존

보고서가 주문 합계를 읽는 동안 다른 요청이 주문을 수정한다고 합시다. 독자가 읽는 값을 매번 제자리에서 덮어쓰면, 긴 보고서 전체를 잠그거나 중간에 달라진 값을 받아들여야 합니다. 다른 방법은 옛 값을 잠시 남겨 두고 각 독자가 볼 수 있는 버전을 선택하게 하는 것입니다. 이 방식을 **다중 버전 동시성 제어**(MVCC)라고 합니다.

핵심은 “잠금이 없다”가 아니라 “독자가 어떤 버전을 볼지 정한다”입니다. 여러 버전을 유지하는 저장 구조와 스냅샷의 가시성 규칙을 통해 읽기와 쓰기의 일부 충돌을 줄입니다. 실제 버전 배치는 행 자체·undo·별도 버전 저장소 등 엔진마다 다릅니다.

MVCC를 이해할 때는 저장된 여러 버전과 각 읽기가 선택하는 스냅샷을 분리해서 생각해야 합니다. 같은 데이터베이스라도 스냅샷 생성 시점과 격리 수준이 다르면 두 번째 조회 결과와 오래된 버전의 보존 기간이 달라집니다.

읽기 결과를 예측하는 최소 trace는 `A snapshot=100 → B commit=120 → A read`입니다. 문장별 스냅샷이면 마지막 단계가 120이고 거래 스냅샷이면 100이며, 이 둘은 MVCC 사용 여부가 아니라 snapshot 생성 계약의 차이입니다. 진단 시에는 먼저 연결의 transaction 시작·첫 읽기 시점과 격리 수준을 기록하고, 그다음 오래된 A를 유지한 채 B가 여러 번 갱신하도록 해 version space 또는 vacuum 지표가 움직이는지 확인합니다. 결과가 다르면 엔진 구현 차이와 실험 순서 차이를 분리해 기록합니다.

## 행 버전과 스냅샷 가시성

```diagram
{"title":"현재 값과 독자가 보는 값","caption":"화살표는 가시성 규칙에 따른 버전 선택입니다. 그림의 시각은 설명용 커밋 순서이며, 실제 DB가 단순 시각 비교 하나로 가시성을 구현한다는 뜻은 아닙니다.","rows":[[{"id":"oldread","label":"이전 스냅샷 독자","detail":["수정 전 상태가 필요"]},{"id":"newread","label":"수정 후 스냅샷 독자","detail":["새 커밋을 볼 수 있음"]}],[{"id":"old","label":"이전 버전 · 100","detail":["독자가 필요하면 보존"]},{"id":"new","label":"새 버전 · 120","detail":["쓰기 거래가 커밋"]}]],"edges":[{"from":"oldread","to":"old","label":"가시 버전 선택"},{"from":"newread","to":"new","label":"가시 버전 선택"}]}
```

스냅샷은 모든 테이블을 통째로 복사한 파일일 필요가 없습니다. 거래 ID·커밋 상태·활성 거래 집합 등의 정보로 어떤 버전을 읽을지 판별할 수 있습니다. 아직 커밋하지 않은 다른 거래의 값을 일반 읽기에 노출하지 않는 규칙도 여기 들어갑니다.

## 문장별 스냅샷과 트랜잭션 스냅샷 비교 실험

초기 금액은 100이고, A는 같은 논리 거래에서 두 번 조회합니다. B는 그 사이 값을 120으로 바꾸어 커밋합니다. A 자신의 쓰기는 없다고 가정합니다.

| 순서 | A | B |
| --- | --- | --- |
| 1 | 거래 시작 후 첫 조회: 100 | |
| 2 | 잠시 대기 | 120으로 갱신하고 커밋 |
| 3 | 두 번째 조회 | 완료 |

각 문장마다 스냅샷을 새로 얻는 정책이라면 A의 두 번째 조회는 120을 볼 수 있습니다. 같은 스냅샷을 유지하는 정책이라면 100을 봅니다. 따라서 “MVCC를 쓴다”는 정보만으로 두 번째 값을 결정할 수 없습니다.

위 표의 두 번째 읽기 결과를 해석하려면 먼저 스냅샷이 언제 만들어졌는지를 고정해야 합니다. 어떤 엔진·설정에서는 `BEGIN`이 아니라 첫 읽기 때 스냅샷이 생길 수 있고, `FOR UPDATE` 같은 잠금 읽기는 일반 스냅샷 읽기와 다른 규칙을 쓸 수 있습니다. 따라서 PostgreSQL·InnoDB·SQL Server에서 이름이 비슷한 격리 수준을 섞지 말고, 실제 버전·격리 수준·조회 종류를 정한 뒤 같은 순서를 재현합니다.

## 버전 가시성 판정 알고리즘

다음은 특정 제품의 내부 구현이 아니라 “어떤 버전이 보이는가”와 “어디에 저장되어 있는가”를 분리하는 모형입니다.

```text
readRow(key, transaction):
    snapshot = snapshotForThisStatementOrTransaction(transaction)
    for version in candidateVersions(key):
        if isOwnVisibleWrite(version, transaction):
            return version.value
        if visibleUnderSnapshot(version, snapshot):
            return version.value_or_deleted
    return absent
```

`visibleUnderSnapshot`을 `version.time <= snapshot.time` 한 줄로 바꾸면 실제 엔진의 미커밋 거래와 삭제·자기 쓰기 규칙을 놓칠 수 있습니다. 이 함수가 엔진별 계약을 나타내는 추상화라는 점이 중요합니다. 애플리케이션에서는 직접 구현하기보다 어떤 격리 수준에서 어떤 SQL을 실행할지 선택합니다.

## 읽기 잠금 완화와 쓰기 경쟁

A와 B가 같은 행을 동시에 바꾸면 쓰기 잠금 대기나 충돌 검출이 필요할 수 있습니다. 스키마 변경과 일반 조회도 서로 영향을 줄 수 있습니다. 인덱스 페이지 수정·버전 생성·로그 기록에는 CPU·메모리·I/O가 듭니다.

또한 A가 당직자 B를 보고 자기 행을 퇴근 처리하고, B도 같은 스냅샷에서 A를 보고 자기 행을 퇴근 처리하면 두 행 모두 유효하지만 “최소 한 명”이라는 규칙은 깨질 수 있습니다. 일관된 과거를 읽는 것과 여러 거래가 직렬로 실행된 것 같은 결과를 보장하는 것은 다릅니다. 이 문제는 쓰기 편향 노트에서 별도로 다룹니다.

## 장기 독자와 버전 정리 경계

새 값 120이 커밋됐어도 이전 스냅샷 독자가 100을 읽을 수 있다면 그 버전을 지울 수 없습니다. 이런 거래가 오래 유지되는 동안 갱신이 계속되면 보존해야 할 버전이 늘어납니다. 읽기 전용 거래도 저장 비용에 영향을 주는 이유입니다.

| 관찰 | 가능한 의미 | 함께 확인할 것 |
| --- | --- | --- |
| 오래된 거래와 버전 공간 증가 | 정리 기준이 전진하지 못함 | 거래 시작·스냅샷 나이, 실제 조회 여부 |
| 조회는 끝났는데 거래가 열림 | 연결 풀에서 유휴 거래가 남음 | autocommit, 예외·반환 경로 |
| 독자를 끝내도 파일 크기 유지 | 공간은 재사용 가능하지만 파일은 유지 | 엔진의 정리·파일 반환 방식 |
| 복제본 긴 조회와 복제 지연 | 재생·버전 보존 정책 충돌 가능 | 피드백·취소·보존 설정 |

보고서를 여러 짧은 거래로 나누면 버전 수명은 줄지만 페이지마다 다른 시점이 섞일 수 있습니다. 동일 시점 보고서가 요구된다면 단순 분할 대신 일관된 추출본이나 분석 저장소를 검토합니다. 비용을 줄이면서 원래 일관성 요구를 몰래 바꾸지 않아야 합니다.

## 엔진별 MVCC 실행 확인 순서

테스트 DB의 두 연결로 위 시간표를 재현합니다. A 첫 읽기 뒤 장벽, B 커밋 확인, A 두 번째 읽기 순으로 진행하고 결과와 격리 설정을 기록합니다. 다음에는 A가 직접 갱신한 행의 재조회와 잠금 읽기를 별도 시험합니다.

마지막으로 A의 스냅샷을 유지한 채 B에서 반복 갱신하고, 오래된 거래의 나이와 엔진별 버전 저장·정리 지표를 관찰합니다. A를 끝냈을 때 재사용 공간이 늘어나는지와 OS 파일 크기가 줄어드는지는 따로 확인합니다. 아래 PostgreSQL·SQL Server 예상값과 실제 SQLite 실행을 서로 다른 근거로 구분합니다.

### PostgreSQL 두 연결의 명시적 실행 순서

격리된 테스트 DB에 `mvcc_demo(id integer primary key, value integer)`를 만들고 `(1,100)`을 넣었다고 가정합니다. 운영 DB에서 실행하는 절차가 아닙니다.

```sql
-- A: 첫 실행은 READ COMMITTED
BEGIN ISOLATION LEVEL READ COMMITTED;
SELECT value FROM mvcc_demo WHERE id = 1;
-- 첫 결과 100을 확인하고 A를 멈춥니다.
```

```sql
-- B: A의 첫 결과 확인 뒤 실행
BEGIN;
UPDATE mvcc_demo SET value = 120 WHERE id = 1;
COMMIT;
```

```sql
-- A: B COMMIT 성공을 확인한 뒤 실행
SELECT value FROM mvcc_demo WHERE id = 1;
ROLLBACK;
```

PostgreSQL READ COMMITTED의 두 번째 일반 SELECT는 120을 기대합니다. 두 거래가 모두 끝난 뒤 값을 100으로 초기화하고 A의 BEGIN을 `BEGIN ISOLATION LEVEL REPEATABLE READ`로 바꾸어 같은 순서를 수행하면 두 번째 읽기는 100을 기대합니다. 초기화 전에 열린 snapshot을 남기지 않습니다. 이 절의 PostgreSQL SQL은 실행 순서와 기대 결과이며 현재 환경에서 PostgreSQL을 실행한 결과는 아닙니다.

A 자신의 UPDATE 후 읽기는 자기 변경을 보는 별도 시험으로 분리합니다. B가 같은 행을 바꾼 뒤 A의 REPEATABLE READ에서 그 행을 UPDATE하면 serialization failure가 생길 수 있으므로 새 transaction에서 읽기·판단부터 재시도합니다. 일반 SELECT의 snapshot과 `SELECT ... FOR UPDATE`의 잠금·동시 갱신 동작을 같은 것으로 보지 않습니다. SQL Server의 RCSI·SNAPSHOT·UPDLOCK은 별도 노트의 T-SQL 순서로 비교합니다.

### SQLite 실제 실행 범위와 기록

`scripts/verify-isolation-study.py`는 임시 SQLite 파일을 WAL 모드로 열고 실제 두 연결을 사용합니다. A의 첫 읽기, B의 UPDATE·COMMIT, A의 두 번째 읽기를 각 호출의 완료 순서로 통제하므로 `sleep`에 기대지 않습니다.

명시적 read transaction의 snapshot 유지, autocommit의 문장별 새 읽기, 자기 쓰기 관찰, 오래된 snapshot에서의 write 실패를 각각 나눠 검사합니다. 이 결과는 SQLite 계약만 확인하며 PostgreSQL·InnoDB·SQL Server의 결과를 대신하지 않으므로, 제품별 예상 SQL과 실제 실행 근거를 따로 기록합니다.

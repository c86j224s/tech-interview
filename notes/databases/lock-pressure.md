---
id: lock-pressure
title: DB 잠금 범위·보유 시간·로그 압력의 분리
topic: 데이터베이스
summary: 변경 행과 탐색 잠금을 구분하고 SQL Server escalation·InnoDB next-key·PostgreSQL predicate 관측, 대량 배치와 checkpoint 원자성을 설명합니다.
questionIds: [db-lock-escalation, database-lock-resource-diagnosis, database-log-lock-pressure-priority, db-large-transaction-batching]
---

# DB 잠금 범위·보유 시간·로그 압력의 분리

## UPDATE 10행이 잠금 10개라는 뜻은 아닙니다

조건에 맞는 10행을 찾으려고 넓은 범위를 읽거나 인덱스·외래키·메타데이터를 검사할 수 있습니다. 잠그는 자원과 시점은 엔진·격리·계획에 달렸습니다. 최종 영향 행 수만으로 실제 잠금 범위를 추측하면 blocker를 놓칠 수 있습니다.

쿼리 자체가 5ms여도 그 거래 안에서 외부 API를 10초 기다리면 연결·잠금이 오래 남을 수 있습니다. 실행 CPU·I/O 시간과 잠금 대기·거래 보유 시간을 나눕니다. 한 방향 blocking과 순환 대기인 deadlock도 구분합니다.

## 엔진별 잠금 이름을 같은 메커니즘으로 보지 않습니다

| 엔진 | 관찰 예 | 구분할 계약 |
| --- | --- | --- |
| SQL Server | lock DMV·waiting task·deadlock graph | key·page·object·HoBT, escalation |
| InnoDB | performance_schema data_locks·data_lock_waits | record·gap·next-key·격리 |
| PostgreSQL | pg_locks·pg_stat_activity·blocking 관계 | row/transaction wait·relation·SSI predicate |

SQL Server escalation은 여러 세부 잠금을 table 또는 설정에 따른 HoBT 수준으로 바꾸는 동작일 수 있으며 row→page→table의 필수 계단식 승격이 아닙니다. InnoDB의 gap·next-key는 삽입과 범위 경쟁에 영향을 주며 유일 동등 조건·격리 등에 따라 달라집니다. PostgreSQL SSI의 predicate 정보는 일반적인 blocking range lock과 같은 것으로 설명하지 않습니다.

각 view의 지원 버전·권한·관측 범위를 확인합니다. row lock이 언제나 모든 행마다 view에 같은 형식으로 나타난다고 가정하지 않습니다. 내부 page latch와 transaction lock도 별도 wait 원인입니다.

```diagram
{"title":"대기자를 따라 실제 오래된 소유자를 찾습니다","caption":"화살표는 기다리는 관계입니다. 마지막 SQL이 짧거나 현재 idle이어도 열린 transaction이 자원을 보유할 수 있습니다.","rows":[[{"id":"request","label":"사용자 요청 지연"}],[{"id":"waiter","label":"대기 세션·요청 자원"}],[{"id":"blocker","label":"잠금 소유 transaction"}],[{"id":"scope","label":"시작·마지막 SQL·외부 대기"}]],"edges":[{"from":"request","to":"waiter","label":"trace·session 연결"},{"from":"waiter","to":"blocker","label":"blocker 추적"},{"from":"blocker","to":"scope","label":"보유 시간 원인"}]}
```

## 로그 압력과 잠금 압력은 같이 보여도 다른 자원입니다

대량 갱신은 많은 로그 바이트·flush·복제 replay를 만들고 긴 잠금도 유지할 수 있습니다. 로그 flush 대기·디스크 여유·replica lag와 lock wait·blocker 수명을 각각 계측합니다. 작은 batch가 둘을 개선했다고 원인이 하나였다고 결론 내리지 않습니다.

인덱스 추가는 탐색·잠금 범위를 줄일 수 있지만 쓰기마다 인덱스 로그를 늘릴 수 있습니다. 반대로 transaction의 외부 대기를 제거하면 잠금 보유는 줄지만 행당 로그량은 비슷할 수 있습니다. 한 변수씩 바꿔 생성 로그·읽기량·commit 지연·p99를 비교합니다. durability를 약화해 수치만 낮춘 것을 같은 정확성의 최적화로 보고하지 않습니다.

## Batch로 나누면 전체 원자성은 부분 완료로 바뀝니다

100만 행을 한 transaction 대신 1천 행씩 커밋하면 잠금 보유·복구 부담을 줄일 수 있지만 사용자가 중간 상태를 볼 수 있습니다. 이를 허용하는지 먼저 정합니다. 전체 전환이 필요하면 새 버전 데이터에 구성·검증한 뒤 읽기 포인터를 바꾸는 다른 모델이 필요할 수 있으며 동시 쓰기·복구는 추가됩니다.

`WHERE status='pending'` 목록을 OFFSET 1000씩 늘리며 갱신하면 앞의 완료 행이 조건에서 빠져 다음 pending 행을 건너뛸 수 있습니다. 안정된 키 범위·기준 입력·조건부 갱신과 완료 checkpoint를 사용합니다. checkpoint를 실제 반영보다 먼저 전진시키지 않습니다.

```text
read next bounded key range after checkpoint
begin transaction
  update rows only if expected source version still matches
  record conflicts for later recalculation
  persist completed range and conflict set consistently
commit
```

충돌 행을 건너뛰고 고수위만 올리면 영구 누락될 수 있어 내구 보류 집합·재조사 규칙이 필요합니다. 특정 행 오류가 전체 batch를 무한히 막지 않게 실패 분류·격리·한도를 둡니다. 처리·실패·보류 수를 전체 완료와 구분합니다.

## 힌트보다 접근 경로와 거래 범위를 먼저 봅니다

적합한 인덱스·검색 가능한 조건·짧은 거래·일관된 다중 키 잠금 순서를 검토합니다. row lock hint나 낮은 격리를 무조건 적용하면 lock 메모리·부정확한 읽기·새 경합이 생길 수 있습니다. 강한 격리도 deadlock·serialization 실패를 없애지 않으므로 전체 논리 거래를 제한적으로 재시도합니다.

테스트에서는 넓은 scan·긴 외부 대기·대량 로그·작은 batch를 각각 대조합니다. 취소·예외 뒤 rollback·연결 반환과 부분 진행 복구를 확인합니다. 현재 작업에서는 제품별 lock·log 부하 실험을 실행하지 않았습니다. 본문은 진단과 안전한 배치 설계입니다.

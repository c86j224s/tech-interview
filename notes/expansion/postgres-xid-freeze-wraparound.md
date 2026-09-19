---
id: postgres-xid-freeze-wraparound
title: PostgreSQL XID wraparound·freeze
topic: 데이터베이스
summary: >-
  transaction ID의 유한 공간, 오래된 tuple과 freeze, autovacuum 지연을 연결하고 wraparound 방지와
  일반 bloat 정리를 구분합니다.
questionIds: []
prerequisites:
  - postgres-retention
  - mvcc
related:
  - wal-recovery
  - connection-lifetime
reviewedAt: '2026-09-19'
---
# PostgreSQL XID wraparound·freeze

PostgreSQL의 transaction ID는 무한히 커지는 정수가 아니라 유한한 시계입니다. tuple의 `xmin`·`xmax`와 snapshot을 이용해 가시성을 판정할 때 오래된 값을 미래 값으로 잘못 해석하면 데이터가 보이지 않거나 보이는 재앙적 오류가 생길 수 있습니다. VACUUM의 freeze는 오래된 tuple을 더 이상 일반 XID 비교에 의존하지 않는 상태로 만들어 이 경계를 보호합니다. 이는 dead tuple을 치우고 파일을 줄이는 bloat 관리와 같은 작업에서 수행될 수 있지만 목적과 완료 판정은 다릅니다.

## XID 시계

각 행 버전에는 생성·삭제 transaction과 commit 상태를 판단할 정보가 연결되고, snapshot은 자신에게 보이는 버전을 선택합니다. 32-bit modulo 공간에서는 숫자만 비교할 수 없으므로 relation의 오래된 XID 경계를 계속 유지해야 합니다. 충분히 오래된 tuple의 insertion XID를 FrozenTransactionId처럼 취급하게 만드는 freeze가 없으면 wraparound 후 미래 transaction으로 오인할 수 있습니다.

```text
설명용 상태
relfrozenxid = 100
오래된 tuple xmin = 120
현재 XID = 1,000,000
VACUUM freeze → 오래된 tuple을 frozen 취급
```

이 숫자는 실제 임계값을 뜻하지 않습니다. 운영에서 `relfrozenxid`와 `age(relfrozenxid)`는 relation이 가장 오래된 비교 경계를 얼마나 끌고 있는지 보는 신호입니다. dead tuple이 거의 없어도 age가 커질 수 있는 이유가 여기 있습니다.

## Tuple 가시성과 freeze

freeze는 “행을 삭제”하는 기능이 아니라 visibility 판정에 필요한 오래된 XID 의존성을 줄이는 기능입니다. 일반 VACUUM은 dead tuple을 재사용 가능하게 하고 visibility map을 갱신하면서 필요하면 freeze도 수행합니다. 오래된 snapshot, `idle in transaction`, prepared transaction, replica feedback, lock 대기 또는 worker 부족이 정리와 freeze 진행을 서로 다른 방식으로 막을 수 있으므로 age와 blocker를 함께 관찰합니다.

freeze가 필요한 relation을 파일 크기만으로 찾지 않습니다. 작은 정적 테이블도 많은 transaction이 지나면 age 위험을 가질 수 있고, 큰 hot table은 age보다 dead tuple·I/O가 먼저 문제일 수 있습니다.

## Freeze와 bloat

| 관찰 상태 | 주된 부채 | 우선 질문 |
| --- | --- | --- |
| dead tuple 적음, age 높음 | XID 경계 | freeze가 진행되는가 |
| dead tuple 많음, age 낮음 | 공간·I/O | 재사용과 latency를 줄이는가 |
| 파일 큼, age 낮음 | 내부 빈 공간 | OS 축소가 필요한가 |
| 파일 작음, age 높음 | wraparound 안전성 | anti-wraparound vacuum이 막혔는가 |

일반 `VACUUM`은 공간을 relation 내부에서 재사용할 수 있게 만들지만 보통 OS에 파일을 반환하지 않습니다. `VACUUM FULL`은 별도 재작성 작업으로 강한 잠금과 추가 공간이 필요하며 XID freeze의 대체 명령이 아닙니다. 따라서 “vacuum이 끝났으니 파일도 줄었고 wraparound도 해결됐다”는 한 문장으로 완료를 선언하지 않습니다.

## Age 관측

relation별 일반 XID는 `age(relfrozenxid)`로 관찰하고, MultiXact 경계는 서로 다른 identifier 공간이므로 `mxid_age(relminmxid)`로 따로 관찰합니다. `age(relminmxid)`라고 쓰면 같은 함수에 다른 의미를 억지로 적용하는 오류입니다. `relfrozenxid`와 `relminmxid`를 같은 시계로 합산하지 않고 DB-wide oldest XID, 오래된 backend, 마지막 vacuum, progress와 함께 기록합니다.

```text
relation A: age(relfrozenxid)=900M, mxid_age(relminmxid)=20K, dead=0
relation B: age(relfrozenxid)=40M,  mxid_age(relminmxid)=700M, dead=0
→ A는 XID freeze, B는 MultiXact freeze 경로를 우선 조사
```

수치는 설명용 예이며 배포 임계값이 아닙니다. MultiXact는 여러 locker를 나타내는 데 사용될 수 있고, `FOR UPDATE`가 많은 workload에서는 일반 XID가 낮아도 MultiXact age가 진행할 수 있습니다.

## Autovacuum 우선순위

autovacuum에는 변경량 기반 일반 vacuum과 transaction age를 보호하기 위한 anti-wraparound 작업이 서로 다른 압력을 만듭니다. 큰 테이블에 dead tuple이 많다는 이유만으로 작은 정적 relation의 높은 age를 뒤로 미루지 않습니다. 먼저 보호 한계 전에 XID와 MultiXact freeze가 완료되는지 확인하고, 그 다음 bloat와 query latency를 최적화합니다.

우선순위 결정은 다음처럼 구체화합니다.

1. `age(relfrozenxid)`와 `mxid_age(relminmxid)`가 계속 증가하는 relation을 찾습니다.
2. 오래된 snapshot·idle transaction·prepared transaction·replica feedback·lock이 scan을 붙잡는지 조사합니다.
3. worker, I/O, 디스크 잔여 시간과 사용자 p99 사이에서 anti-wraparound 작업 예산을 확보합니다.
4. age 안전성이 확인된 뒤 dead tuple threshold와 일반 bloat 비용을 조정합니다.

모든 테이블에 같은 scale factor를 적용하지 않습니다. 작은 정적 테이블은 age가 중심이고 큰 hot table은 변경률과 latency도 크므로 table-level 설정과 worker 예산을 관계별로 검증합니다.

## MultiXact 공간

여러 transaction이 같은 행을 잠글 때 PostgreSQL은 locker 집합을 나타내기 위해 MultiXact identifier를 사용할 수 있습니다. 이 공간은 일반 XID와 별도이며 member storage counter와 forced vacuum 조건도 따로 움직입니다. 그러므로 `FOR UPDATE` 호출 횟수와 age가 항상 선형이라고 단정할 수는 없지만, 잠금 workload가 있는 relation에서 `relminmxid`와 `mxid_age(relminmxid)`를 생략하면 관측 공백이 생깁니다.

실제 운영 지표에는 PostgreSQL major에 해당하는 `vacuum_multixact_freeze_table_age`와 `autovacuum_multixact_freeze_max_age` 설정도 함께 기록합니다. 설정명과 기본값은 배포 버전에서 확인하고, 값만 복사해 모든 workload에 적용하지 않습니다.

## 장애와 대응

age 경보가 울리면 dead tuple 수가 낮다는 이유로 종료하지 않습니다. anti-wraparound vacuum이 실행되지 않는지, worker가 다른 relation에 점유됐는지, lock이나 오래된 transaction이 진행을 막는지, 디스크와 I/O가 충분한지를 순서대로 봅니다. 보호 한계에 가까우면 쓰기 제한과 유지보수 승인 절차가 일반 latency tuning보다 우선할 수 있습니다.

테이블 삭제, 임의 파일 삭제, catalog 직접 수정은 정상적인 freeze 해결책이 아닙니다. relation별 age·freeze 진행·blocker를 보존하고, 실패한 autovacuum의 로그와 progress를 소유자에게 에스컬레이션합니다. 일반 bloat와 wraparound가 동시에 높으면 두 목표를 분리한 runbook으로 처리합니다.

## 검증과 비용

격리 DB에서 낮은 변경률·오래된 독자, 높은 변경률·독자 없음, 두 부채 동시 상태를 나누어 relation age, frozen tuple 진행, dead tuple, relation size, oldest transaction, lock, progress를 시각과 함께 캡처합니다. 이 문서 작성에서는 PostgreSQL vacuum을 실행하지 않았으므로 다음 결과는 예상 trace입니다. 일반 vacuum 뒤 relation 파일 크기가 그대로여도 내부 재사용과 freeze가 진전될 수 있고, 오래된 독자가 있으면 dead tuple 정리가 지연될 수 있습니다.

freeze와 anti-wraparound 작업은 I/O·CPU·buffer 경합 비용이 있습니다. worker를 늘리면 사용자 요청과 경쟁하고, 미루면 단순 bloat가 아니라 쓰기 지속성과 visibility 안전성이 위험해집니다. 공식 문서의 일반 원칙을 실제 threshold와 혼동하지 말고 major·설정·workload를 함께 기록합니다.

## 참고 자료

- PostgreSQL, [Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html), §24.1.1–24.1.6. VACUUM의 cleanup·visibility·freeze·transaction ID wraparound prevention, MultiXact age와 `mxid_age`를 확인했습니다.
- 실행하지 않은 SQL과 age 숫자는 설명용입니다. 정확한 임계, 설정 기본값, progress view 컬럼은 배포 PostgreSQL major에서 재검증해야 합니다.

```diagram
{"title":"XID age와 bloat를 분리한 vacuum","caption":"dead tuple 정리와 유한 identifier 공간 보호는 서로 다른 신호를 따라 같은 maintenance 작업에서 만날 수 있습니다.","rows":[[{"id":"tuple","label":"Tuple·locker","detail":["xmin·xmax·MultiXact"]}],[{"id":"bloat","label":"Bloat 축","detail":["dead tuple·공간"]},{"id":"age","label":"Age 축","detail":["XID·MultiXact"]}],[{"id":"vacuum","label":"VACUUM 경로","detail":["cleanup·freeze"]}],[{"id":"safety","label":"운영 안전","detail":["age 감소·blocker 확인"]}]],"edges":[{"from":"tuple","to":"bloat","label":"변경·삭제"},{"from":"tuple","to":"age","label":"유한 시계"},{"from":"bloat","to":"vacuum","label":"재사용 정리"},{"from":"age","to":"vacuum","label":"freeze 보호"},{"from":"vacuum","to":"safety","label":"진행 검증"}]}
```

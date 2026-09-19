---
id: postgres-xid-monitoring
title: PostgreSQL에서 FOR UPDATE 잠금이 많은 테이블은 일반 XID age와 별도로 MultiXact age를 왜 감시하나요?
difficulty: 중하
category: 인프라
tags:
  - PostgreSQL
  - monitoring
  - XID
  - VACUUM
related:
  - db-postgres-vacuum
---
# PostgreSQL에서 FOR UPDATE 잠금이 많은 테이블은 일반 XID age와 별도로 MultiXact age를 왜 감시하나요?

## 구두 답변

`FOR UPDATE`처럼 여러 transaction이 같은 행을 잠그는 workload에서는 단일 XID만으로 locker 집합을 표현하기 어려워 MultiXact identifier가 사용될 수 있습니다. MultiXact는 일반 transaction ID와 다른 identifier 공간과 보존·freeze 경계를 가지므로, 일반 XID age가 낮다고 모든 wraparound 관련 위험에서 벗어났다고 볼 수 없습니다.

데이터와 dead tuple가 거의 변하지 않지만 많은 worker가 같은 행을 반복 잠그는 상황을 생각할 수 있습니다. relation 크기는 안정적이어도 MultiXact 정보가 누적될 수 있습니다. 발생량과 임계값은 PostgreSQL major·workload에 달라지므로 잠금 횟수와 age가 선형이라고 단정하지 않고 `relminmxid` age와 lock workload, autovacuum 진행을 함께 대조합니다.

대시보드에는 XID age와 MultiXact age를 별도 시계로 표시하고 오래된 transaction·잠금 대기·worker starvation도 함께 봅니다. 대응은 파일 축소가 아니라 해당 relation의 보존·freeze 필요를 확인하는 것입니다. 공식 문서와 배포 버전 catalog를 기준으로 실제 지표 이름과 임계값을 확정하겠습니다.

MultiXact는 여러 locker를 나타내는 별도 identifier 공간이므로 일반 XID의 낮은 age가 MultiXact 안전성을 보장하지 않습니다. 관측은 `age(relfrozenxid)`와 `mxid_age(relminmxid)`를 분리하고, `FOR UPDATE` 집중도, 동일 행 대기, 오래된 snapshot, autovacuum progress를 같은 시간축에 기록합니다. 예를 들어 dead tuple가 거의 없는 queue 행을 여러 worker가 반복 잠그면 relation size는 안정적이어도 MultiXact age가 진행할 수 있습니다. 호출 횟수와 age가 선형이라고 단정하지 않고 실제 추세를 확인합니다.

배포 설정에서는 `vacuum_multixact_freeze_table_age`와 `autovacuum_multixact_freeze_max_age`를 major 문서와 대조합니다. worker 실행 여부가 아니라 relminmxid와 mxid_age가 개선됐는지, blocker가 해소됐는지가 성공 기준입니다. 파일 축소는 MultiXact 경계의 직접 해결책이 아니며, 오래된 snapshot이 동시에 있으면 snapshot 소유자와 lock 대기를 먼저 분리해 조사합니다.

## 득점 포인트

- MultiXact를 여러 locker를 표현하는 별도 identifier로 설명합니다.
- 일반 XID age와 독립된 감시 필요성을 제시합니다.
- FOR UPDATE workload와 relation별 age를 연결합니다.
- 버전별 임계와 실제 발생량을 단정하지 않습니다.

## 감점 포인트

- MultiXact를 XID의 다른 이름으로 설명합니다.
- FOR UPDATE가 많으면 반드시 같은 비율로 age가 증가한다고 합니다.
- autovacuum 실행 중이라는 사실만으로 모든 age가 회복됐다고 합니다.

## 더 파고들 거리

- `relminmxid`와 freeze 진행을 어떤 relation 목록과 비교할까요?
- MultiXact age와 오래된 snapshot이 동시에 높을 때 먼저 확인할 차단자는 무엇인가요?

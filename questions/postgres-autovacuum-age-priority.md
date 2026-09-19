---
id: postgres-autovacuum-age-priority
title: 변경률은 낮지만 transaction age가 높은 테이블이 있다면 autovacuum 정책을 어떤 축으로 우선순위화하나요?
difficulty: 중하
category: 인프라
tags:
  - PostgreSQL
  - autovacuum
  - transaction age
  - freeze
related:
  - old-transaction-version-retention
---
# 변경률은 낮지만 transaction age가 높은 테이블이 있다면 autovacuum 정책을 어떤 축으로 우선순위화하나요?

## 구두 답변

우선순위를 dead tuple 발생률 하나로 정하지 않고 transaction age/freeze 안전성과 일반 bloat를 두 축으로 나누겠습니다. 변경률이 낮아 일반 threshold를 잘 넘지 않는 테이블도 age가 위험하면 anti-wraparound 작업이 먼저 완료되도록 보호해야 합니다. worker가 실제로 relation을 처리하는지, 오래된 transaction·lock·I/O가 막는지도 확인합니다.

작은 정적 테이블은 age가 핵심이고 큰 hot table은 dead tuple·쓰기 I/O도 큽니다. 모든 테이블에 같은 scale factor를 복사하기보다 relation 크기·변경률·age·트래픽·vacuum 비용을 함께 보고 table-level 설정과 worker 예산을 조정합니다. age 보호가 만족되기 전에는 사용자 지연을 줄이려고 autovacuum을 무작정 끄지 않습니다.

relation별 age, `age(relfrozenxid)`·`mxid_age(relminmxid)`, vacuum 진행, oldest transaction, dead tuple, I/O와 사용자 p99를 함께 수집합니다. 기본 threshold는 PostgreSQL major와 설정에 의존하므로 고정 숫자를 외우기보다 현재 버전 공식 문서와 관찰값으로 runbook을 만들겠습니다.

우선순위 표를 두 축으로 만듭니다. 작은 정적 relation은 변경률이 낮아 일반 threshold를 넘지 않아도 `age(relfrozenxid)` 또는 `mxid_age(relminmxid)`가 보호 한계에 가까울 수 있으므로 anti-wraparound 작업의 완료 가능성을 먼저 확보합니다. 큰 hot table은 dead tuple·I/O·사용자 p99가 크더라도 age가 낮다면 일반 bloat 예산으로 별도 처리합니다.

age 높은 relation은 오래된 snapshot, idle transaction, prepared transaction, replica feedback, lock, worker starvation을 순서대로 조사합니다. worker 수와 maintenance window를 조정하되 age가 안전해지기 전 autovacuum을 성능 이유로 끄지 않습니다. 전후 age와 progress가 개선됐는지 기록하고, PostgreSQL major별 기본 threshold를 고정 숫자로 복사하지 않습니다.

## 득점 포인트

- age/freeze와 dead tuple을 별도 우선순위 축으로 둡니다.
- 작은 정적 테이블과 큰 변경 테이블의 위험 차이를 설명합니다.
- worker·lock·I/O 지연까지 조사합니다.
- 같은 scale factor의 기계적 적용을 피합니다.

## 감점 포인트

- 변경률이 낮으면 vacuum 필요가 없다고 합니다.
- 모든 테이블에 같은 설정을 복사합니다.
- 사용자 성능만 보고 wraparound 보호를 뒤로 미룹니다.

## 더 파고들 거리

- age가 높은 relation의 vacuum이 사용자 workload와 충돌할 때 어떤 완화책을 비교할까요?
- autovacuum이 반복 실패하는 relation을 어떤 증거와 소유자에게 에스컬레이션할까요?

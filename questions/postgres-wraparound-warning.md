---
id: postgres-wraparound-warning
title: >-
  PostgreSQL transaction ID가 오래된 테이블에서 wraparound 위험에 가까워질 때 일반 VACUUM 부하와 어떤
  신호를 구분하나요?
difficulty: 중하
category: 데이터베이스
tags:
  - PostgreSQL
  - XID
  - wraparound
  - VACUUM
related:
  - db-postgres-vacuum
---
# PostgreSQL transaction ID가 오래된 테이블에서 wraparound 위험에 가까워질 때 일반 VACUUM 부하와 어떤 신호를 구분하나요?

## 구두 답변

일반 VACUUM 부하는 dead tuple, relation 크기, scan 비용과 같은 정리 축이고, wraparound 위험은 유한한 transaction ID 공간에서 오래된 XID 경계가 계속 뒤처지는 age 축입니다. 변경이 거의 없고 dead tuple가 0에 가까운 작은 테이블도 `relfrozenxid` 기반 transaction age가 높으면 freeze 우선 대상이 될 수 있습니다. 파일이 작다는 사실은 안전성 증명이 아닙니다.

운영에서는 relation별 XID age와 MultiXact age, `age(relfrozenxid)`·`mxid_age(relminmxid)`, autovacuum 진행·마지막 실행, oldest transaction과 worker 대기를 함께 봅니다. age가 계속 늘고 anti-wraparound 작업이 시작되지 않으면 bloat 경보보다 우선 대응합니다. 오래된 snapshot이나 idle transaction이 경계를 붙잡는지도 확인합니다.

반대로 dead tuple가 많은 hot table은 age가 낮아도 I/O·bloat 비용이 큽니다. 둘을 “VACUUM이 느리다”로 합치지 않습니다. 정확한 임계와 설정은 배포 PostgreSQL 버전으로 확인하고, 임의 파일 삭제나 VACUUM FULL을 wraparound 해결책으로 사용하지 않겠습니다.

관측식은 두 identifier 공간을 분리해야 합니다. 일반 XID는 `age(relfrozenxid)`, MultiXact는 `mxid_age(relminmxid)`이며 `age(relminmxid)`로 대체하지 않습니다. 예를 들어 작은 정적 relation에서 dead=0인데 age(relfrozenxid)가 900M으로 증가하면 bloat가 아니라 freeze 지연을 먼저 조사합니다. 반대로 dead tuple가 많은 hot table의 age가 40M이면 I/O와 공간 재사용이 주된 부채일 수 있습니다. 숫자는 설명용이고 실제 보호 임계는 PostgreSQL major와 설정으로 확인합니다.

worker가 실행 중이라는 로그만으로 완료하지 않고 전후 age, `age(relfrozenxid)`·`mxid_age(relminmxid)`, oldest transaction, idle-in-transaction, vacuum progress와 blocker를 저장합니다. `VACUUM FULL`이나 파일 축소는 XID 경계를 해결하지 않으므로 anti-wraparound vacuum의 진행과 차단 원인을 우선 처리합니다.

## 득점 포인트

- age와 dead tuple·파일 크기를 서로 다른 경보 축으로 설명합니다.
- relfrozenxid·relminmxid와 oldest transaction을 함께 관찰합니다.
- 작은 정적 테이블도 age 위험이 있을 수 있음을 설명합니다.
- 버전별 임계값을 임의로 단정하지 않습니다.

## 감점 포인트

- dead tuple가 적으니 wraparound 위험도 없다고 합니다.
- VACUUM FULL이나 파일 축소가 freeze를 대신한다고 합니다.
- worker가 실행 중이면 age가 반드시 줄었다고 합니다.

## 더 파고들 거리

- anti-wraparound vacuum을 막는 오래된 transaction을 어떤 세션 상태로 찾겠습니까?
- 일반 bloat와 XID age가 동시에 높은 relation의 I/O 예산을 어떻게 정하겠습니까?

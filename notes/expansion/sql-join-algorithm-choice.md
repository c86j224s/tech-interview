---
id: sql-join-algorithm-choice
title: Nested loop·Hash·Merge Join 선택
topic: 데이터베이스
summary: 입력 크기·정렬 상태·메모리·등가 조건과 인덱스 유무를 넣어 세 join 알고리즘의 반복 읽기·build/probe·정렬 비용을 비교합니다.
questionIds: []
prerequisites:
  - query-plan-evidence
  - indexes
related:
  - relational-fetch
  - sql-result-semantics
reviewedAt: '2026-09-19'
---
# Nested loop·Hash·Merge Join 선택

조인의 논리 결과와 그 결과를 만드는 물리 알고리즘은 분리해서 설명해야 합니다. `orders.customer_id = customers.id`라는 조건과 `LEFT JOIN`의 NULL 보존 규칙은 같은데도, 실행기는 작은 바깥 입력을 인덱스로 반복 탐색할지, 한 입력을 해시 구조로 만들지, 정렬된 두 스트림을 병합할지 다르게 선택할 수 있습니다. PostgreSQL 18 planner 문서는 가능한 경로를 비용으로 비교한다고 설명하며, 여기서 말하는 숫자는 특정 서버의 밀리초가 아니라 읽기·정렬·메모리의 중간 상태를 추적한 설명용 계산입니다.

## 논리 결과와 역할

등가 조인에서 같은 키를 가진 행은 모두 연결됩니다. 고객 한 명에 주문이 세 건이면 고객 행이 세 번 출력되는 것은 nested loop의 결함이 아니라 조인의 카디널리티입니다. `INNER JOIN`은 불일치 행을 버리고 `LEFT JOIN`은 왼쪽을 보존합니다. 따라서 알고리즘을 바꾸기 전에 예상 결과 행 수를 고정해야 합니다.

물리 계획의 역할은 알고리즘마다 다릅니다. nested loop의 outer는 반복의 기준이고 inner는 매 반복 접근 대상입니다. hash join의 build는 해시 테이블을 만들 입력이며 probe는 버킷을 조회하는 입력입니다. merge join은 두 입력이 조인 키에 대해 호환되는 순서로 공급되어야 하므로 양쪽 스트림의 정렬 보장이 핵심입니다. planner 페이지가 말하는 선택은 이 역할과 비용 모델의 결합이지 알고리즘별 상수의 보장이 아닙니다.

## Nested loop와 선택적 인덱스

단순한 비용 모델은 `outer_rows × inner_lookup_cost`입니다. 최근 주문 필터가 outer를 10행으로 줄이고 `customers(id)` 인덱스가 한 고객을 찾는다면, inner가 1천만 행이어도 전체를 읽을 필요 없이 최대 10번 probe할 수 있습니다. 설명용으로 probe 하나가 인덱스 3페이지와 heap 1페이지를 읽는다고 놓으면 `10 × (3+1) = 40`페이지 접근입니다. 필요한 컬럼이 인덱스에 포함되어 heap 방문이 사라지면 모델은 더 작아집니다.

이 이점은 outer 추정이 맞을 때만 유지됩니다. 실제 outer가 10만 행이면 같은 가정은 `100000 × 4 = 400000`페이지 접근으로 바뀝니다. 키가 한 페이지에 몰려 캐시가 잘 맞는지, 매번 다른 페이지를 읽는지에 따라 실제 비용은 달라집니다. 즉 inner가 크다는 사실만으로 nested loop를 배제하지 말고 outer의 실제 행 수, lookup 선택도, random read와 캐시 상태를 함께 봐야 합니다.

## Hash join의 build와 probe

등가 조건에서는 한 입력을 build로 읽어 키별 버킷을 만들고 다른 입력을 probe하며 후보를 비교합니다. 예상 build가 1만 행, 평균 payload가 200바이트라면 payload만 `10000 × 200 = 2,000,000`바이트, 약 1.9MiB입니다. 그러나 해시 버킷, 튜플 헤더, 정렬되지 않은 저장 구조, 필요한 추가 컬럼이 있으므로 실제 메모리는 2MB로 확정되지 않습니다. 작은 쪽을 build로 두려는 이유도 행 수뿐 아니라 행 폭과 중복을 함께 줄이기 위해서입니다.

build가 메모리 예산을 넘으면 partition별 임시 저장과 재처리가 생길 수 있습니다. 예상 1만 행이 실제 1천만 행으로 늘면 자료구조와 임시 I/O가 동시에 커집니다. 이때 “hash는 한 번 읽으므로 안전하다”라고 말할 수 없습니다. PostgreSQL에서는 `EXPLAIN (ANALYZE, BUFFERS)`의 실제 행 수와 Hash 노드의 `Batches`, `Memory Usage`를 확인하고, Batches가 1보다 큰 경우 디스크 사용 가능성을 해석합니다. 이 페이지는 해시 노드가 디스크 사용량 자체를 항상 보여준다고 정의하지 않으므로 `temp read/write`라는 필드를 모든 엔진의 보편 규칙으로 쓰지 않습니다.

## Merge join의 정렬 스트림

양쪽 입력이 같은 조인 표현식에 대해 계획이 요구하는 호환 pathkeys로 공급되면 merge join은 두 포인터를 전진시킬 수 있습니다. 왼쪽이 `1,2,2,5`, 오른쪽이 `2,2,3,5`라면 1은 버리고, 키 2의 equal-key run을 모아 `2 × 2 = 4`행을 내고, 3을 버린 뒤 5를 연결합니다. 정렬이 이미 보장되면 입력을 한 번씩 소비하는 형태가 매력적입니다.

“현재 결과가 정렬되어 보인다”는 것은 보장이 아닙니다. 인덱스의 선행 컬럼, 방향, 조인 표현식, 필터가 pathkeys를 만족하는지 계획에서 확인해야 합니다. 한쪽만 정렬되거나 요구된 정렬 계약이 없으면 sort가 먼저 붙습니다. 복합 인덱스의 혼합 ASC/DESC와 NULL 순서 같은 세부 호환은 대상 엔진·버전 문서를 확인해야 하며, 여기의 planner 출처만으로 모든 규칙을 단정하지 않습니다.

## 선택도와 범위 조건

A가 10행, B가 1천만 행일 때 위의 4페이지 probe 가정은 nested loop의 설명값 40을 줍니다. A가 1천만 행으로 늘면 4천만 페이지 모델이 되어 순차적으로 큰 입력을 읽는 hash가 상대적으로 유리할 수 있습니다. 양쪽이 각각 500만 행이고 이미 정렬되어 결과도 순서대로 소비된다면 merge는 hash 테이블을 유지하지 않고 스트림을 처리하는 선택지가 됩니다. 반대로 양쪽을 정렬해야 한다면 두 번의 `N log N` 성격 비용과 sort 메모리 압박이 추가됩니다.

범위 조건 `a.start_at <= b.point_at AND b.point_at < a.end_at`는 equality hash key 하나로 해결되지 않습니다. 정렬 경계, 범위 인덱스, nested loop와 residual filter를 비교해야 합니다. equality 조건으로 후보를 줄인 뒤 범위 조건을 residual로 검사하는 계획도 있지만 residual 후보가 많으면 hash가 범위 선택성 문제를 없애지 못합니다. 조인 알고리즘 이름보다 조건이 후보를 얼마나 줄이는지가 중요합니다.

## 실행 계획의 검증 절차

먼저 동일한 논리 결과를 보장하는 fixture를 만든 뒤 outer 10행/10만 행, 균등 키/한 키 집중, 인덱스 있음/없음, 정렬 보장/무정렬을 분리합니다. 계획에서는 estimated rows와 actual rows, nested loop의 loops, hash의 Batches와 Memory Usage, merge 앞 sort 유무를 비교합니다. PostgreSQL의 cost 숫자는 시간 단위가 아니므로 실제 `EXPLAIN ANALYZE` 결과의 버퍼와 실행 시간을 별도로 기록해야 합니다.

행 폭을 줄이는 projection, 통계 갱신, 적절한 인덱스는 알고리즘보다 먼저 검토할 수 있습니다. 작은 outer에 맞춘 선택이 큰 parameter에서 반복 lookup 폭발을 일으키면 한 플랜을 영구 고정하지 말고 분포별 계획과 완화 기준을 남깁니다. 실행되지 않은 쿼리 예시는 설명용이며 이 환경에서 PostgreSQL 서버 실행 성공을 주장하지 않습니다.

```diagram
{"title":"Join 선택의 입력 계약","caption":"outer 크기, equality 여부, 정렬 보장이 서로 다른 물리 경로와 비용을 만듭니다.","rows":[[{"id":"inputs","label":"입력 계약","detail":["행 수·폭","조건·정렬"]}],[{"id":"loop","label":"Nested loop","detail":["outer 반복","index probe"]},{"id":"hash","label":"Hash join","detail":["build / probe","batch 가능"]},{"id":"merge","label":"Merge join","detail":["ordered streams","run 병합"]}],[{"id":"evidence","label":"계획 증거","detail":["actual rows·loops","sort·buffers"]}]],"edges":[{"from":"inputs","to":"loop","label":"작은 outer"},{"from":"inputs","to":"hash","label":"등가 조건"},{"from":"inputs","to":"merge","label":"pathkeys"},{"from":"loop","to":"evidence","label":"반복 lookup"},{"from":"hash","to":"evidence","label":"Batches·memory"},{"from":"merge","to":"evidence","label":"sort 여부"}]}
```

## 비용·출처·한계

정리하면 작은 outer와 선택적 inner 인덱스는 nested loop, equality와 메모리에 맞는 작은 build는 hash, 양쪽 ordered stream은 merge를 유도합니다. 이것은 선택 규칙이 아니라 검증할 가설입니다. 근거는 PostgreSQL 18 planner 문서(https://www.postgresql.org/docs/18/planner-optimizer.html), table expressions(https://www.postgresql.org/docs/18/queries-table-expressions.html), EXPLAIN Hash 관찰 항목(https://www.postgresql.org/docs/18/using-explain.html)입니다. planner 페이지는 spill 임계값과 엔진 중립 grant를 정의하지 않으므로 그 수치는 이 글에서 만들지 않았습니다. 다른 DBMS를 적용할 때는 동일한 알고리즘 이름만 보고 필드와 비용 모델을 이식하지 않습니다.

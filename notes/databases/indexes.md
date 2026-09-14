---
id: indexes
title: 인덱스의 탐색·정렬·행 접근
topic: 데이터베이스
summary: 복합 B-tree의 정렬 순서와 covering·선택도·실행 계획을 실제 질의에서 연결합니다.
questionIds: [btree-hash-index, composite-index-column-order, clustered-secondary-index, db-query-plan-regression, db-covering-index-visibility, db-partial-index-predicate, db-expression-index-sargability, db-keyset-pagination, db-statistics-correlation]
---

# 인덱스의 탐색·정렬·행 접근

## 인덱스는 읽기를 공짜로 만들지 않습니다

B-tree 계열 인덱스는 정렬된 키를 따라 시작 범위를 찾고 연속 구간을 읽게 합니다. 인덱스에서 행 위치를 찾은 뒤 반환 컬럼·가시성을 위해 테이블을 다시 읽을 수도 있습니다. 실제 비용은 탐색·스캔·추가 행 접근·정렬·반환 바이트의 합입니다.

## 복합 키의 순서

`(customer_id, created_at, id)`는 고객별로 묶고, 같은 고객 안에서 시각, 같은 시각 안에서 ID순으로 정렬합니다.

```sql
SELECT id, created_at, total_amount
FROM orders
WHERE customer_id = :customer
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

특정 고객의 구간으로 들어가 필요한 끝부분부터 읽을 수 있는 후보입니다. 하지만 **전체 고객의 최신 주문**을 같은 인덱스로 조회하면 앞선 고객 ID가 고정되지 않아 시각의 전역 순서가 아닙니다. 인덱스 방향·역방향 스캔·정렬 제거는 실제 엔진 계획으로 확인합니다.

## 키셋 페이지의 조건

같은 고객의 다음 페이지는 마지막 `(created_at,id)`보다 작은 키를 찾습니다. 같은 시각의 주문을 구분하는 ID가 있어야 누락·중복 경계를 정할 수 있습니다.

```text
created_at < last_time
OR (created_at == last_time AND id < last_id)
```

정렬 방향이 섞이면 비교 방향도 맞춰야 합니다. 키셋은 큰 OFFSET 비용을 줄이는 접근 방식이지, 여러 HTTP 요청의 데이터를 고정 snapshot으로 만드는 기능은 아닙니다. 정렬 키 수정·삭제·복제 지연의 관찰 계약을 별도로 정합니다.

## 선택도와 lookup

선택 조건이 좁으면 인덱스가 유리할 수 있지만 많은 행을 찾아 각각 원본 페이지를 읽으면 scan보다 비쌀 수 있습니다. seek가 보인다고 항상 빠르고 scan이면 항상 느리다고 판단하지 않습니다.

covering은 필요한 값이 인덱스에 있다는 뜻입니다. PostgreSQL처럼 MVCC 가시성 확인 때문에 heap 접근이 남을 수 있는 엔진도 있습니다. INCLUDE·클러스터링 키·heap locator의 차이를 제품별로 확인합니다.

## 특수 인덱스의 조건

- 부분 인덱스: `status='pending'` 같은 작은 집합만 저장합니다. 질의가 그 집합 안이라는 것을 엔진이 판단할 수 있어야 합니다.
- 함수·표현식 인덱스: `lower(email)` 같은 반복 변환을 저장합니다. 정규화·collation·함수 제약과 질의 표현을 맞춥니다.
- 해시 인덱스: 동등 비교에 맞지만 대소 순서를 보존하지 않아 일반적인 범위·정렬을 대신하지 않습니다.

## 실행 계획 읽는 순서

1. 입력·바인드·격리·데이터 크기를 고정합니다.
2. 추정 행과 실제 행의 차이를 봅니다.
3. 읽은 행과 최종 반환 행, lookup·sort·spill을 확인합니다.
4. CPU·I/O·잠금·연결 대기를 구분합니다.
5. 작은 고객·큰 고객·cold/warm cache·동시 쓰기로 재검증합니다.

컬럼 통계가 최신이어도 도시와 우편번호처럼 상관된 조건은 독립 선택도 가정 때문에 틀릴 수 있습니다. 통계·쿼리 구조·인덱스 중 무엇이 원인인지 구분합니다.

## 쓰기 비용과 검증

인덱스마다 삽입·삭제·갱신 시 페이지·로그·메모리를 사용합니다. 반환 컬럼을 무조건 전부 넣으면 읽기 lookup은 줄어도 쓰기와 cache가 악화될 수 있습니다. 온라인 생성도 시작·종료 잠금·디스크·로그 비용을 없애지 않습니다.

작은 가상 주문 테이블에 고객별 편중을 만들고 인덱스 유무·순서를 바꾸어 결과와 실제 읽기량을 비교해 보세요. 반환 결과가 같은지 먼저 확인한 뒤 성능을 판단합니다.

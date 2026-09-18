---
id: sql-result-semantics
title: SQL NULL·존재 조회·Window 순위의 결과 의미
topic: 데이터베이스
summary: UNKNOWN·NOT IN·NOT EXISTS·LEFT JOIN과 집계의 NULL을 계산하고 ROW_NUMBER·RANK·DENSE_RANK의 동점·페이지 의미를 설명합니다.
questionIds: [db-null-three-valued-logic, db-exists-vs-join, db-window-function-ranking]
---

# SQL NULL·존재 조회·Window 순위의 결과 의미

SQL 결과는 문법을 읽는 즉시 직관으로 확정되지 않습니다. NULL은 참·거짓과 다른 UNKNOWN을 만들고, JOIN은 자식 수만큼 행을 늘리며, window 함수는 행을 줄이지 않은 채 순위를 붙입니다. 작은 입력을 손으로 먼저 계산하면 쿼리 튜닝 전에 결과 의미가 맞는지 검증할 수 있습니다.
기본 계산의 순서는 `NULL`이 섞인 비교를 먼저 UNKNOWN으로 평가하고, 마지막에 WHERE가 TRUE만 통과시키는 것입니다. 예를 들어 값이 `2, 1, NULL`인 세 행에 `x NOT IN (1, NULL)`을 적용하면 세 행 모두 통과하지 않습니다. 이 입력을 작은 임시 집합으로 재현하면 COALESCE로 의미를 숨기지 않고 원인을 확인할 수 있습니다.

## WHERE의 FALSE·UNKNOWN 제외와 NULL 의미

SQL의 NULL은 알 수 없거나 없는 정보를 표현하며 일반적인 등호 비교에 UNKNOWN을 만들 수 있습니다. `x = NULL` 대신 IS NULL로 부재를 검사합니다. WHERE는 TRUE인 행만 남기므로 FALSE와 UNKNOWN이 모두 제외됩니다.

x=2에서 `x NOT IN (1,NULL)`을 생각하면 `x<>1 AND x<>NULL`이 TRUE AND UNKNOWN이 되어 UNKNOWN입니다. 따라서 기대했던 2도 나오지 않습니다. x=1은 FALSE AND UNKNOWN이므로 FALSE입니다. NULL을 실제 0이나 빈 문자열로 COALESCE하는 것은 데이터 의미를 바꾸므로 해결책으로 무조건 쓰지 않습니다.

| 식 | 결과 |
| --- | --- |
| TRUE AND UNKNOWN | UNKNOWN |
| FALSE AND UNKNOWN | FALSE |
| TRUE OR UNKNOWN | TRUE |
| FALSE OR UNKNOWN | UNKNOWN |
| NOT UNKNOWN | UNKNOWN |

빈 subquery에 대한 IN·NOT IN과 NULL 원소가 있는 subquery는 다릅니다. COUNT(*)는 행을 세고 COUNT(column)은 해당 열의 non-NULL 값을 셉니다. GROUP BY·DISTINCT에서 NULL 묶음 처리와 일반 `NULL = NULL` 비교도 같은 연산이 아닙니다.

## 존재 판정과 관계 결합의 행 증식

회원 A에 주문 세 개가 있으면 회원과 주문의 JOIN 결과에는 A가 세 번 나올 수 있습니다. 필요한 것이 주문 컬럼이 아니라 구매 이력 존재라면 EXISTS로 의미를 직접 표현할 수 있습니다.

```sql
SELECT m.id
FROM members AS m
WHERE EXISTS (
    SELECT 1 FROM orders AS o WHERE o.member_id = m.id
)
ORDER BY m.id;
```

옵티마이저는 semi join 같은 계획을 사용할 수 있지만 문법 이름이 항상 같은 물리 알고리즘을 보장하지 않습니다. DISTINCT로 중복을 없애는 대안도 있으나 불필요한 넓은 행·정렬·해시 비용과 원래 의미를 봅니다. 최신 주문 금액까지 필요하면 EXISTS만으로는 부족합니다.

```diagram
{"title":"존재 판정은 부모 행 수를 자식 수만큼 늘리지 않습니다","caption":"화살표는 관계와 판정입니다. 주문이 세 건인 A도 존재 결과에서는 회원 한 행이며, 자식의 실제 값이 필요하면 별도 결합이 필요합니다.","rows":[[{"id":"member","label":"회원 A"}],[{"id":"orders","label":"관련 주문 3건"}],[{"id":"exists","label":"EXISTS = TRUE"}],[{"id":"row","label":"회원 A 한 행 반환"}]],"edges":[{"from":"member","to":"orders","label":"관련 행 탐색"},{"from":"orders","to":"exists","label":"하나 이상 존재"},{"from":"exists","to":"row","label":"부모 필터 통과"}]}
```

## NOT EXISTS·LEFT JOIN의 NULL 처리 의미

`NOT EXISTS`의 상관 등호에서 `m.id`가 NULL이면 `o.member_id = m.id`가 TRUE가 되지 않으므로 관련 주문이 없다고 판단되어 `NOT EXISTS`가 참이 될 수 있습니다. NULL을 미배정으로 포함할지는 도메인 규칙으로 정하고, `NOT IN`과 `NOT EXISTS`를 서로 단순 치환해 모든 NULL 의미가 같아진다고 보지 않으며 필요하면 엔진의 null-safe equality 지원을 확인합니다.

LEFT JOIN으로 자식 없는 부모를 남긴 뒤 WHERE에서 `child.status='paid'`를 적용하면 NULL 확장 행이 제외됩니다. 모든 부모를 유지하고 paid 자식만 결합하려면 조건을 ON에 두어 원하는 결과 집합을 먼저 정해야 하며, 실행 계획 튜닝으로 이 의미 차이를 고칠 수는 없습니다.

## ROW_NUMBER·RANK·DENSE_RANK의 동점·순위 번호

점수 100,100,90,80을 한 부서에서 내림차순 정렬하면 다음과 같습니다.

| 점수 | ROW_NUMBER | RANK | DENSE_RANK |
| --- | --- | --- | --- |
| 100 | 1 | 1 | 1 |
| 100 | 2 | 1 | 1 |
| 90 | 3 | 3 | 2 |
| 80 | 4 | 4 | 3 |

정확히 세 행이면 유일 보조 키를 포함한 ROW_NUMBER를 사용할 수 있습니다. 상위 세 distinct 점수면 DENSE_RANK<=3이라 네 행이 나올 수 있고, 경쟁 순위 RANK<=3이면 세 행입니다. 제품의 동점 포함 의미가 먼저입니다. RANK의 ORDER BY에 유일 ID를 추가하면 동점 그룹 자체가 사라질 수 있으므로 출력 결정성의 키와 순위 동점 정의를 구분합니다.

```sql
WITH ranked AS (
    SELECT department_id, id, score,
           DENSE_RANK() OVER (
               PARTITION BY department_id ORDER BY score DESC
           ) AS position
    FROM employees
)
SELECT department_id, id, score
FROM ranked
WHERE position <= 3
ORDER BY department_id, score DESC, id ASC;
```

PARTITION BY는 원래 행을 부서별 계산 집합으로 나누며 GROUP BY처럼 행을 줄이는 것이 아닙니다. window ORDER BY는 계산 순서이지 최종 출력 순서 보장이 아니므로 마지막 ORDER BY를 둡니다. QUALIFY 지원이 없는 엔진은 위처럼 바깥 쿼리에서 필터합니다. NULL 점수의 순서·혼합 방향·큰 부서의 정렬 메모리와 spill은 제품별로 확인합니다.

검증 표에는 최소한 부모 한 행에 자식 0·1·3건, 비교 열 NULL, 빈 subquery, 동점 점수 2건을 넣습니다. 예상 행 수와 각 열의 NULL 여부를 먼저 적은 뒤 실제 결과를 비교하면 “중복 제거가 필요하다”와 “존재 판정이 필요하다”를 구분할 수 있습니다. window 결과는 계산용 ORDER BY와 최종 표시용 ORDER BY를 별도로 확인합니다.

## NULL·빈 집합·중복·동점별 기대 결과 행

NULL·빈 집합·중복·자식 없음·여러 자식·동점·한 명 부서로 기대 행을 계산하고 실제 SQL 결과와 대조합니다. 보상 확정은 변하는 현재 조회가 아니라 기준 snapshot·정렬 정책·멱등 원장에 연결해야 합니다. 이 노트의 SQL은 공통 구조 예제이며 모든 DB 엔진의 문법·NULL 순서·계획을 동일하게 보장하지 않습니다.

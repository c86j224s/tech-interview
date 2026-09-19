---
id: sql-recursive-cte-cycle
title: 재귀 CTE 종료·순환 처리
topic: 데이터베이스
summary: >-
  재귀 CTE의 anchor·recursive term·중복 제거와 방문 경로를 구분하고 순환 그래프에서 종료·경로·depth 제한을
  설계합니다.
questionIds: []
prerequisites:
  - graph-search
  - sql-result-semantics
related:
  - topological-sort
  - query-plan-evidence
reviewedAt: '2026-09-19'
---
# 재귀 CTE 종료·순환 처리

재귀 CTE는 한 번의 SELECT가 아니라 초기 행을 만들고 그 결과를 반복적으로 확장하는 질의입니다. `WITH RECURSIVE`의 anchor term과 recursive term을 구분하지 않으면 순환이 왜 멈추는지, 같은 정점의 서로 다른 경로를 왜 보존해야 하는지 설명하기 어렵습니다. PostgreSQL 18 `queries-with` 문서는 재귀 평가, `UNION` 중복 제거, `SEARCH` 결과 순서, `CYCLE`의 표시와 확장 중단을 설명합니다. 여기서는 그 의미를 조직 계층과 그래프 예로 좁혀서, 종료와 업무적으로 안전한 mutation을 별개의 판단으로 다룹니다.

## Anchor와 working set

다음과 같은 개념을 사용합니다. `working_0={A}`는 anchor가 만든 최초 집합이고, recursive term은 현재 working set에 연결된 간선을 찾아 다음 후보를 만듭니다. A→B, B→C라면 `working_1={B}`, `working_2={C}`입니다. 출력 결과 전체와 다음 회차에 소비할 working set을 같은 것으로 생각하면 중복 제거와 cycle 검사가 흐려집니다.

```sql
WITH RECURSIVE walk(node, depth) AS (
  SELECT 'A'::text, 0
  UNION ALL
  SELECT e.child, w.depth + 1
  FROM edges e JOIN walk w ON e.parent = w.node
)
SELECT * FROM walk;
```

이 코드는 구조를 보여 주는 설명용 SQL이며 여기서 실제 서버 실행을 수행했다고 주장하지 않습니다. 최종 행 순서는 recursive term에 적은 순서나 현재 실행에서 우연히 보이는 순서가 아니라 바깥 `ORDER BY` 또는 명시적 탐색 순서 키로 결정해야 합니다.

## UNION과 UNION ALL

`UNION ALL`은 recursive term이 만든 행을 그대로 다음 반복에 전달합니다. A→B→C→A이면 node와 depth를 함께 출력할 때 A(0), B(1), C(2), A(3), B(4)처럼 계속 새 행이 생길 수 있습니다. path membership도 depth cap도 없으면 입력 cycle이 종료를 막습니다.

`UNION`은 이미 결과에 들어간 것과 모든 출력 컬럼이 같은 행을 제거합니다. node만 출력하는 단순 도달성에서는 A를 다시 만든 행이 제거되어 cycle 확장이 억제될 수 있습니다. 그러나 `depth`나 `path`를 출력하면 `[A]`와 `[A,B,C,A]`는 서로 다른 행입니다. 따라서 UNION이 모든 cycle을 해결한다고 할 수 없습니다. 전체 행 기준 중복 제거와 “정점 A는 이미 방문했다”라는 도메인 visited 집합은 서로 다른 계약입니다.

## 경로와 cycle 표시

경로를 배열로 유지하면 후보를 추가하기 전에 방문 여부를 검사할 수 있습니다. PostgreSQL식으로 쓰면 다음처럼 `e.child = ANY(w.path)`를 cycle 신호로 만들 수 있습니다.

```sql
WITH RECURSIVE walk(node, path, depth, cycle) AS (
  SELECT 'A'::text, ARRAY['A'::text], 0, false
  UNION ALL
  SELECT e.child, w.path || e.child, w.depth + 1,
         e.child = ANY(w.path)
  FROM edges e JOIN walk w ON e.parent = w.node
  WHERE NOT w.cycle AND w.depth < 100
)
SELECT node, path, depth, cycle FROM walk;
```

A→B→C→A에서 회차별 상태는 다음과 같습니다.

|회차|후보|path|판정|
|---:|---|---|---|
|0|A|[A]|anchor|
|1|B|[A,B]|확장|
|2|C|[A,B,C]|확장|
|3|A|[A,B,C,A]|cycle=true, 이후 확장 차단|

cycle 행 자체를 결과에 남기면 운영 오류를 진단할 수 있고, 완전히 제외하면 정상 도달 집합만 깔끔하게 얻습니다. 두 정책을 섞지 말고 `cycle_nodes`와 `reachable_nodes`를 별도로 정의합니다.

## DAG 중복과 경로 의미

DAG의 A→B, A→C, B→D, C→D는 cycle이 아니지만 D에 두 번 도달합니다. 정점 존재 여부만 필요하면 node 기준 visited를 적용해 D를 한 번 남기는 편이 맞습니다. 반면 의존성 경로, 권한 상속 경로, 감사 설명이 필요하면 `[A,B,D]`와 `[A,C,D]`를 모두 보존해야 합니다. 이때 `UNION`을 무조건 선택하면 경로 열거 요구를 잃을 수 있습니다.

중복 제거 키는 결과 의미로 정합니다. `(tenant_id,node_id)`가 정점의 키라면 한 테넌트의 7번과 다른 테넌트의 7번을 같은 방문으로 비교하지 않습니다. NULL 부모를 루트로 보는지, NULL node를 유효한 정점으로 보는지도 먼저 결정해야 합니다. 이런 식별 계약이 빠지면 올바른 그래프에서도 cycle 또는 중복으로 오판합니다.

## Depth guard와 정상 깊이

`depth < 100`은 안전망이지 cycle 검출의 대체물이 아닙니다. 정상 조직 계층의 관측 최대 깊이가 12라면 100은 비정상 입력을 제한하는 합리적 후보일 수 있지만, 100을 넘은 행을 “하위 없음”으로 숨기면 데이터 손실이 됩니다. `depth_limit_exceeded`를 별도 상태로 반환하여 검수 또는 재처리 대상으로 보내야 합니다.

반대로 path를 매 행 배열로 복사하면 깊이에 따라 행 폭과 메모리가 커집니다. 긴 그래프에서는 엔진의 `CYCLE` 지원, 별도 visited 관계, 사전 정제된 계층 테이블을 검토할 수 있지만 재귀 깊이와 문법은 대상 엔진·버전별로 확인합니다. path를 문자열로 직렬화하는 경우 `2`와 `20`의 접두 관계, escaping, collation 문제가 생기므로 단순 문자열 비교를 방문 증명으로 쓰지 않습니다.

## 표시 순서와 SEARCH

재귀 평가가 breadth-first처럼 동작한다는 사실과 결과가 BFS 순서로 표시된다는 사실은 다릅니다. PostgreSQL 문서는 `SEARCH DEPTH FIRST`나 `SEARCH BREADTH FIRST`가 결과 정렬에 사용할 순서 열을 계산한다고 설명하며, 최종 출력에서는 그 열을 `ORDER BY`해야 합니다. 수동으로 만든다면 BFS형은 `ORDER BY depth, sibling_key, node_id`, DFS형은 배열 path 또는 고정 폭 path key를 사용할 수 있습니다.

루트 1의 자식 2,3과 손자 4,5에서 `depth`만 정렬하면 같은 깊이의 형제 순서는 결정되지 않습니다. `path=[1,2]`, `[1,3]`, `[1,2,4]`처럼 유일한 순서 키를 구성하고 바깥 `ORDER BY`를 둡니다. export와 pagination이 같은 순서를 요구한다면 node ID 같은 tie-breaker를 포함해야 합니다.

## 변경문 경계와 검증

재귀 CTE 결과를 즉시 `DELETE`의 대상이라고 믿지 않습니다. 먼저 도달 집합, cycle 집합, depth 초과 집합, 권한 밖 집합을 분리하고 `SELECT DISTINCT tenant_id,node_id`로 실제 정점 후보를 dedupe합니다. A→B, A→C, B→D, C→D에서 D가 두 path로 나타나도 delete 대상은 한 행이어야 합니다.

그 다음 외래키가 `RESTRICT`인지 `CASCADE`인지, 자식부터 삭제해야 하는지, 동시 transaction이 새 간선을 추가할 수 있는지 점검합니다. 읽기 결과를 기록하고 mutation transaction 안에서 snapshot·권한·FK 영향을 다시 확인합니다. 재귀가 종료했다는 사실은 외래키와 동시성 안전성을 증명하지 않으므로, 부분 실패 후 재시도와 감사 로그까지 테스트해야 합니다.

```diagram
{"title":"재귀 CTE의 종료 계약","caption":"working set 확장, 방문 상태, depth 정책, mutation 경계가 각각 다른 안전성 질문을 만듭니다.","rows":[[{"id":"anchor","label":"Anchor","detail":["초기 정점","working₀"]}],[{"id":"expand","label":"Recursive term","detail":["간선 후보","다음 회차"]}],[{"id":"state","label":"방문·depth 상태","detail":["cycle 표시","상한 분류"]}],[{"id":"result","label":"결과 집합","detail":["도달·경로","보류 분리"]}],[{"id":"mutation","label":"변경 경계","detail":["distinct key","FK·권한"]}]],"edges":[{"from":"anchor","to":"expand","label":"working set"},{"from":"expand","to":"state","label":"후보 생성"},{"from":"state","to":"result","label":"통과·차단"},{"from":"result","to":"mutation","label":"검증 후 연결"}]}
```

## 출처와 비용 한계

출처는 PostgreSQL 18 `WITH` 문서(https://www.postgresql.org/docs/18/queries-with.html)입니다. 이 원문은 anchor/recursive term, `UNION` 중복 제거, `SEARCH` 순서 열, `CYCLE` 확장 중단의 근거로 읽었습니다. 다른 엔진의 기본 recursion limit, `CYCLE` 문법, recursive CTE materialization과 mutation 지원은 별도 확인이 필요합니다. 설명용 SQL과 손계산은 이 환경에서 실행된 성공 결과가 아니며, 실제 운영에서는 작은 fixture로 결과·잠금·삭제 영향까지 검증해야 합니다.

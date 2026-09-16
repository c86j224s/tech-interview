---
id: relational-fetch
title: N+1 조회·부모 페이지·요청별 Loader의 경계
topic: 데이터베이스
summary: 요청 단위 왕복과 일대다 행 증폭을 비교하고 부모 ID 선확정·batch 매핑·요청 cache의 권한·신선도·상한을 설명합니다.
questionIds: [db-n-plus-one, one-to-many-limit-parent-page, request-scoped-loader-cache]
---

# N+1 조회·부모 페이지·요청별 Loader의 경계

## 각 SQL이 빨라도 요청 전체는 느릴 수 있습니다

주문 50개를 읽는 쿼리 하나 뒤 각 주문의 고객을 개별 조회하면 51번의 DB 호출이 생깁니다. 개별 실행이 짧아도 네트워크 왕복·풀 점유·파싱·결과 조합이 누적됩니다. 느린 쿼리 목록만 보지 말고 사용자 요청 trace의 SQL 수와 전체 DB 대기를 봅니다.

고객 ID를 모아 제한된 IN 조회로 읽거나 적절한 JOIN·ORM prefetch로 줄일 수 있습니다. 하지만 쿼리 개수 최소화 자체가 목표는 아닙니다. 같은 의미의 결과를 적절한 행·바이트·메모리 비용으로 가져와야 합니다.

## 여러 일대다 JOIN은 결과 행을 곱할 수 있습니다

주문 하나에 상품 10개와 쿠폰 3개가 있고 둘을 별도 조건 없이 동시에 결합하면 30개 결합 행이 생길 수 있습니다. 부모와 고객의 넓은 컬럼이 반복되어 네트워크·정렬·메모리 비용이 커집니다. 애플리케이션에서 dedupe해도 DB와 전송 비용은 이미 지불했습니다.

| 선택 | 적합한 조건 | 확인할 비용 |
| --- | --- | --- |
| 단순 many-to-one JOIN | 부모마다 고객 한 건 | 인덱스·null 관계·행 폭 |
| 여러 one-to-many JOIN | 결합 의미가 실제 필요 | 곱집합·중복 제거·LIMIT |
| 부모 후 자식 batch | 부모 페이지가 작고 명확 | 2회 이상 왕복·snapshot 차이 |
| 요청 loader | 같은 요청의 중복 ID 많음 | 집계 창·정렬 매핑·권한·상한 |

INNER JOIN으로 바꾸면 자식 없는 부모가 사라질 수 있습니다. 고객이 없거나 삭제된 주문을 유지해야 한다면 LEFT JOIN이나 명시적 부재 결과가 필요합니다.

## LIMIT 전에 부모 페이지를 확정합니다

주문 A에 상품 20개가 있으면 JOIN 결과 LIMIT 20이 A 하나로 끝날 수 있습니다. 부모 20개를 의도했다면 정렬과 커서를 적용해 부모 ID 집합을 먼저 고릅니다. 이후 그 ID들의 자식을 batch로 가져오거나 부모 페이지 서브쿼리를 기준으로 JOIN합니다.

```sql
WITH parent_page AS (
    SELECT id, created_at
    FROM orders
    WHERE tenant_id = :tenant
    ORDER BY created_at DESC, id DESC
    LIMIT 20
)
SELECT p.id, p.created_at, i.product_id, i.quantity
FROM parent_page AS p
LEFT JOIN order_items AS i ON i.order_id = p.id
ORDER BY p.created_at DESC, p.id DESC, i.product_id;
```

이는 `LIMIT`과 named parameter를 사용하는 설명용 문법이므로 SQL Server 등에서는 해당 dialect로 바꿔야 합니다. 결과 행은 20개보다 많을 수 있지만 `parent_page`가 고른 부모는 최대 20개이고, 부모 정렬의 동점 보조 키와 자식 정렬도 각각 지정되어 있습니다. 실제 쿼리에서는 부모·자식의 tenant 제약이 같은 테넌트 범위만 연결하도록 적용되어 교차 테넌트 연결을 막는지 확인해야 합니다.

```diagram
{"title":"페이지의 단위는 부모이고 결합 행은 별도입니다","caption":"화살표는 조회 단계입니다. 부모 20개를 먼저 정해 자식 수가 부모 페이지 크기를 바꾸지 않도록 합니다.","rows":[[{"id":"filter","label":"권한·필터·부모 정렬"}],[{"id":"page","label":"부모 ID 최대 20개 확정"}],[{"id":"batch","label":"관련 자식 제한 batch 조회"}],[{"id":"assemble","label":"원래 부모 순서로 조합"}]],"edges":[{"from":"filter","to":"page","label":"페이지 경계"},{"from":"page","to":"batch","label":"해당 ID 집합"},{"from":"batch","to":"assemble","label":"부재·여러 자식 보존"}]}
```

두 쿼리 사이 부모 삭제·자식 변경이 가능하면 고정 snapshot이 필요한지 정합니다. 쿼리를 두 번 실행한다고 자동으로 같은 시점의 관계가 되는 것은 아닙니다. 정확한 목록 고정은 transaction 격리·snapshot·버전 계약과 연결됩니다.

## Loader는 요청 범위의 중복 조회를 합칩니다

한 요청에서 고객 ID A가 여러 번 필요하면 요청별 cache와 batch loader로 한 번만 읽을 수 있습니다. DB의 IN 결과 순서는 입력 ID 순서와 같지 않을 수 있으므로 key→결과 맵을 만들고 원래 요청 순서로 반환합니다. 부재·오류·중복 ID를 각각 처리합니다.

cache key에는 tenant·권한 범위·필요한 표현을 포함하거나 요청 문맥으로 안전하게 고정해야 합니다. 전역 loader 하나로 사용자 데이터를 섞지 않습니다. 요청 중 직접 갱신한 데이터를 다시 읽을 때 stale cache를 허용할지 clear·prime할지도 정합니다. 요청 cache가 DB snapshot 격리를 자동 제공하는 것은 아닙니다.

전역 cache는 여러 요청 사이 재사용에 따른 TTL·무효화·회수·버전 문제가 추가됩니다. 요청 종료 때 버리는 loader와 같은 비용·보안 계약이 아닙니다. batch 크기·파라미터 수·반환 바이트·대기 기한에 상한을 둡니다.

## 쿼리 수와 읽기량을 함께 비교합니다

부모 1·20·500개, 같은 고객 반복, 자식 편중, 자식 없음, cold·warm cache를 분리합니다. ORM 옵션이 만든 실제 SQL·계획·읽은 행·반환 행·바이트·연결 보유·p99를 기록합니다. 현재 노트는 조회 설계이며 실제 PostgreSQL·MySQL·SQL Server의 비용을 측정한 결과는 아닙니다.

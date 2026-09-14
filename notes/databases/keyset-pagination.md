---
id: keyset-pagination
title: 키셋 페이지의 전체 순서·서명 커서·Snapshot
topic: 데이터베이스
summary: OFFSET 비용과 복합 경계 조건을 비교하고 혼합 정렬·동점·넓은 키·변경 중 누락·커서 서명과 현재 인가를 설명합니다.
questionIds: [db-keyset-pagination, keyset-mixed-sort-directions, keyset-wide-key-cost, db-keyset-deletion-snapshot, pagination-signed-cursor-scope]
---

# 키셋 페이지의 전체 순서·서명 커서·Snapshot

## 반환 20개를 위해 앞의 10만 개를 버릴 수 있습니다

OFFSET 100000 LIMIT 20은 앞의 결과를 찾아 건너뛰는 비용을 만들 수 있습니다. 적절한 인덱스가 있어도 반환 행 수와 실제 읽은 행 수는 다릅니다. 연속적인 더 보기라면 마지막 정렬 키 다음부터 탐색하는 키셋 접근을 검토할 수 있습니다.

키셋은 깊은 페이지의 접근 범위를 줄이는 방법이지 임의 300번째 페이지 점프·정확한 총 페이지 수·고정 snapshot을 자동 제공하는 것은 아닙니다. 사용자 탐색 요구를 먼저 정합니다.

## 정렬 방향마다 다음 경계의 부등호를 맞춥니다

시각과 ID는 NOT NULL이고 ID는 해당 범위에서 유일하다고 가정합니다. `time DESC, id DESC`의 다음 페이지는 time이 더 작거나 time이 같고 id가 더 작은 행입니다. 혼합 방향이면 ID 비교를 바꿔야 합니다.

| ORDER BY | 다음 페이지 조건 |
| --- | --- |
| time DESC, id DESC | time<t OR (time=t AND id<i) |
| time DESC, id ASC | time<t OR (time=t AND id>i) |
| time ASC, id ASC | time>t OR (time=t AND id>i) |

`(time,id)<(t,i)` 같은 row 비교는 같은 방향의 사전식 순서를 표현할 수 있지만 혼합 정렬에 그대로 쓰면 틀립니다. 엔진이 row comparison을 지원하는지와 NULL 정렬 규칙도 별도로 확인합니다. 앞뒤 페이지 이동은 부등호·읽는 정렬 방향·최종 표시 순서를 함께 맞춥니다.

```sql
SELECT id, created_at
FROM orders
WHERE customer_id = :customer
  AND (created_at < :last_time
       OR (created_at = :last_time AND id > :last_id))
ORDER BY created_at DESC, id ASC
LIMIT :page_size;
```

이는 named parameter·LIMIT을 사용하는 설명용 dialect입니다. 특정 고객 prefix와 시간 DESC·ID ASC를 지원하는 인덱스 후보를 평가하고 실제 plan의 읽기 범위·sort·lookup을 봅니다. 최종 ID 없이 시각만 커서로 쓰면 같은 시각의 행이 경계에서 빠질 수 있습니다.

```diagram
{"title":"같은 시각에서는 보조 키 방향으로 이어집니다","caption":"화살표는 time DESC, id ASC의 출력 순서입니다. 커서 (10,2) 뒤는 (10,3)과 더 작은 시각이며 단순 tuple <와 다릅니다.","rows":[[{"id":"first","label":"(time 12, id 8)"}],[{"id":"cursor","label":"(time 10, id 2) · 커서"}],[{"id":"tie","label":"(time 10, id 3)"}],[{"id":"older","label":"(time 9, id 1)"}]],"edges":[{"from":"first","to":"cursor","label":"시각 내림차순"},{"from":"cursor","to":"tie","label":"동점 ID 오름차순"},{"from":"tie","to":"older","label":"다음 시각"}]}
```

## 유일한 보조 키의 비용도 평가합니다

긴 업무 문자열을 tie-breaker로 쓰면 cursor·서명 입력·인덱스 키 폭·비교 비용이 커집니다. clustering key가 보조 인덱스에 반복되는 엔진에서는 여러 인덱스 비용도 늘 수 있습니다. 짧고 안정된 ID가 같은 전체 순서를 정의할 수 있는지 검토하되 유일성·원래 동점 정책을 잃지 않습니다.

collation·시간 정밀도·직렬화 타입도 cursor와 DB에서 같아야 합니다. DB의 마이크로초 시각을 API에서 밀리초로 잘라 보내면 경계가 바뀔 수 있습니다. 큰 ID를 JavaScript Number로 손실시키지 않도록 문자열 등 정확한 표현을 사용합니다.

## 키셋은 페이지 사이 데이터 변경을 고정하지 않습니다

내림차순에서 이미 본 행의 time이 12에서 8로 바뀌면 커서 뒤에 다시 나올 수 있습니다. 아직 안 본 행이 8에서 12로 움직이면 다음 페이지에서 놓칠 수 있습니다. ID가 유일해도 수정 가능한 주 정렬 키의 이동은 남습니다.

불변 정렬 키는 이 이동을 줄이지만 행 삭제·내용 변경·새 삽입을 snapshot으로 고정하지 않습니다. 시작 시각 상한을 둬도 이후 삭제된 행이나 과거 내용을 복원하지 못합니다. 일반 탐색은 최신 데이터에서 다음 범위를 허용할 수 있고, 감사 보고서는 DB snapshot·저장한 결과 집합·버전 읽기 모델이 필요할 수 있습니다. ID 목록만 저장하면 내용 snapshot까지 고정되는 것은 아닙니다.

긴 DB transaction을 HTTP 페이지 사이에 유지하면 연결·버전 정리·timeout 비용이 큽니다. 별도 보고서 결과를 저장한다면 보관·삭제·현재 권한 회수도 지켜야 합니다.

## 서명은 변조를 막고 현재 권한은 다시 확인합니다

cursor에는 마지막 키·필터 fingerprint·정렬 버전·tenant·필요한 사용자 scope·만료를 묶을 수 있습니다. 서명이나 MAC은 변조 검출이지 암호화가 아니므로 민감 키를 숨겨 주지는 않습니다. 필요하면 암호화 또는 opaque 서버 상태를 선택합니다.

서명이 유효한 옛 cursor라도 사용자의 현재 접근권한이 사라졌다면 거절해야 합니다. 다른 필터·tenant에 cursor를 재사용하지 못하게 하고 길이·페이지 크기·형식·기한을 제한합니다. cursor가 쿼리 인가를 대신하지 않도록 최종 SQL에도 서버 인증 문맥을 유지합니다.

## 기준 정렬과 전체 페이지 합집합을 대조합니다

고정 입력에서 모든 페이지를 이어 붙인 결과를 한 번의 전체 정렬과 비교합니다. 동점·최소/최대 키·혼합 방향·빈 마지막 페이지·중복 cursor를 포함합니다. 그 다음 행 삭제·키 이동·replica 전환을 주입해 문서화한 최신성 범위 안의 결과인지 봅니다.

현재 작업에서 다중 요청 DB snapshot이나 제품별 키셋 plan을 실행하지 않았습니다. 본문은 경계 조건과 결과 의미의 설명이며 실제 성능 수치를 제시하지 않습니다.

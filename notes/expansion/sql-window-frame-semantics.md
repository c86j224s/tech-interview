---
id: sql-window-frame-semantics
title: Window ROWS·RANGE·GROUPS frame
topic: 데이터베이스
summary: 동점과 frame 경계가 누적합·이동집계 결과를 어떻게 바꾸는지 ROWS·RANGE·GROUPS와 EXCLUDE 조건으로 계산합니다.
questionIds: []
prerequisites:
  - sql-result-semantics
related:
  - keyset-pagination
  - indexes
reviewedAt: '2026-09-19'
---
# Window ROWS·RANGE·GROUPS frame

Window 함수는 행을 하나로 줄이는 `GROUP BY`와 달리 원래 행을 유지하면서 현재 행이 참조할 frame을 계산합니다. `ROWS`, `RANGE`, `GROUPS`는 그 frame의 경계를 세는 단위가 다릅니다. 동점(ordering peer)이 있으면 같은 SQL 모양의 누적합이 서로 달라질 수 있으므로 “최근 세 건”과 “최근 세 날짜 그룹”을 같은 표현으로 쓰면 안 됩니다. PostgreSQL 18 window function과 SELECT 문서를 기준으로 설명하되, 다른 dialect의 기본값과 `EXCLUDE` 지원은 별도 확인 대상으로 남깁니다.

## Partition과 peer

`PARTITION BY account_id`는 계정별 계산 집합을 나눕니다. 그 안의 `ORDER BY occurred_at, transaction_id`가 순서를 만들고 frame이 현재 행에 포함할 범위를 정합니다. window ORDER BY는 계산 범위를 결정하지만 SELECT 결과의 화면 순서까지 보장하지 않으므로 바깥 `ORDER BY`를 별도로 둡니다.

peer는 ORDER BY에 사용된 표현식 값이 같은 행입니다. 날짜만 정렬하면 같은 날짜 거래가 peer가 되지만 날짜와 유일 transaction_id를 함께 적으면 모두 다른 peer group이 됩니다. 유일성을 높이는 것이 항상 좋은 것은 아닙니다. 같은 날짜 전체를 동시에 반영해야 하는 리포트라면 동점을 유지해야 하기 때문입니다.

## ROWS의 행 위치

`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`는 현재 행과 물리적 앞 두 행을 포함합니다. 같은 날짜의 금액 10,20,30이 id 순서로 들어오면 누적 결과는 10,30,60입니다. 내부 순서가 30,10,20이면 30,40,60이 됩니다. 전체 합은 60으로 같지만 중간 행의 잔액은 달라집니다.

따라서 `ORDER BY occurred_at`만 둔 `ROWS`는 동점 내부 순서가 데이터 저장·실행 계획에 따라 흔들릴 수 있습니다. `ORDER BY occurred_at, transaction_id`로 결정적인 행 순서를 만들면 재현성은 좋아지지만 peer가 분해됩니다. 행 단위 누적을 원할 때만 이 선택을 하고, 날짜 그룹 단위 요구를 행 단위로 바꾸지 않습니다.

## RANGE의 값 범위

`RANGE`는 행 위치가 아니라 ORDER BY 값과 peer를 기준으로 frame을 잡습니다. PostgreSQL의 기본 frame처럼 `RANGE UNBOUNDED PRECEDING`은 현재 행의 마지막 peer까지 포함할 수 있습니다. 내림차순 점수 100,100,90에 금액 10,20,30을 두면 두 100점 행은 각각 30, 90점 행은 60을 받습니다. 같은 점수 그룹이 한 번에 반영된 결과입니다.

`RANGE BETWEEN 1 PRECEDING AND CURRENT ROW`처럼 offset을 쓰는 경우 ORDER BY 타입과 허용되는 표현식이 엔진별로 제한될 수 있습니다. 숫자 차이와 날짜 간격을 같은 문법으로 가정하지 않습니다. 여러 ORDER BY 컬럼을 추가하면 peer 정의와 offset 가능성도 달라집니다. “최근 7일”과 “최근 7행”은 값 범위와 행 개수라는 서로 다른 요구입니다.

## GROUPS의 peer 단위

`GROUPS`는 현재 peer group에서 앞뒤로 몇 개의 peer group을 이동할지 셉니다. 날짜별 거래가 첫 날 1건, 둘째 날 3건, 셋째 날 2건이고 그룹 합이 10,60,50이라고 하겠습니다. 질문의 “최근 세 그룹”을 현재 그룹 포함으로 해석하면 `GROUPS BETWEEN 2 PRECEDING AND CURRENT ROW`입니다. 둘째 날에는 존재하는 앞 그룹까지 `10+60=70`, 셋째 날에는 `10+60+50=120`이 됩니다.

반면 `GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW`는 최근 두 그룹이며 둘째 날 70, 셋째 날 110입니다. 이 offset을 혼동하면 제목과 SQL의 요구가 어긋납니다. `ROWS 2 PRECEDING`은 셋째 날짜 첫 행에서 앞 두 물리 행만 포함할 수 있어 날짜 그룹 중간을 자릅니다. GROUPS는 그룹 경계를 보존한다는 점이 핵심입니다.

## 기본 frame의 peer 확장

ORDER BY만 둔 aggregate window는 명시적 frame이 없을 때 현재 행의 peer 마지막까지 포함하는 기본 frame을 사용할 수 있습니다. 100,100,90에 10,20,30을 넣으면 기본 결과는 30,30,60이 될 수 있고, 행 순서 누적을 명시한 `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`는 10,30,60입니다.

`last_value`는 기본 frame이 현재 peer까지만 끝나기 때문에 partition 전체의 마지막 값을 기대한 코드에서 특히 놀랍습니다. 전체 partition 끝을 요구하면 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` 같은 명시 범위를 검토합니다. “마지막 값까지 항상 합쳐진다”가 아니라 함수와 frame, dialect를 구분해 읽어야 합니다.

## EXCLUDE의 경계

frame을 고른 뒤에도 현재 행 또는 현재 peer group을 제외할 수 있습니다. `EXCLUDE CURRENT ROW`는 현재 행을 제외하고, `EXCLUDE GROUP`은 현재 행과 peer를 제외하는 의미입니다. `EXCLUDE TIES`와 구체 조합은 PostgreSQL 18 SELECT 문서의 문법을 대상 버전과 대조해야 합니다.

예를 들어 같은 날짜가 세 행인데 현재 날짜 전체를 빼고 이전 그룹만 더하려는 요구를 `ROWS 1 PRECEDING`으로 흉내 내면 앞 그룹의 일부만 남거나 현재 그룹 경계가 깨질 수 있습니다. 제외 단위가 행인지 peer group인지 먼저 정한 뒤 frame unit과 EXCLUDE를 함께 설계합니다.

## 손계산과 검증 fixture

다음 입력을 고정합니다. `(date,id,amount)=(1,10,10),(1,11,20),(1,12,30),(2,20,40)`입니다. 날짜와 id로 ROWS 전체 누적을 계산하면 `10,30,60,100`입니다. 날짜만 ORDER BY한 기본 RANGE는 날짜 1 peer 세 행을 한꺼번에 포함하여 `60,60,60,100`이 됩니다. `GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW`는 첫 날짜 그룹에서 60, 둘째 날짜 그룹에서 `60+40=100`을 반환합니다. 세 그룹 fixture `(1건,3건,2건)`의 그룹 합 `10,60,50`에서는 `2 PRECEDING`이 `70,120`을 줍니다.

검증 표에는 동점 0·1·3개, NULL order key, 빈 partition, 한 행 partition, 같은 그룹 내부의 제외 조건을 포함합니다. NULLS FIRST/LAST 기본과 RANGE offset은 dialect에 따라 다를 수 있습니다. 실제 서버를 실행하지 않은 위 숫자는 손계산이며 적용 전 대상 DB에서 쿼리와 결과를 실행해 대조해야 합니다.

```diagram
{"title":"Frame 경계의 세 단위","caption":"행 위치, ORDER BY 값, peer group offset은 동일한 누적합 요구를 서로 다르게 해석합니다.","rows":[[{"id":"partition","label":"Partition·ORDER BY","detail":["계정 집합","peer 정의"]}],[{"id":"rows","label":"ROWS","detail":["물리 행","2 PRECEDING"]},{"id":"range","label":"RANGE","detail":["값 범위","peer 확장"]},{"id":"groups","label":"GROUPS","detail":["peer group","2 PRECEDING"]}],[{"id":"boundary","label":"Frame 경계","detail":["포함·제외","현재 행"]}],[{"id":"aggregate","label":"Window aggregate","detail":["누적·이동합","결과 검증"]}]],"edges":[{"from":"partition","to":"rows","label":"행 단위"},{"from":"partition","to":"range","label":"값·peer"},{"from":"partition","to":"groups","label":"그룹 수"},{"from":"rows","to":"boundary","label":"행 위치"},{"from":"range","to":"boundary","label":"값 경계"},{"from":"groups","to":"boundary","label":"그룹 경계"},{"from":"boundary","to":"aggregate","label":"frame 적용"}]}
```

## 선택 비용과 출처

업무 단위를 행, 값 범위, peer group 중 하나로 문장화하고 frame을 명시한 뒤 최종 출력 정렬을 별도로 둡니다. 큰 partition에서는 정렬·window 작업 메모리와 spill을 실행 계획으로 확인합니다. frame 변경은 성능만이 아니라 값의 의미를 바꾸므로 기준 결과 표와 함께 리뷰합니다.

근거는 PostgreSQL 18 window functions(https://www.postgresql.org/docs/18/functions-window.html)와 SELECT window clause(https://www.postgresql.org/docs/18/sql-select.html#SQL-WINDOW)입니다. 전자는 peer와 기본 frame 설명에, 후자는 GROUPS offset과 EXCLUDE 의미 확인에 사용했습니다. 다른 DB의 기본 frame, RANGE offset, NULL 정렬, EXCLUDE 지원은 이 출처로 일반화하지 않았습니다.

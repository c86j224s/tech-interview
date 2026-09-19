---
id: toast-threshold-choice
title: PostgreSQL 행의 큰 text/json 값을 TOAST가 inline 대신 외부에 저장하는 이유와 조회 비용은 무엇인가요?
difficulty: 하
category: 데이터베이스
tags:
  - PostgreSQL
  - TOAST
  - large value
  - tuple
related:
  - db-covering-index-visibility
---
# PostgreSQL 행의 큰 text/json 값을 TOAST가 inline 대신 외부에 저장하는 이유와 조회 비용은 무엇인가요?

## 구두 답변

결론부터 말하면 TOAST는 큰 값을 무조건 별도 테이블로 옮기는 기능이 아니라, 하나의 heap tuple이 고정된 page를 넘을 수 없다는 제약을 만족시키는 저장 경로입니다. PostgreSQL은 저장 전략에 따라 attribute를 먼저 압축하고, 그래도 tuple이 크면 TOAST relation의 chunk로 외부화합니다. heap에는 큰 값 전체가 아니라 이를 해석할 pointer 표현이 남을 수 있습니다. 압축 결과가 page에 들어가면 inline에 남을 수도 있으므로 “1MB면 항상 외부 저장”이라고 말하지 않습니다.

`id=42, status, payload=1MB`인 행을 두 질의로 나누면 비용 경계가 보입니다. `SELECT id,status WHERE id=42`는 id 인덱스로 TID를 얻은 뒤 heap에서 작은 컬럼만 확인하는 경로라 payload chunk를 읽지 않을 수 있습니다. 반면 `SELECT payload ...`는 반환을 위해 datum을 재구성하고, `payload LIKE '%error%'`나 `length(payload)>100`은 SELECT 목록에 없더라도 조건 평가 때문에 값을 열 수 있습니다. 예시 trace는 `index lookup → heap tuple → TOAST pointer → chunk fetch/decompress → expression` 순서입니다. 실제 fetch 여부는 plan과 함수, 캐시, 저장 상태로 검증해야 하며 인덱스가 행을 찾았다는 사실만으로 큰 값 비용이 사라지지 않습니다.

조회 경로를 판단할 때는 행을 찾는 비용과 datum을 소비하는 비용을 계측 포인트로 나눕니다. 동일한 `id=42`에 대해 작은 컬럼만 반환하는 실행, payload를 반환하는 실행, payload 내부 조건을 평가하는 실행을 각각 warm cache와 cold cache에서 비교하면 TOAST pointer 자체의 비용과 chunk read·decompression 비용을 구별할 수 있습니다. 이 구분이 있어야 “TOAST를 피하자”가 아니라 어떤 query shape에서 projection·expression index·컬럼 분리를 적용할지 결정할 수 있습니다.

## 득점 포인트

- tuple/page 한계를 먼저 말하고 압축, pointer, out-of-line chunk 순서를 연결합니다.
- `SELECT id,status`와 `payload LIKE`에서 필요한 물리 경로가 다름을 설명합니다.
- 1MB라는 논리 크기를 threshold의 보편 숫자로 사용하지 않고 저장 전략·압축률을 조건으로 둡니다.

## 감점 포인트

- 큰 값은 언제나 별도 일반 테이블에 저장된다고 단정합니다.
- SELECT 목록에 payload가 없으면 predicate나 함수에서도 절대 fetch가 없다고 말합니다.
- 인덱스 lookup 비용과 TOAST datum materialization 비용을 하나의 숫자로 합칩니다.

## 더 파고들 거리

- 특정 버전에서 `EXTERNAL`, `EXTENDED`, `MAIN`, `PLAIN`이 압축·외부화에 미치는 범위를 확인해 보세요.
- `EXPLAIN (ANALYZE, BUFFERS)`와 relation-level I/O로 heap read와 large datum read를 어떻게 분리할지 설계해 보세요.

---
id: toast-index-boundary
title: 큰 값이 TOAST에 저장될 때 그 값을 대상으로 한 인덱스와 heap 접근 비용을 어떻게 구분하나요?
difficulty: 중하
category: 데이터베이스
tags:
  - PostgreSQL
  - TOAST
  - index
  - heap
related:
  - db-covering-index-visibility
---
# 큰 값이 TOAST에 저장될 때 그 값을 대상으로 한 인덱스와 heap 접근 비용을 어떻게 구분하나요?

## 구두 답변

인덱스가 하는 일은 우선 후보 행의 위치를 찾는 것이고, TOAST 비용은 그 후보의 큰 datum을 실제로 열어 비교하거나 반환하는 단계에서 생깁니다. 예를 들어 `WHERE id=42`가 B-tree에서 TID를 찾으면 heap tuple의 `status`만 확인하고 끝날 수 있습니다. 같은 id 조건에 `AND payload LIKE '%error%'`를 붙이면 후보가 하나여도 payload를 materialize해 chunk를 읽고 패턴을 검사해야 할 수 있습니다. `length(payload)>100000`도 길이 계산 경로가 payload fetch를 유발할 수 있어 “SELECT에 payload가 없다”는 이유로 제외하지 않습니다.

비교 trace를 `id index → heap candidate → payload expression → TOAST read → filter`로 기록합니다. 반대로 payload 내부의 `kind`가 자주 검색된다면 JSON 전체 B-tree를 추가하는 것이 substring 검색을 해결하지는 않습니다. 의미 필드를 별도 컬럼으로 유지하거나 적합한 expression/GIN 계열 인덱스를 검토하되, 인덱스 페이지 증가·cache pressure·UPDATE 유지 비용을 함께 측정합니다. 실행계획의 Index Scan이라는 이름만으로 결론내리지 말고 `EXPLAIN (ANALYZE, BUFFERS)`, heap fetch, TOAST relation I/O, filter rows, 반환 bytes를 비교해야 합니다.

특히 `payload`를 인덱스에 넣는 것과 payload를 읽지 않는 것은 다른 문제입니다. expression index가 `payload->>'kind'` 결과를 제공하면 조건 계산에 필요한 큰 datum을 쓰기 시점에 이미 처리해 두는 대신, 인덱스 유지 비용을 매 UPDATE마다 부담할 수 있습니다. 따라서 선택도 높은 id 조건 뒤에 payload filter가 붙는지, payload filter가 대부분의 후보를 제거하는지에 따라 인덱스 효율이 달라집니다. 실제 비용은 cache warm/cold와 반환 크기를 나눠 측정합니다.

## 득점 포인트

- TID 탐색과 large datum materialization을 별도 단계로 그립니다.
- `id=42` 단독과 `id=42 AND payload LIKE`의 차이를 구체적인 경로로 설명합니다.
- 인덱스 추가가 fetch를 줄일 수 있는 경우와 write/cache 비용을 함께 판단합니다.

## 감점 포인트

- 인덱스가 후보를 찾으면 payload 비교도 공짜라고 말합니다.
- payload 전체 B-tree가 모든 JSON 경로와 substring 조건을 해결한다고 가정합니다.
- plan의 Index Scan 라벨만 보고 TOAST relation read가 없다고 결론냅니다.

## 더 파고들 거리

- index-only scan에서 visibility map 때문에 heap fetch가 남는 조건을 TOAST fetch와 어떻게 분리할지 살펴보세요.
- 저장된 `payload_length` 컬럼으로 length 조건을 바꿀 때 UPDATE 누락을 막는 제약과 backfill 절차를 설계해 보세요.

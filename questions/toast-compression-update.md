---
id: toast-compression-update
title: TOAST 대상 값을 조금만 수정해도 큰 쓰기와 vacuum 부담이 생길 수 있는 이유를 설명해 보세요.
difficulty: 중하
category: 데이터베이스
tags:
  - PostgreSQL
  - TOAST
  - UPDATE
  - compression
related:
  - db-large-transaction-batching
---
# TOAST 대상 값을 조금만 수정해도 큰 쓰기와 vacuum 부담이 생길 수 있는 이유를 설명해 보세요.

## 구두 답변

애플리케이션의 변경 payload가 20B라는 사실은 PostgreSQL이 20B만 디스크에 쓴다는 뜻이 아닙니다. 일반적인 UPDATE는 기존 tuple의 일부 바이트를 제자리에서 덮는 대신 새 row version을 만들고, 새 `jsonb` datum을 압축·inline·out-of-line하는 저장 절차를 다시 밟습니다. 따라서 TOAST chunk가 새로 생성되거나, 압축 결과가 달라져 큰 WAL과 I/O가 생길 수 있습니다. HOT 가능 여부와 large datum의 rewrite도 같은 조건으로 섞지 말고 별도로 관측합니다.

구체적으로 V1이 `payload 1MB + metadata 200B`를 가지고 있고 JSON 내부의 `enabled`만 바꾼다고 하겠습니다. 논리 변경은 20B지만 V2의 압축 결과가 900KB라면 새 heap version과 V2의 TOAST 저장이 필요할 수 있습니다. 아직 열린 transaction이 V1을 볼 수 있으면 V1과 V2가 동시에 공간을 점유하고, dead tuple과 WAL이 누적됩니다. VACUUM은 보이지 않는 version을 정리하고 재사용 가능 공간을 만들지만, 긴 snapshot이 정리 경계를 늦출 수 있습니다. JSON patch API는 전송 형식일 뿐 저장소 partial-byte update 보장은 아니므로, 자주 바뀌는 필드를 별도 컬럼으로 분리할지 WAL·vacuum·일관성 비용을 비교합니다.

변경 구조를 선택할 때는 작은 컬럼 분리가 항상 승리하지도 않습니다. 분리하면 상태와 payload의 원자 갱신을 한 transaction에서 유지해야 하고, 조회 시 join이나 중복된 derived field의 일관성 검사가 생깁니다. 반대로 payload 전체 replacement가 드문 읽기 중심 데이터라면 단순한 row 구조가 운영 부담을 낮출 수 있습니다. 실험에서는 같은 입력을 반복 갱신하며 WAL 증가, dead tuple, TOAST relation 재사용 가능 공간, vacuum 지연을 각각 기록해야 합니다.

## 득점 포인트

- 논리 변경 크기와 새 row version·TOAST rewrite의 차이를 1MB/20B/900KB trace로 설명합니다.
- 긴 snapshot, dead tuple, VACUUM의 역할을 구분하고 파일 즉시 축소와 공간 재사용을 혼동하지 않습니다.
- patch API와 저장 engine의 물리 쓰기 계약을 분리합니다.

## 감점 포인트

- JSON patch를 사용했으므로 20B만 WAL에 기록된다고 단정합니다.
- VACUUM 한 번이면 이전 version과 파일 크기가 즉시 모두 사라진다고 말합니다.
- HOT update 가능성만으로 TOAST datum rewrite가 없다고 결론냅니다.

## 더 파고들 거리

- 실제 버전에서 `pg_stat_all_tables`, WAL량, dead tuple, TOAST relation 크기를 어떤 실험 순서로 비교할지 정리해 보세요.
- 자주 변하는 작은 필드를 정규 컬럼으로 분리했을 때 중복·인덱스·transaction 원자성을 어떻게 검증할지 생각해 보세요.

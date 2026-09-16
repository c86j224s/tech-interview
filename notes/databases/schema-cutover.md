---
id: schema-cutover
title: 동시 쓰기 중 컬럼·JSON 표현을 전환하는 방법
topic: 데이터베이스
summary: 단계별 원본 권위·구버전 쓰기·조건부 백필·충돌 집합·checkpoint·읽기 fallback·옛 표현 종료와 JSON schema의 책임을 설명합니다.
questionIds: [db-online-schema-migration, backfill-checkpoint-concurrent-write, dual-column-source-of-truth, db-json-schema-evolution]
---

# 동시 쓰기 중 컬럼·JSON 표현을 전환하는 방법

## 백필이 정상 요청보다 늦게 옛값을 쓰면 안 됩니다

백필이 status='paid', version=7을 읽어 status_code=2를 계산했습니다. 그 사이 정상 요청이 cancelled, version=8로 바꾸었는데 백필이 무조건 2를 쓰면 두 표현이 어긋납니다. 백필은 과거 데이터 복사이면서 현재 쓰기와 경쟁하는 writer입니다.

컬럼 추가·호환 쓰기·백필·읽기 전환·옛 경로 제거를 나누고 각 단계의 원본 표현을 정합니다. 새 컬럼이 존재한다고 바로 읽기 권위가 되는 것은 아닙니다.

## 전환 단계마다 누가 최신 사실을 쓰는지 명시합니다

| 단계 | 권위와 허용 경로 | 전환 조건 |
| --- | --- | --- |
| 확장 | 옛 표현이 원본, 새 열 추가 | 구 앱 호환 DDL |
| 호환 쓰기 | 지원 writer가 두 표현을 같은 거래로 기록 | 구 writer 변경도 추적·동기화 |
| 백필 | 원본 version을 조건으로 새 표현 계산 | 충돌·누락 재처리 |
| 읽기 전환 | 새 표현 우선, 제한된 fallback | 불일치·누락 기준 충족 |
| 축소 | 모든 writer·consumer 새 계약 | rollback 창 종료·별도 승인 |

새 앱만 이중 쓰고 옛 앱은 status만 바꾸면 이미 채운 status_code가 다시 낡습니다. 구 writer를 먼저 호환 버전으로 바꾸거나 trigger·CDC 등 명시한 변환 경로를 마련해야 합니다. 여러 앱·배치·ETL·관리 SQL이 쓰면 모두 조사하고 migration 실행은 단일 원장·조정 책임을 갖게 합니다.

## 백필의 조건과 진행 기록을 함께 저장합니다

```sql
UPDATE orders
SET status_code = :mapped_code
WHERE id = :id
  AND version = :read_version
  AND status = :read_status;
```

위 조건은 백필이 version=7과 원본 status='paid'를 읽은 뒤, 그 행이 여전히 같은 상태일 때만 status_code=2를 쓰게 만드는 안전장치입니다. 사용자 쓰기와 같은 version을 올리면 백필도 일반 변경과 같은 버전 흐름에 들어가고, 별도 migration version을 저장하면 사용자 변경 버전과 전환 진행을 따로 추적할 수 있으므로 실제 모델 중 하나를 선택해야 합니다.

이미 status_code=2인 행을 다시 만났을 때는 조건부 UPDATE의 성공·0행·무변경을 어떤 결과로 기록할지 정해 두어야 재실행이 중복 성공이나 누락으로 보이지 않습니다.

```diagram
{"title":"충돌 행을 남긴 채 진행 위치만 건너뛰지 않습니다","caption":"화살표는 한 백필 batch의 처리입니다. 고수위와 보류 집합을 내구적으로 연결하고 충돌은 최신 원본에서 재계산합니다.","rows":[[{"id":"read","label":"안정 키 범위·원본 version 읽기"}],[{"id":"update","label":"현재 조건이 맞는 행만 갱신"}],[{"id":"record","label":"성공 범위·충돌 집합 기록"}],[{"id":"retry","label":"다음 범위·충돌 재계산"}]],"edges":[{"from":"read","to":"update","label":"낡은 쓰기 거절"},{"from":"update","to":"record","label":"실제 결과"},{"from":"record","to":"retry","label":"재시작 가능"}]}
```

checkpoint는 다음 백필 batch가 다시 시작할 위치이므로, 행을 읽고 조건부 갱신한 결과가 기록되기 전에 이 위치만 앞으로 옮기면 아직 처리하지 않은 행을 건너뛸 수 있습니다. 성공한 범위와 충돌한 행 집합을 같은 transaction에 기록하거나, 중단 뒤에도 각 행을 다시 처리해도 같은 결과가 되는 상태를 남겨야 합니다.

계속 충돌하는 hot row는 일반 범위와 분리해 보류하고 재시도 횟수·최대 나이·수동 확인을 관리합니다. 처리하면서 목록이 줄어드는 경우에는 OFFSET 대신 안정된 키와 기준 범위로 다음 batch를 정합니다.

## 불일치는 Updated_at만으로 해결하지 않습니다

같은 행의 두 컬럼이 다를 때 updated_at이 최근이라고 새 컬럼이 옳다는 보장은 없습니다. 잘못된 백필도 최근 시각을 남길 수 있습니다. 단계별 source of truth, writer version·변경 로그·매핑 버전으로 판단합니다. 값 불일치·누락·알 수 없는 상태를 별도 계수합니다.

fallback이 계속 옛 표현을 조용히 읽으면 새 전환 실패를 숨깁니다. 허용 기간·관측·중단 기준을 두고 새 표현의 검증 완료를 명확히 합니다. 코드 rollback이 필요해도 옛 표현을 생성할 수 있는지와 새 상태가 구 코드에 표현 가능한지 확인합니다. 읽기 전환 직후 옛 컬럼을 삭제하지 않습니다.

## JSON은 물리 DDL을 줄여도 의미 Schema가 남습니다

status 문자열을 `{code,reason}` 객체로 바꾸면 같은 JSON 컬럼이라도 구 앱은 읽지 못할 수 있습니다. JSON null·필드 생략·SQL NULL의 의미, 버전·필수 필드·타입·기본값을 명시합니다. 부분 patch와 전체 문서 대체도 다릅니다.

두 요청이 문서를 읽고 각자 한 필드를 바꿔 전체 저장하면 다른 요청의 필드가 사라질 수 있습니다. 원자 경로 갱신 또는 문서 version 조건을 사용하고 업무 불변식을 유지합니다. JSON 경로 인덱스·생성 컬럼·정규 컬럼의 접근 비용과 타입 변화를 함께 검증합니다. 관계·유일성을 JSON에 넣었다고 DB가 자동 강제하지는 않습니다.

## DDL과 백필의 부하를 따로 제한합니다

기본값·NOT NULL·타입 변경이 메타데이터만 바꾸는지 테이블을 다시 쓰는지는 제품·버전에 달렸습니다. online 옵션도 잠금·로그·디스크·replica lag를 없애지 않습니다. 실제 규모 사본에서 측정하고 batch·동시성·사용자 p99를 기준으로 속도를 조정합니다.

시험은 구·신 writer 동시 실행, 백필 읽기 후 정상 변경, checkpoint 전후 중단, JSON 혼합 타입, 일부 앱 rollback, 옛 배치 잔존을 포함합니다. 현재 작업에서는 제품별 migration·백필을 실행하지 않았습니다. 본문은 전환의 정확성 설계입니다.

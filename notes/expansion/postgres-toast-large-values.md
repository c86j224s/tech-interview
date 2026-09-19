---
id: postgres-toast-large-values
title: PostgreSQL TOAST 대형 값 저장
topic: 데이터베이스
summary: 고정 페이지에 담기 어려운 큰 attribute의 압축·외부 저장·chunking과 행 접근·update 비용을 추적합니다.
questionIds: []
prerequisites:
  - postgres-retention
  - indexes
related:
  - object-publication
  - cacheline-layout
reviewedAt: '2026-09-19'
---
# PostgreSQL TOAST 대형 값 저장

PostgreSQL의 한 행은 논리적으로 큰 `text`, `jsonb`, `bytea`를 가질 수 있지만, 한 tuple이 일반 heap page를 가로질러 마음대로 이어질 수 있는 것은 아닙니다. TOAST(The Oversized-Attribute Storage Technique)는 이 물리적 제약과 애플리케이션의 큰 값을 접합하는 저장 경로입니다. 핵심은 큰 컬럼을 단순히 별도 테이블로 옮긴다는 뜻이 아니라, 행 안에 남겨 둔 TOAST pointer와 내부 TOAST relation의 chunk를 이용해 한 attribute를 압축하거나 외부화한다는 점입니다. 따라서 행을 찾는 비용, 실제 큰 datum을 읽는 비용, 큰 값을 새 버전으로 만드는 비용을 한 덩어리로 설명하면 조회와 쓰기 진단이 어긋납니다.

## 페이지 제약과 attribute 저장

heap page의 크기와 tuple header, null bitmap, 정렬 패딩을 고려하면 모든 컬럼을 inline으로 넣을 수 있는 공간은 페이지 전체보다 작습니다. 행에 1MB JSON이 들어오면 다른 작은 컬럼까지 밀어내며 페이지를 넘길 수 있으므로, 엔진은 저장 전략에 따라 값을 먼저 압축하고 그래도 크면 별도 TOAST relation으로 보냅니다. 원래 heap tuple에는 값 전체가 아니라 외부 datum을 가리키는 표현이 남고, 외부 relation에는 고정된 chunk 단위의 조각과 순서가 저장됩니다. chunk 크기나 압축 선택의 구체값은 빌드·버전·컬럼 저장 옵션에 좌우되므로 특정 숫자를 일반 계약으로 단정하지 않습니다.

TOAST는 모든 큰 값을 반드시 같은 방식으로 외부화하지도 않습니다. 압축으로 tuple을 페이지에 넣을 수 있으면 compressed-inline 상태가 될 수 있고, 외부화가 필요하면 out-of-line chunk가 됩니다. `text`와 `jsonb`처럼 내부 표현과 압축 가능성이 다른 타입은 실제 저장 결과가 다를 수 있습니다. `EXTERNAL`, `EXTENDED`, `MAIN`, `PLAIN` 같은 저장 전략은 컬럼이 압축·외부 저장을 얼마나 허용할지에 영향을 주지만, 전략을 바꾼다고 이미 존재하는 모든 행이 즉시 같은 물리 상태로 재작성되는 것은 아닙니다.

## 압축과 out-of-line 전환

한 행을 저장할 때의 개념적 순서는 값 자체가 압축 가능한지 시도하고, 압축 후 tuple이 충분히 작아졌다면 압축된 값으로 남기는 것입니다. 그래도 tuple이 크면 큰 attribute를 외부 relation으로 옮기고 heap tuple에는 pointer를 둡니다. 여러 큰 attribute가 동시에 있으면 어떤 값을 먼저 줄일지와 최종 tuple 크기를 맞추는 과정이 저장 전략의 영향을 받습니다. 이 과정은 애플리케이션이 JSON 안의 필드 하나를 수정했는지와 무관하게 DB가 새 row version을 어떤 datum으로 만들어야 하는지에 따라 진행됩니다.

작은 metadata와 1MB payload를 함께 조회한다고 하겠습니다. `SELECT id, status`는 heap tuple에서 두 값만 읽고 payload를 역참조하지 않는 경로가 가능하지만, `SELECT id, payload`나 `length(payload)`, `payload->>'kind'` 같은 표현식은 datum을 materialize하거나 검사해야 하므로 TOAST chunk fetch가 뒤따를 가능성이 큽니다. 다만 “SELECT 목록에 없으니 물리 fetch는 절대 없다”라고 단정하지 않고 실행 계획과 실제 함수 평가를 확인해야 합니다. TOAST가 있는 행을 찾았다는 사실은 TOAST relation을 전부 읽었다는 사실과 다릅니다.

```diagram
{"title":"큰 attribute가 행과 TOAST relation으로 나뉘는 경로","caption":"heap에는 행 식별과 pointer가 남고, 실제 datum이 필요할 때 외부 chunk를 따라갑니다. 압축되어 page에 들어가면 외부 fetch 단계가 생략될 수 있습니다.","rows":[[{"id":"input","label":"큰 attribute 입력","detail":["text · jsonb · bytea"]}],[{"id":"compress","label":"압축 판단","detail":["tuple 크기와 저장 전략"]}],[{"id":"heap","label":"heap tuple","detail":["작은 값 + TOAST pointer"]},{"id":"inline","label":"압축·inline datum","detail":["page에 들어간 경우"]}],[{"id":"toast","label":"TOAST relation","detail":["ordered chunks"]}],[{"id":"fetch","label":"datum 재구성","detail":["필요한 표현식에서 fetch"]}]],"edges":[{"from":"input","to":"compress","label":"저장 시 크기 판단"},{"from":"compress","to":"heap","label":"외부화 필요"},{"from":"compress","to":"inline","label":"압축 후 page 적합"},{"from":"heap","to":"toast","label":"pointer가 가리킴"},{"from":"toast","to":"fetch","label":"chunk 순서 결합"},{"from":"inline","to":"fetch","label":"heap에서 읽음"}]}
```

## 행 접근과 대형 datum fetch

`WHERE id = ?`가 인덱스를 사용해 한 heap tuple을 찾았다고 하겠습니다. 첫 단계의 성공은 tuple locator와 작은 컬럼을 얻었다는 의미입니다. 반환 목록에 `payload`가 없고 predicate도 payload를 보지 않으면 큰 값 fetch가 생략되거나 최소화될 수 있습니다. 반대로 `payload LIKE '%error%'`를 평가하면 pointer에서 외부 chunk를 읽어 datum을 구성해야 합니다. 정확한 접근은 함수·통계·플랜에 따라 달라지며, 인덱스가 heap row를 찾았다는 사실만으로 payload 비교 비용을 제거하지는 못합니다.

대형 값 비교는 인덱스 설계와도 분리해야 합니다. `payload` 전체를 B-tree에 넣는다고 일반적인 substring 검색이 자동으로 저렴해지지 않습니다. 자주 검색하는 JSON 속성을 정규 컬럼이나 적절한 expression/index 대상으로 분리하면 큰 datum 역참조를 줄일 수 있지만, JSON 구조와 변경 빈도, 인덱스 유지 비용이 함께 바뀝니다. 저장 표현에 의존하는 `length(payload)`와 JSON 내부 의미 필드 조건도 같은 인덱스 문제로 묶지 않습니다.

설명용 trace는 다음과 같습니다. 1단계에서 `id=42` 인덱스가 heap TID를 찾고, 2단계에서 heap tuple의 status만 읽으면 TOAST fetch가 0일 수 있습니다. 3단계에서 `payload LIKE '%x%'`를 평가하면 pointer에서 외부 chunk를 읽고, 4단계의 응답 바이트가 커지면 직렬화·네트워크 비용이 추가됩니다. 이 숫자는 특정 서버에서 측정한 결과가 아니라 경로를 분리하기 위한 예상 trace입니다.

## MVCC update와 물리적 rewrite

PostgreSQL의 UPDATE는 일반적으로 기존 행의 일부 바이트를 그 자리에서 고치는 대신 새 row version을 만들고 이전 version을 MVCC 가시성 규칙에 따라 남깁니다. 1MB JSON에서 필드 하나만 바꿔도 새 version이 큰 datum을 다시 저장하거나 TOAST chunk를 새로 만들 수 있습니다. JSON patch API를 사용했다는 사실은 저장소가 1MB 중 몇 바이트만 썼다는 증거가 아닙니다. 새 값의 압축률과 외부화 결과가 달라지면 물리적 write량도 달라질 수 있습니다.

예상 상태를 수치로 적어 보겠습니다. 기존 row version V1에 1MB payload와 200B metadata가 있고, 한 필드 변경 뒤 V2가 생겼다고 합시다. 논리 변경은 20B처럼 보여도 V2의 압축·chunk 결과가 900KB라면 heap 새 version과 그에 대응하는 TOAST 저장이 필요합니다. V1이 아직 오래 열린 transaction에 필요하면 즉시 회수되지 않아 일시적으로 V1과 V2의 storage가 함께 존재합니다. 따라서 “20B 변경”과 “20B 디스크 write”를 동일시하지 않습니다.

VACUUM은 더 이상 보이지 않는 row version과 TOAST 쪽의 정리 가능 공간을 회수 대상으로 삼지만, 긴 snapshot이나 replication slot이 경계를 늦출 수 있습니다. 일반 VACUUM이 OS 파일을 즉시 줄이는 것과 내부 공간을 재사용 가능하게 만드는 것은 다릅니다. 폭넓은 rewrite나 VACUUM FULL은 잠금·추가 공간·I/O·복제 지연을 별도로 예산에 넣어야 합니다.

## TOAST와 object storage의 선택 경계

200KB metadata와 200MB image를 한 번에 트랜잭션으로 바꾸며 row와 강하게 결합해야 한다면 DB 안의 큰 값이 단순할 수 있습니다. 반대로 큰 파일을 range/streaming으로 자주 읽고, 장기 보관·저렴한 수명 정책·CDN 연계가 핵심이면 object storage가 더 자연스러울 수 있습니다. 이 판단은 최대 크기 하나가 아니라 트랜잭션 원자성, 백업 경로, 부분 읽기, 삭제와 보존, 권한을 함께 봅니다.

object storage에 파일을 먼저 올리고 DB pointer를 나중에 바꾸는 경우 둘은 하나의 원자 commit이 아닙니다. 업로드 성공 뒤 DB 전환이 실패하면 고아 객체가 남고, DB가 먼저 공개되면 아직 없는 객체를 가리킬 수 있습니다. 불변 object key, 상태 기계, 요청 ID, 검증된 checksum, 조건부 pointer 전환이 필요합니다. 이 boundary는 multipart·CDN 공개 버전을 다룬 기존 객체 노트와 이어지지만, TOAST는 DB 행의 tuple/page 제약을 해결하는 내부 저장입니다.

## 구현 선택과 운영 관측

먼저 payload를 정말 함께 읽는지, 자주 변하는 작은 필드를 분리할 수 있는지, payload 내부 검색이 필요한지 확인합니다. 자주 조회되는 상태를 정규 컬럼에 두면 large datum을 매번 열지 않고도 인덱스를 설계할 수 있습니다. 반대로 큰 값을 무조건 object storage로 옮기면 DB transaction과 객체 lifecycle을 애플리케이션이 직접 조정해야 합니다.

관측에는 heap page·TOAST relation의 읽기, 반환 바이트, row version 증가, dead tuple, vacuum 지연, WAL 양을 함께 둡니다. 인덱스 사용 여부만 보면 large datum fetch와 rewrite를 놓칩니다. 변경 전후에 작은 payload, 압축 잘 되는 payload, 압축되지 않는 payload, 오래 열린 reader를 나눠 비교합니다. 현재 문서에서는 실제 PostgreSQL 실행이나 특정 build의 threshold 측정을 하지 않았으므로, 숫자는 설명용 계산이며 운영 계약으로 사용하기 전에 해당 PostgreSQL 버전과 storage 설정을 확인해야 합니다.

## 실패 경계와 검증 계획

검증은 네 경로를 따로 둡니다. 첫째, 작은 컬럼만 SELECT할 때 큰 datum을 불필요하게 가져오지 않는지 계획과 실제 읽기를 확인합니다. 둘째, payload predicate와 expression이 TOAST fetch를 만드는지 확인합니다. 셋째, 1MB JSON의 20B 논리 변경을 반복해 WAL·dead tuple·TOAST relation 증가를 비교합니다. 넷째, object storage pointer 전환을 중단시켜 고아 객체와 아직 공개되지 않은 객체를 대사합니다.

압축 선택을 바꿔도 결과가 항상 더 작아지는 것은 아닙니다. 압축 CPU, fetch 시 해제 CPU, 이미 압축된 이미지의 낮은 압축률, cache residency를 함께 봅니다. 큰 값을 SELECT하지 않았는데도 지연이 늘면 join·visibility·heap read·직렬화도 분리해야 합니다. 반대로 payload만 크다는 이유로 TOAST fetch가 원인이라고 확정하지 않고 실행 계획과 측정 trace를 요구합니다.

## 참고자료와 근거 범위

물리 저장의 기준은 PostgreSQL `Storage: TOAST` 문서입니다. 이 문서는 tuple이 고정 page를 넘지 못하고, 큰 attribute가 압축되거나 out-of-line chunk로 저장될 수 있다는 범위를 직접 뒷받침합니다. 페이지 크기·압축 알고리즘·정확한 threshold는 이 문서만으로 고정하지 않고 대상 버전과 컬럼 옵션을 확인합니다.

MVCC dead tuple과 VACUUM의 정리·재사용·freeze 역할은 PostgreSQL `Routine Vacuuming` 문서를 별도 근거로 삼습니다. 따라서 “긴 snapshot이 V1 정리를 늦춘다”는 운영 판단은 TOAST 문서의 직접 결론이 아니라 MVCC/vacuum 관측을 함께 확인해야 하는 조건부 설명입니다. visibility map·index-only scan도 인덱스 문서와 실행계획으로 따로 검증합니다. 이 장에서는 replication slot이 반드시 TOAST chunk를 보존한다고 단정하지 않고, 정리 지연 원인은 transaction horizon과 실제 유지 상태를 점검 대상으로 둡니다.

참고 URL:
- https://www.postgresql.org/docs/current/storage-toast.html — fixed page, 압축, out-of-line chunk.
- https://www.postgresql.org/docs/current/routine-vacuuming.html — dead tuple 정리, visibility map, autovacuum 범위.
- https://www.postgresql.org/docs/current/storage-hot.html — update와 물리적 row version 판단을 위한 보조 범위.

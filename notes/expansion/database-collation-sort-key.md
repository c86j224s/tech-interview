---
id: database-collation-sort-key
title: Collation sort key와 버전 변경
topic: 데이터베이스
summary: >-
  문자열 byte 순서·언어별 정렬·비교키와 인덱스 정렬의 관계를 설명하고 collation provider/version 변경 뒤 재검증
  범위를 정합니다.
questionIds: []
prerequisites:
  - identity-representation
  - indexes
related:
  - unique-identity
  - sql-exact-monetary-arithmetic
reviewedAt: '2026-09-19'
---
# Collation sort key와 버전 변경

문자열의 저장 바이트, Unicode 표현, collation 비교 결과는 서로 다른 층입니다. UTF-8 byte sort는 인코딩된 숫자를 비교하지만 collation은 provider와 locale이 정한 정렬·문자 분류·동등성 규칙을 적용합니다. 따라서 `ORDER BY`, `GROUP BY`, `DISTINCT`, UNIQUE의 결과를 재현하려면 앱 locale 하나가 아니라 DB major, collation provider, locale, provider 데이터 버전, column/expression collation과 NULL 방향까지 함께 고정해야 합니다.

## 표현 층위

`é`는 U+00E9 하나로 저장할 수도 있고 `e`와 combining acute 두 code point로 저장할 수도 있습니다. NFC/NFD 정규화는 canonical equivalent 표현을 맞추는 도구지만, DB가 모든 정규화나 악센트·대소문자 차이를 자동으로 같은 값으로 만드는 기능은 아닙니다. raw bytes가 다르다고 의미가 반드시 다른 것도 아니고, 화면이 같다고 UNIQUE equality가 같다는 뜻도 아닙니다.

앱이 `NFC + casefold` 비교키를 만든 뒤 DB에 원문만 저장하면 두 계층이 서로 다른 equality를 사용할 수 있습니다. 원문 표시, 명시적 검색/정렬 key, 내부 식별자를 분리하고 어느 계층이 최종 유일성 권위인지 문서화해야 합니다.

## Collation 적용 위치

PostgreSQL에서는 database 기본 collation, column collation, 질의 expression의 `COLLATE` 절이 실제 비교 문맥을 결정합니다. 같은 `name`이라도 column 정의와 질의 expression이 다르면 `ORDER BY name`, `WHERE name = ...`, `GROUP BY name`의 의미를 앱이 추측할 수 없습니다. 계획과 결과를 재현하려면 SQL, column definition, expression collation을 함께 보존합니다.

```text
원문 A = "e" + combining acute
원문 B = "é"
원문 C = "E"

UTF-8 byte 비교 → 인코딩 바이트·길이의 순서
collation 비교 → provider·locale 규칙의 비교키
정규화 → 표현 형태를 맞추는 별도 전처리
```

이 세 줄은 특정 ICU의 실제 순서를 뜻하지 않습니다. 정확한 순서는 배포 환경에서 실행해 저장해야 합니다.

## 비교와 동등성

PostgreSQL 문서에서 deterministic collation은 collation 비교가 동률일 때 byte sequence를 구분자로 사용할 수 있는 방향입니다. nondeterministic collation은 provider가 구별하지 않는 차이가 있는 서로 다른 byte를 equality에서 같다고 볼 수 있습니다. 그러나 nondeterministic이라는 표지만으로 “대소문자 무시”나 “악센트 무시”가 보장되는 것은 아닙니다. 어떤 차이를 무시하는지는 ICU locale·strength 같은 provider 설정과 버전에 달려 있습니다.

예를 들어 `Cafe`, `cafe`, `café`가 같은 UNIQUE 값이 되는지는 collation 이름과 provider가 실제로 case/accent 차이를 어떻게 처리하는지에 달렸습니다. 앱의 `lower()`는 DB의 ICU 비교와 같지 않을 수 있습니다. 따라서 같은 표본으로 `=`, `GROUP BY`, `DISTINCT`, UNIQUE 삽입을 시험하고, equality 결과를 계정 소유권의 증명으로 사용하지 않습니다.

## 정렬과 전체 순서

`ORDER BY name`만 사용하면 비교키가 같은 행의 상대 순서가 안정적이지 않을 수 있습니다. `ORDER BY name, id`처럼 유일한 보조 키를 추가해 전체 순서를 만들고, `NULLS FIRST/LAST`와 방향을 cursor 계약에 포함합니다. DB가 collation으로 페이지를 자른 뒤 앱이 다시 다른 locale로 정렬하면 사용자가 보는 경계가 바뀌므로 앱 재정렬을 피하거나 동일 규칙을 명시적으로 공유해야 합니다.

keyset cursor에는 `name`과 `id`의 직렬화, 정렬 방향, tenant·권한 문맥, collation 정책 version을 함께 묶습니다. 정렬 규칙이 바뀐 뒤 옛 cursor를 계속 허용하면 누락·중복이 생길 수 있으므로 폐기하고 새 기준점부터 발급하는 전략을 둡니다.

## Index sort key

문자열 인덱스는 특정 collation 아래의 비교·순서 전제를 갖습니다. `ORDER BY`가 인덱스와 같은 collation을 사용하면 정렬을 줄이는 후보가 되지만, 다른 `COLLATE`나 함수 표현을 쓴 질의가 기존 인덱스 순서를 그대로 제공한다고 볼 수 없습니다. nondeterministic collation의 인덱스 deduplication, equality, 지원 연산은 PostgreSQL major와 provider 문서를 확인해야 합니다.

프로세스를 재시작한다고 기존 인덱스의 key가 새 ICU/OS 규칙으로 자동 재배열되지는 않습니다. provider 데이터가 바뀌어 비교 결과가 달라질 수 있다면 ORDER BY, UNIQUE, keyset cursor, GROUP BY·DISTINCT를 영향 객체로 분류합니다.

## Version drift와 재색인

PostgreSQL의 `ALTER COLLATION` 문서는 collation version mismatch 경고가 의존 객체를 새 규칙과 어긋나게 할 수 있음을 전제로 합니다. 운영 순서는 먼저 경고와 affected object를 조회하고, 필요한 인덱스를 `REINDEX` 또는 해당 객체를 재작성한 뒤, 검증이 끝났을 때 `ALTER COLLATION ... REFRESH VERSION`을 실행하는 것입니다. `REFRESH VERSION` 자체가 인덱스를 재작성하거나 correctness를 확인해 주는 명령은 아니므로 후행 표식으로 취급합니다.

```text
provider/OS 데이터 변경
        ↓
version mismatch·의존 객체 확인
        ↓
REINDEX / 객체 rebuild
        ↓
ORDER BY·UNIQUE·GROUP BY 표본 대조
        ↓
ALTER COLLATION ... REFRESH VERSION
        ↓
새 cursor 발급·충돌 행 수동 보정
```

새 equality로 충돌하는 행은 자동 병합하지 않습니다. owner 확인, 새 표시명, 임시 namespace 또는 명시적 중단 중 하나를 선택하고, rebuild 중 읽기·쓰기 영향과 lock을 계획합니다.

## 그룹과 페이지 경계

`ORDER BY`는 순서를 정하고 `GROUP BY`와 `DISTINCT`는 equality operator·collation 문맥의 그룹을 정합니다. 따라서 sort rank만 달라지는 경우와 equality 군이 합쳐져 그룹 수가 줄어드는 경우를 분리해 관찰합니다. `Jose`, `José`, `jose` 표본은 provider 설정에 따라 분리되거나 합쳐질 수 있지만, 특정 ICU 결과를 실행 없이 확정하지 않습니다.

재현 테스트는 old/new 환경에서 같은 SQL을 실행해 row order, `COUNT(DISTINCT value)`, group rows, UNIQUE insertion outcome, cursor continuation을 비교합니다. expression에 명시된 collation과 column의 기본 collation을 혼동하지 않도록 실행 SQL도 fixture에 저장합니다.

## 운영 검증

migration 전후에 DB major, provider, locale, version, column/expression collation, index definition, direction, NULL 정책을 기록합니다. 표본은 NFC/NFD, case, accent, 숫자, 빈 문자열, NULL, 혼합 script를 포함합니다. 앱 정렬 결과와 DB 결과를 별도로 저장하고 차이가 나면 앱이 재정렬했는지, 비교 key를 사용했는지 추적합니다.

이 문서 작성에서는 실제 PostgreSQL/ICU 조합을 실행하지 않았습니다. 그러므로 특정 locale의 순서나 그룹 수는 설명용 조건부 trace이며, 배포 전 격리 DB에서 측정해야 합니다. 확정 가능한 범위는 공식 문서가 정의한 collation 적용 위치, deterministic/nondeterministic 의미, version mismatch 절차입니다.

## 비용과 한계

언어 규칙을 반영하는 collation은 사용자 기대를 높이지만 비교키 계산과 인덱스 재검증 비용을 만듭니다. binary collation은 예측과 재현이 단순하지만 언어 정렬 품질을 포기합니다. 별도 sort key를 저장하면 provider 교체를 통제할 수 있지만 backfill, 이중 쓰기, 인덱스 rebuild가 필요합니다.

고정된 문자열 순서가 감사·cursor의 핵심이면 provider와 version을 배포 산출물에 pin하고 cursor에 policy version을 포함합니다. 사용자가 읽는 언어 정렬이 핵심이면 배포 업그레이드 때 sample equality와 ordering을 회귀 검증합니다.

## 참고 자료

- PostgreSQL, [Collation Support](https://www.postgresql.org/docs/current/collation.html), §23.2. column/expression collation, provider, deterministic/nondeterministic equality의 근거로 확인했습니다.
- PostgreSQL, [ALTER COLLATION](https://www.postgresql.org/docs/current/sql-altercollation.html). version mismatch 경고, dependent object 재작성 선행, `REFRESH VERSION`의 후행 역할을 확인했습니다.
- 정확한 ICU locale별 순서와 index 제한은 배포 major·provider 조합에서 실행 검증해야 합니다.

```diagram
{"title":"Collation 규칙과 인덱스 전제","caption":"raw text를 provider 규칙으로 비교키로 바꾼 뒤 의존 객체를 version drift에 맞춰 재검증합니다.","rows":[[{"id":"text","label":"원문 문자열","detail":["UTF-8·NFC/NFD"]}],[{"id":"collation","label":"Collation","detail":["provider·locale·version"]}],[{"id":"equality","label":"Equality·순서","detail":["GROUP·ORDER·UNIQUE"]}],[{"id":"index","label":"의존 인덱스","detail":["옛 sort 전제"]}],[{"id":"rebuild","label":"재작성·확인","detail":["REINDEX·cursor 갱신"]}]],"edges":[{"from":"text","to":"collation","label":"비교 문맥"},{"from":"collation","to":"equality","label":"비교키 계산"},{"from":"equality","to":"index","label":"정렬 전제"},{"from":"index","to":"rebuild","label":"version drift"}]}
```

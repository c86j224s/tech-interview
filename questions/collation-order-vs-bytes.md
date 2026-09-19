---
id: collation-order-vs-bytes
title: UTF-8 byte 정렬과 언어별 collation 정렬이 다른 이유와 ORDER BY 결과를 재현할 때 고정할 조건은 무엇인가요?
difficulty: 하
category: 데이터베이스
tags:
  - collation
  - Unicode
  - ORDER BY
  - sort key
related:
  - unicode-normalization-identifiers
---
# UTF-8 byte 정렬과 언어별 collation 정렬이 다른 이유와 ORDER BY 결과를 재현할 때 고정할 조건은 무엇인가요?

## 구두 답변

UTF-8 byte 정렬은 인코딩된 바이트의 숫자 순서를 비교하지만 collation은 locale·provider가 정의한 문자 비교와 정렬 규칙을 사용합니다. 따라서 악센트·대소문자·combining sequence의 순서가 달라질 수 있습니다. `é`와 `e`+combining acute는 정규화 관점에서 같은 표현일 수 있지만 저장 byte와 DB equality가 자동으로 같은 것은 아닙니다.

PostgreSQL에서는 DB 기본값뿐 아니라 column이나 expression에 collation이 붙을 수 있으므로 앱 locale만 고정하지 않습니다. 재현 조건은 DB major, provider, locale, provider/ICU version, column·expression collation, `NULLS FIRST/LAST`, 정렬 방향과 안정된 보조 키입니다. 문자열 하나만 커서로 쓰지 않고 `name, id`처럼 전체 순서를 만듭니다.

버전이 바뀌면 동일 locale도 sort key가 달라질 수 있어 인덱스와 keyset cursor를 재검증합니다. 표본에는 NFC/NFD, 대소문자, 악센트, NULL을 넣어 `ORDER BY`, equality, `GROUP BY`, `DISTINCT`를 함께 비교합니다. 실제 출력은 OS/ICU에 따라 다를 수 있어 특정 순서를 일반 규칙으로 외우지 않겠습니다.

재현 표본으로 `e`+combining acute, `é`, `E`, `ê`, NULL을 넣고 byte 순서와 DB `ORDER BY`를 따로 저장합니다. NFC가 두 표현을 canonical equivalent로 만들 수 있어도 정규화와 collation equality는 같은 기능이 아닙니다. PostgreSQL에서는 database 기본값, column 정의, query의 expression `COLLATE`가 서로 다른 문맥을 만들 수 있으므로 SQL text와 schema를 함께 버전 관리합니다.

`ORDER BY name`만 쓰면 비교키가 동률인 행의 순서와 keyset 경계가 불안정합니다. `ORDER BY name, id`와 `NULLS LAST`를 명시하고 cursor에 name, id, 방향, collation policy version을 넣습니다. provider나 ICU 데이터가 바뀌면 old cursor를 그대로 소비하지 않고 새 기준점부터 발급합니다. 정확한 locale별 순서는 실행 없이 일반화하지 않고, old/new 환경에서 equality·GROUP BY·DISTINCT도 함께 비교합니다.

## 득점 포인트

- byte 순서와 collation-aware 비교를 구분합니다.
- column·expression collation과 provider/version을 고정합니다.
- NULL 방향과 보조 키까지 재현 조건에 포함합니다.
- provider별 결과를 표본 데이터로 검증합니다.

## 감점 포인트

- 앱 locale만 고정하면 DB 정렬이 재현된다고 합니다.
- Unicode 정규화와 collation을 같은 기능으로 설명합니다.
- 문자열 하나만 cursor로 사용해 동등값 경계를 방치합니다.

## 더 파고들 거리

- collation 변경 후 기존 인덱스와 cursor를 어떤 순서로 재검증할까요?
- 앱 비교키와 DB collation이 다른 equality를 만들면 어떤 장애가 생기나요?

---
id: collation-unique-case
title: >-
  PostgreSQL deterministic collation과 nondeterministic collation은 바이트가 다른 동등
  문자열을 어떻게 처리하나요?
difficulty: 중하
category: 데이터베이스
tags:
  - collation
  - UNIQUE
  - case folding
  - identity
related:
  - db-unique-constraint-race
---
# PostgreSQL deterministic collation과 nondeterministic collation은 바이트가 다른 동등 문자열을 어떻게 처리하나요?

## 구두 답변

핵심은 deterministic collation이 collation 비교에서 같은 것으로 보이는 값에 byte tie-break를 사용해 최종적으로 구분할 수 있는 반면, nondeterministic collation은 provider가 무시하도록 정한 차이를 equality에서 구분하지 않을 수 있다는 점입니다. 따라서 `Cafe`, `cafe`, 악센트가 다른 표현이 UNIQUE에서 각각 다른 행이 될지는 collation과 ICU 규칙에 달려 있고 PostgreSQL major·provider별 확인이 필요합니다.

앱의 `lower()` 결과를 DB equality와 같다고 추정하지 않습니다. 앱은 대소문자만 접고 DB는 악센트도 무시할 수 있으며, 반대로 앱의 accent stripping이 더 넓게 합칠 수도 있습니다. 표시 원문·비교 key·내부 account ID를 분리하고 DB UNIQUE를 최종 권위로 둡니다. 같은 이름이라는 이유만으로 계정을 자동 연결하지 않습니다.

운영에서는 collation 이름·provider·version과 비교 정책 version을 기록하고 동등성 행렬로 INSERT, `=`, `GROUP BY`, `DISTINCT`를 테스트합니다. 새 규칙에서 충돌하는 기존 행은 자동 병합하지 않고 owner 확인과 이름 변경 정책을 거칩니다. UNIQUE 충돌이 동일 논리 요청의 재전달인지 별도 가입 경쟁인지도 멱등 key와 인증된 주체로 구분합니다.

결과를 단정하기 전에 provider가 어떤 차이를 무시하는지 확인합니다. deterministic collation은 collation 동률 뒤 byte tie-break로 `Cafe`와 `cafe`를 구분할 수 있지만, nondeterministic collation은 provider가 무시하도록 구성한 차이를 equality에서 제거할 수 있습니다. nondeterministic flag 자체가 case-insensitive나 accent-insensitive를 보장하지 않으며 ICU locale·strength와 데이터 버전이 실제 결과를 정합니다.

따라서 동일 환경에서 `INSERT`, `=`, `GROUP BY`, `DISTINCT`를 `Cafe`, `cafe`, `café`, NFC/NFD 쌍으로 실행한 equality matrix를 보관합니다. 앱 `lower()`나 accent stripping이 DB collation보다 좁거나 넓을 수 있어 표시 원문, 비교 key, 내부 account ID를 분리합니다. 새 규칙에서 UNIQUE 충돌이 발견되어도 동일 문자열을 근거로 계정을 연결하지 않고 수동 소유자 확인 상태로 둡니다.

## 득점 포인트

- deterministic tie-break와 nondeterministic equality를 구분합니다.
- 앱 lower/casefold와 DB collation의 의미 차이를 설명합니다.
- UNIQUE 충돌과 계정 소유권을 분리합니다.
- 버전별 지원과 실제 결과의 불확실성을 명시합니다.

## 감점 포인트

- nondeterministic을 단순히 대소문자 무시로 고정합니다.
- 바이트가 다르면 반드시 UNIQUE에서 다른 값이라고 합니다.
- 이름 충돌을 계정 자동 연결의 증거로 사용합니다.

## 더 파고들 거리

- ICU locale·strength 설정이 equality를 바꾸는 사례를 어떻게 표본화하겠습니까?
- collation 규칙 변경으로 기존 UNIQUE가 충돌하면 어떤 migration 상태를 두겠습니까?

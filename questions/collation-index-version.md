---
id: collation-index-version
title: ICU 또는 OS collation 버전이 바뀐 뒤 기존 문자열 인덱스의 정렬 순서를 왜 재검증해야 하나요?
difficulty: 중하
category: 데이터베이스
tags:
  - collation
  - index
  - ICU
  - migration
related:
  - db-unique-constraint-race
---
# ICU 또는 OS collation 버전이 바뀐 뒤 기존 문자열 인덱스의 정렬 순서를 왜 재검증해야 하나요?

## 구두 답변

문자열 인덱스는 특정 collation provider와 규칙 아래의 key 순서를 전제로 만들어집니다. ICU나 OS의 데이터가 바뀌어 두 문자열 비교 결과가 달라지면 기존 인덱스가 새 규칙을 반영한다고 자동으로 볼 수 없습니다. 프로세스 재시작만으로 충분하다고 가정하지 않고 DB의 collation version mismatch와 의존 인덱스를 확인하겠습니다.

재검증 대상은 ORDER BY만이 아닙니다. UNIQUE 인덱스에서는 이전에 달랐던 표현이 새 equality에서 충돌할 수 있고, keyset pagination은 옛 sort key cursor가 새 페이지 경계를 가리킬 수 있습니다. GROUP BY·DISTINCT의 그룹 수와 검색 결과도 바뀔 수 있습니다. NFC/NFD, case, accent, NULL 표본을 old/new 환경에서 비교해 충돌 행을 보정 목록으로 만들겠습니다.

그 다음 배포 major와 provider의 공식 절차에 따라 재인덱스나 rebuild 범위를 정합니다. 충돌을 자동 병합하지 않고 owner 확인·새 이름·임시 namespace를 둡니다. cursor에는 정렬 version을 넣어 변경된 cursor를 폐기하거나 새 기준점으로 다시 발급하고, 현재 권한도 재확인합니다.

PostgreSQL에서는 version mismatch 경고와 affected dependent objects를 먼저 조회합니다. 그 다음 해당 인덱스를 `REINDEX`하거나 객체를 재작성하고, ORDER BY·UNIQUE·GROUP BY·cursor continuation을 표본 데이터로 old/new 환경에서 비교한 뒤 `ALTER COLLATION ... REFRESH VERSION`을 실행합니다. REFRESH VERSION은 provider 기록을 갱신할 뿐 인덱스를 자동 rebuild하거나 correctness를 확인하는 명령이 아니므로 선행 단계가 될 수 없습니다.

예를 들어 ICU 규칙이 `Cafe`와 `café`를 새 equality로 합치면 기존 UNIQUE 행이 동시에 유효하지 않을 수 있습니다. 충돌 행을 자동 병합하지 않고 owner 확인, 이름 변경, 임시 namespace를 두며 cursor에는 정책 version을 넣어 폐기·재발급합니다. 재인덱스 중에는 lock, read/write 영향, 새 가입 요청의 중복 검사 경계를 별도 runbook으로 둡니다.

## 득점 포인트

- index ordering과 provider version의 전제를 연결합니다.
- UNIQUE·pagination·GROUP BY까지 영향 범위를 확장합니다.
- 충돌 데이터와 cursor version을 별도 처리합니다.
- restart와 rebuild를 구분합니다.

## 감점 포인트

- 인덱스가 존재하면 새 provider 규칙과 항상 일치한다고 합니다.
- version drift를 앱 캐시만 비우면 해결된다고 합니다.
- 새 equality 충돌을 임의 계정 병합으로 처리합니다.

## 더 파고들 거리

- nondeterministic collation의 equality와 deterministic tie-break가 UNIQUE에 미치는 차이는 무엇인가요?
- 대규모 재인덱스 중 읽기·쓰기 경계를 어떻게 운영하겠습니까?

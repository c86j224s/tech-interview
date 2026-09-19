---
id: collation-pagination-determinism
title: 문자열 collation을 바꾼 뒤 GROUP BY와 DISTINCT의 그룹 수가 달라질 수 있는 이유는 무엇인가요?
difficulty: 중하
category: 데이터베이스
tags:
  - collation
  - keyset pagination
  - ordering
related:
  - db-keyset-pagination
---
# 문자열 collation을 바꾼 뒤 GROUP BY와 DISTINCT의 그룹 수가 달라질 수 있는 이유는 무엇인가요?

## 구두 답변

`GROUP BY`와 `DISTINCT`는 raw byte가 아니라 표현식의 equality와 collation semantics를 사용하므로, 문자열이 같다고 판정되는 경계가 바뀌면 그룹 수가 바뀔 수 있습니다. 정렬 순서가 바뀌는 것과 동등성 군이 합쳐지는 것은 별도 현상이지만, provider/ICU locale·strength가 실제로 대소문자·악센트 차이를 equality에서 무시하도록 구성된 nondeterministic collation이라면 둘 다 사용자 결과에 영향을 줍니다.

예를 들어 `Jose`, `José`, `jose`를 넣고 악센트·대소문자를 모두 구분하는 규칙과 둘 다 무시하는 규칙을 비교하면 그룹 수가 달라질 수 있습니다. 특정 locale의 숫자를 일반화하지 않고 실제 PostgreSQL 환경에서 `COUNT(DISTINCT value)`, `GROUP BY value`, UNIQUE 삽입 결과를 같은 표본으로 실행하겠습니다.

페이지네이션에서는 문자열만 cursor로 쓰면 같은 equality군이나 같은 sort key 경계를 안정적으로 표현하기 어렵습니다. `ORDER BY name, id`로 전체 순서를 만들고 collation version을 cursor에 포함합니다. 규칙 변경 뒤 옛 cursor를 계속 허용하지 않고 재시작 지점을 제공하며, 현재 tenant와 권한도 다시 검사합니다.

`Jose`, `José`, `jose`의 그룹 수는 정렬 순위가 아니라 equality 정책으로 결정됩니다. provider가 악센트·대소문자 차이를 무시하는 collation이면 세 값이 하나의 그룹으로 합쳐질 수 있지만, nondeterministic이라는 이름만으로 그 결과를 확정할 수는 없습니다. 실제 column collation과 expression `COLLATE`를 조회하고 old/new 환경에서 `COUNT(DISTINCT value)`, `GROUP BY`, `=`와 UNIQUE insert를 같은 fixture로 실행합니다.

페이지 순서는 별도 검사합니다. `ORDER BY name, id`로 유일한 전체 순서를 만들고 cursor에 id와 collation policy version을 함께 서명하지만, 서명이 새 규칙이나 권한을 자동 보장하지는 않습니다. 규칙이 바뀌면 옛 cursor를 만료시키고 새 기준점을 발급하며, equality 군이 합쳐져 UNIQUE rebuild가 실패한 행은 자동 병합하지 않고 보정 큐로 보냅니다.

## 득점 포인트

- equality grouping과 ordering을 서로 구분합니다.
- locale별 결과를 표본 SQL로 검증합니다.
- 보조 ID와 collation version으로 전체 순서를 만듭니다.
- cursor 서명과 현재 인가를 분리합니다.

## 감점 포인트

- GROUP BY가 항상 raw bytes만 비교한다고 합니다.
- 정렬만 바뀌고 그룹 수는 절대 바뀌지 않는다고 합니다.
- 서명된 cursor가 권한과 최신 sort 규칙까지 보장한다고 합니다.

## 더 파고들 거리

- equality 군이 합쳐질 때 UNIQUE 재인덱스가 실패하는 행을 어떻게 찾을까요?
- 페이지 사이에 이름이 수정되는 경우 snapshot과 최신 탐색의 차이는 무엇인가요?

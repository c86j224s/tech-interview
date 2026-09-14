---
id: "db-null-three-valued-logic"
title: "SQL에서 NULL이 있는 목록에 NOT IN을 쓰자 예상한 행이 나오지 않습니다. NULL과 비교는 어떻게 동작하나요?"
answerMinutes: 5
followups: [{"id": "db-exists-vs-join", "prompt": "관계의 값이 아니라 존재만 필요하다면 JOIN의 행 증폭을 어떻게 피하나요?"}, {"id": "functional-dependency-keys", "prompt": "관찰 데이터가 아니라 모든 유효 상태의 제약으로 키를 정하려면 무엇을 확인하나요?"}, {"id": "db-query-plan-regression", "prompt": "동일 SQL의 비용이 달라졌다면 추정 행·실제 행·파라미터·대기를 어떤 순서로 비교하나요?"}]
difficulty: "중하"
category: "데이터베이스"
tags: ["SQL", "데이터베이스", "NULL"]
related: ["db-exists-vs-join", "functional-dependency-keys", "db-query-plan-regression"]
---

# SQL에서 NULL이 있는 목록에 NOT IN을 쓰자 예상한 행이 나오지 않습니다. NULL과 비교는 어떻게 동작하나요?

## 구두 답변

SQL의 NULL은 일반적인 값 하나가 아니라 알 수 없거나 없는 정보를 표현하며 비교 결과에 UNKNOWN이 생길 수 있습니다. WHERE는 TRUE인 행만 남기므로 FALSE뿐 아니라 UNKNOWN도 제외됩니다.

### 동작 원리와 전제

x NOT IN (1, NULL)은 x가 1이 아닌 경우에도 NULL과의 비교가 UNKNOWN이 되어 기대와 다를 수 있습니다. NULL 여부는 = NULL이 아니라 IS NULL로 검사합니다. 조인의 조건과 집계에서 NULL을 다루는 방식도 일반 등호와 같다고 보면 안 됩니다.

### 선택과 실패 처리

부재 관계를 찾으려면 상관 NOT EXISTS를 검토하고, NULL이 실제로 허용되는 데이터인지 스키마에서 정합니다. 무조건 COALESCE로 0이나 빈 문자열로 바꾸면 실제 값과 미확인 상태를 합칠 수 있습니다. COUNT(*)와 COUNT(column)의 NULL 포함 차이도 보고서 숫자를 바꿉니다.

### 구체적인 사례와 검증

테이블에 x=1,2,NULL이 있고 NOT IN (1,NULL)을 적용하면 x=2도 TRUE가 되지 않아 빠질 수 있습니다. 기대한 '1이 아닌 모든 값'과 다르므로 부재를 나타내는 데이터와 연산의 의미를 직접 계산해 보겠습니다. 집계에서도 COUNT(column)은 NULL을 제외하지만 COUNT(*)는 행을 셉니다. LEFT JOIN 뒤 자식 컬럼을 WHERE에서 비교하면 NULL 확장 행이 제외되어 의도한 부모 보존이 사라질 수 있습니다. 이런 문제는 인덱스 튜닝으로 해결되지 않습니다. 먼저 작은 예제의 결과 집합을 고정한 뒤 같은 의미를 유지하는 질의와 실행 계획을 선택합니다.

NULL·빈 집합·중복·실제 0을 포함한 작은 테이블로 쿼리 결과를 계산해 비교합니다. UNIQUE에서 여러 NULL 허용 여부 등은 엔진별로 확인합니다. NULL 처리 개선은 실행 계획뿐 아니라 데이터 의미를 바꾸므로 결과 집합을 먼저 검증하겠습니다.

## 득점 포인트

- 핵심 구분: SQL의 NULL은 일반적인 값 하나가 아니라 알 수 없거나 없는 정보를 표현하며 비교 결과에 UNKNOWN이 생길 수 있습니다.
- 선택 조건: 부재 관계를 찾으려면 상관 NOT EXISTS를 검토하고, NULL이 실제로 허용되는 데이터인지 스키마에서 정합니다.
- 검증 기준: NULL·빈 집합·중복·실제 0을 포함한 작은 테이블로 쿼리 결과를 계산해 비교합니다.

## 감점 포인트

- NULL을 빈 문자열이나 0과 같은 일반 값으로 비교한다.

## 더 파고들 거리

- 관계의 값이 아니라 존재만 필요하다면 JOIN의 행 증폭을 어떻게 피하나요?
- 관찰 데이터가 아니라 모든 유효 상태의 제약으로 키를 정하려면 무엇을 확인하나요?
- 동일 SQL의 비용이 달라졌다면 추정 행·실제 행·파라미터·대기를 어떤 순서로 비교하나요?

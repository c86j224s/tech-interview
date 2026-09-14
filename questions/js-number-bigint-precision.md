---
id: "js-number-bigint-precision"
title: "큰 주문 ID를 JavaScript Number로 읽었더니 다른 ID와 같아집니다. 안전한 정수와 BigInt·문자열은 어떻게 선택하나요?"
answerMinutes: 5
followups: [{"id": "serialization-json-numbers", "prompt": "JSON 숫자가 여러 언어를 왕복할 때 정확한 정수·금액을 어떤 표현으로 보존하나요?"}, {"id": "redis-sorted-set-ranking", "prompt": "정수·시각을 점수에 합칠 때 정밀도와 역순 동점 정렬을 어떻게 검증하나요?"}, {"id": "js-equality-coercion", "prompt": "입력 문자열을 숫자와 비교하기 전에 어떤 변환·범위·빈 값 검사를 수행하나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript", "언어·런타임"]
related: ["serialization-json-numbers", "redis-sorted-set-ranking", "js-equality-coercion"]
---

# 큰 주문 ID를 JavaScript Number로 읽었더니 다른 ID와 같아집니다. 안전한 정수와 BigInt·문자열은 어떻게 선택하나요?

## 구두 답변

Number는 모든 크기의 정수를 정확히 표현하지 못합니다. 정수 ID가 안전 범위를 넘으면 서로 다른 값이 같은 부동소수점 값으로 반올림될 수 있어 식별자를 문자열이나 적절한 BigInt 경로로 전달해야 합니다.

### 동작 원리와 전제

Number.MAX_SAFE_INTEGER 경계를 확인하고 서버 JSON이 큰 숫자를 숫자 literal로 보내면 파싱 순간 이미 정밀도를 잃을 수 있습니다. 나중에 BigInt로 바꿔도 잃은 원래 숫자를 복원할 수 없습니다. API에서 문자열 ID 계약을 쓰는 방법이 단순할 수 있습니다.

### 선택과 실패 처리

BigInt와 Number는 연산·직렬화 규칙이 다르고 JSON.stringify가 기본적으로 처리하지 않는 경우를 명시적으로 다룹니다. ID 문자열을 숫자 정렬할지 사전식 정렬할지도 정합니다. 금액은 최소 단위 정수 범위와 decimal 정책을 별도로 설계합니다.

### 구체적인 사례와 검증

서버가 9007199254740993 같은 큰 정수를 숫자로 보내 Number로 파싱하면 인접 정수와 구분되지 않을 수 있습니다. ID를 문자열로 전달하면 바이트 표현을 보존하기 쉽지만 범위·정규 형식·선행 0의 의미를 검증해야 합니다. BigInt는 정수 연산에 적합하지만 일반 JSON과 혼합 산술의 어댑터가 필요합니다. UI에서 ID를 표시할 뿐이라면 불필요하게 숫자로 바꾸지 않습니다. 금액 계산은 ID와 다르게 산술·반올림 규칙이 중요하므로 통화별 최소 단위와 안전 범위를 확인합니다. 왕복 테스트는 브라우저뿐 아니라 로그·메시지·DB client까지 포함합니다.

최대 범위·인접 큰 정수·JSON 왕복·DB 바인딩·동점 정렬을 시험합니다. TypeScript 타입이 number라고 정확성을 보장하는 것은 아닙니다. 표현 형식은 전체 네트워크·브라우저·저장 경로에서 일관되어야 합니다.

## 득점 포인트

- 핵심 구분: Number는 모든 크기의 정수를 정확히 표현하지 못합니다.
- 선택 조건: BigInt와 Number는 연산·직렬화 규칙이 다르고 JSON.stringify가 기본적으로 처리하지 않는 경우를 명시적으로 다룹니다.
- 검증 기준: 최대 범위·인접 큰 정수·JSON 왕복·DB 바인딩·동점 정렬을 시험합니다.

## 감점 포인트

- 큰 JSON 숫자를 나중에 BigInt로 바꾸면 이미 잃은 정밀도가 복구된다고 한다.

## 더 파고들 거리

- JSON 숫자가 여러 언어를 왕복할 때 정확한 정수·금액을 어떤 표현으로 보존하나요?
- 정수·시각을 점수에 합칠 때 정밀도와 역순 동점 정렬을 어떻게 검증하나요?
- 입력 문자열을 숫자와 비교하기 전에 어떤 변환·범위·빈 값 검사를 수행하나요?

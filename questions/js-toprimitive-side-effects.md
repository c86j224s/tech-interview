---
id: "js-toprimitive-side-effects"
title: "객체를 숫자나 문자열과 연산할 때 valueOf·toString·Symbol.toPrimitive는 어떤 순서와 부수 효과를 만들 수 있나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","동등 비교","타입 변환","===","==","심화 질문"]
related: ["js-equality-coercion","js-object-copy"]
promotedFrom: {"id":"js-equality-coercion","prompt":"객체의 ToPrimitive 변환에서 `valueOf`와 `toString`은 언제 관여하나요?"}
---

# 객체를 숫자나 문자열과 연산할 때 valueOf·toString·Symbol.toPrimitive는 어떤 순서와 부수 효과를 만들 수 있나요?

## 구두 답변

객체의 primitive 변환은 Symbol.toPrimitive와 hint, 일반 valueOf·toString 순서 규칙에 영향을 받습니다. 변환 함수가 실행되므로 단순 비교·덧셈에도 부수 효과나 예외가 생길 수 있습니다.

+가 문자열 연결인지 숫자 덧셈인지 입력 타입을 명시합니다. 외부 객체의 변환 hook을 인가·금액 판단에 암묵 호출하지 않고 안전한 타입으로 검증합니다. Date 등 예외적 기본 hint도 확인합니다.

## 득점 포인트

- 객체의 primitive 변환은 Symbol.toPrimitive와 hint, 일반 valueOf·toString 순서 규칙에 영향을 받습니다. 변환 함수가 실행되므로 단순 비교·덧셈에도 부수 효과나 예외가 생길 수 있습니다.
- Date 등 예외적 기본 hint도 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 객체의 primitive 변환은 Symbol.toPrimitive와 hint, 일반 valueOf·toString 순서 규칙에 영향을 받습니다.

## 더 파고들 거리

- [기본 상황과 비교: 폼에서 받은 문자열 금액을 숫자와 비교했더니 빈 문자열도 0과 같다고 나옵니다. ==와 ===는 어떻게 다르며 입력을 어떤 순서로 검증하나요?](/tech-interview/questions/js-equality-coercion/)

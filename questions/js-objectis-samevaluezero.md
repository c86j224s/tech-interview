---
id: "js-objectis-samevaluezero"
title: "NaN과 -0을 Object.is·===·Set에서 비교합니다. 각 동일성 규칙은 어떤 차이가 있나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","동등 비교","타입 변환","===","==","심화 질문"]
related: ["js-equality-coercion","js-object-copy"]
promotedFrom: {"id":"js-equality-coercion","prompt":"Object.is와 SameValueZero는 NaN·-0을 어떤 컬렉션 의미로 다루나요?"}
---

# NaN과 -0을 Object.is·===·Set에서 비교합니다. 각 동일성 규칙은 어떤 차이가 있나요?

## 구두 답변

===는 NaN을 자신과도 다르다고 하고 +0과 -0을 같게 봅니다. Object.is는 NaN을 같게, +0과 -0을 다르게 보며 SameValueZero는 NaN과 두 0을 각각 같게 보는 컬렉션 규칙입니다.

Set·Map 키 동등성과 Object.is를 혼동하지 않습니다. 객체는 내용이 같아도 참조가 다르면 별개일 수 있습니다. 외부 숫자 파싱·부재·정밀도 문제는 동일성 규칙과 별도로 검증합니다.

## 득점 포인트

- ===는 NaN을 자신과도 다르다고 하고 +0과 -0을 같게 봅니다. Object.is는 NaN을 같게, +0과 -0을 다르게 보며 SameValueZero는 NaN과 두 0을 각각 같게 보는 컬렉션 규칙입니다.
- 외부 숫자 파싱·부재·정밀도 문제는 동일성 규칙과 별도로 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: ===는 NaN을 자신과도 다르다고 하고 +0과 -0을 같게 봅니다.

## 더 파고들 거리

- [기본 상황과 비교: 폼에서 받은 문자열 금액을 숫자와 비교했더니 빈 문자열도 0과 같다고 나옵니다. ==와 ===는 어떻게 다르며 입력을 어떤 순서로 검증하나요?](/tech-interview/questions/js-equality-coercion/)

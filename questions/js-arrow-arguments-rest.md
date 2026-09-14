---
id: "js-arrow-arguments-rest"
title: "화살표 함수에서 arguments를 읽었더니 바깥 함수 인자가 나옵니다. rest parameter는 어떤 대안인가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","화살표 함수","this","lexical this","심화 질문"]
related: ["js-arrow-this","js-this-binding"]
promotedFrom: {"id":"js-arrow-this","prompt":"화살표의 `arguments`가 필요할 때 rest parameter가 어떤 대안이 되나요?"}
---

# 화살표 함수에서 arguments를 읽었더니 바깥 함수 인자가 나옵니다. rest parameter는 어떤 대안인가요?

## 구두 답변

화살표는 자신의 arguments 바인딩을 만들지 않아 바깥 문맥의 값을 읽을 수 있습니다. 호출 인자를 직접 받으려면 (...args)처럼 rest parameter를 명시합니다.

rest는 배열이고 일반 arguments의 문맥·strict 의미와 차이가 있습니다. 중첩 함수·인자 없는 호출·callback 추가 인자를 시험합니다. arrow의 lexical this와 arguments는 관련 문법 특성이지만 생성마다 별도 수명을 가집니다.

## 득점 포인트

- 화살표는 자신의 arguments 바인딩을 만들지 않아 바깥 문맥의 값을 읽을 수 있습니다. 호출 인자를 직접 받으려면 (...args)처럼 rest parameter를 명시합니다.
- arrow의 lexical this와 arguments는 관련 문법 특성이지만 생성마다 별도 수명을 가집니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 화살표는 자신의 arguments 바인딩을 만들지 않아 바깥 문맥의 값을 읽을 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체 메서드 안에서 만든 화살표 함수와 일반 함수의 this가 서로 다른 값을 가리키는 이유는 무엇인가요?](/tech-interview/questions/js-arrow-this/)

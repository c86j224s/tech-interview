---
id: "foreach-parameter-loop-binding"
title: "forEach 매개변수와 for 문의 let은 callback마다 어떻게 다른 바인딩을 만들며 객체 공유는 어디에 남나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","클로저","스코프","var","let","심화 질문"]
related: ["js-closure-loop","js-hoisting-tdz"]
promotedFrom: {"id":"js-closure-loop","prompt":"forEach 콜백 매개변수와 for-loop의 let 바인딩은 어떤 점에서 같은 효과를 내나요?"}
---

# forEach 매개변수와 for 문의 let은 callback마다 어떻게 다른 바인딩을 만들며 객체 공유는 어디에 남나요?

## 구두 답변

forEach의 각 callback 호출 매개변수는 호출별 바인딩이고 let for 루프는 반복별 lexical binding을 만들 수 있습니다. var 하나를 공유하는 loop와 달리 숫자 값을 각 callback이 구분하기 쉽습니다.

바인딩이 달라도 같은 객체 참조를 값으로 받으면 내부 변경은 공유됩니다. forEach 안 async callback을 전체 완료 대기로 오해하지 않고 명시적인 Promise 집계를 사용합니다.

## 득점 포인트

- forEach의 각 callback 호출 매개변수는 호출별 바인딩이고 let for 루프는 반복별 lexical binding을 만들 수 있습니다. var 하나를 공유하는 loop와 달리 숫자 값을 각 callback이 구분하기 쉽습니다.
- forEach 안 async callback을 전체 완료 대기로 오해하지 않고 명시적인 Promise 집계를 사용합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: forEach의 각 callback 호출 매개변수는 호출별 바인딩이고 let for 루프는 반복별 lexical binding을 만들 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 반복문 안에서 만든 콜백이 마지막 값만 출력합니다. var와 let의 클로저 캡처는 왜 다르게 보이나요?](/tech-interview/questions/js-closure-loop/)

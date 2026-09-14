---
id: "js-function-declaration-expression-init"
title: "선언 전 함수를 호출합니다. 함수 선언문과 var·let에 넣은 함수 표현식은 언제 호출 가능해지나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","호이스팅","var","TDZ","심화 질문"]
related: ["js-hoisting-tdz","js-closure-loop"]
promotedFrom: {"id":"js-hoisting-tdz","prompt":"함수 선언문과 함수 표현식의 호출 가능 시점을 어떻게 비교할까요?"}
---

# 선언 전 함수를 호출합니다. 함수 선언문과 var·let에 넣은 함수 표현식은 언제 호출 가능해지나요?

## 구두 답변

함수 선언은 scope 초기화 과정에서 호출 가능한 함수로 준비되는 경우가 일반적이고, 함수 표현식을 담은 var는 할당 전 undefined이며 let·const는 초기화 전 TDZ에 있습니다.

block 함수 선언·strict·module의 규칙은 문맥별로 확인합니다. var 표현식 호출은 undefined를 함수처럼 써 TypeError가 날 수 있고 let은 ReferenceError가 날 수 있습니다. 선언 형식과 실행 시점을 분리합니다.

## 득점 포인트

- 함수 선언은 scope 초기화 과정에서 호출 가능한 함수로 준비되는 경우가 일반적이고, 함수 표현식을 담은 var는 할당 전 undefined이며 let·const는 초기화 전 TDZ에 있습니다.
- 선언 형식과 실행 시점을 분리합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 함수 선언은 scope 초기화 과정에서 호출 가능한 함수로 준비되는 경우가 일반적이고, 함수 표현식을 담은 var는 할당 전 undefined이며 let·const는 초기화 전 TDZ에 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 함수 안에서 선언문보다 먼저 변수를 읽었더니 var는 undefined이고 let·const는 ReferenceError입니다. 변수의 생성과 초기화 시점은 어떻게 다른가요?](/tech-interview/questions/js-hoisting-tdz/)

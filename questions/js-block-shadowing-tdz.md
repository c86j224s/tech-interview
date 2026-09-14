---
id: "js-block-shadowing-tdz"
title: "블록 밖 변수가 있는데 블록 안 let 선언 전에 읽으면 오류가 납니다. shadowing과 TDZ는 어떻게 적용되나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","호이스팅","var","TDZ","심화 질문"]
related: ["js-hoisting-tdz","js-closure-loop"]
promotedFrom: {"id":"js-hoisting-tdz","prompt":"중첩 블록의 shadowing이 바깥 변수를 언제 가리는지 어떤 예로 보일까요?"}
---

# 블록 밖 변수가 있는데 블록 안 let 선언 전에 읽으면 오류가 납니다. shadowing과 TDZ는 어떻게 적용되나요?

## 구두 답변

안쪽 let 바인딩은 블록 전체에서 바깥 이름을 가리지만 선언의 초기화 전에는 TDZ에 있습니다. 따라서 그 구간에서 바깥 값으로 자동 fallback하지 않고 ReferenceError가 날 수 있습니다.

같은 이름을 피하거나 초기화 순서를 명확히 합니다. typeof도 TDZ 바인딩에는 안전한 부재 검사로 일반화할 수 없습니다. 중첩 블록·함수·module·default 인자 문맥을 구분해 시험합니다.

## 득점 포인트

- 안쪽 let 바인딩은 블록 전체에서 바깥 이름을 가리지만 선언의 초기화 전에는 TDZ에 있습니다. 따라서 그 구간에서 바깥 값으로 자동 fallback하지 않고 ReferenceError가 날 수 있습니다.
- 중첩 블록·함수·module·default 인자 문맥을 구분해 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 안쪽 let 바인딩은 블록 전체에서 바깥 이름을 가리지만 선언의 초기화 전에는 TDZ에 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 함수 안에서 선언문보다 먼저 변수를 읽었더니 var는 undefined이고 let·const는 ReferenceError입니다. 변수의 생성과 초기화 시점은 어떻게 다른가요?](/tech-interview/questions/js-hoisting-tdz/)

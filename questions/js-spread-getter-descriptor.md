---
id: "js-spread-getter-descriptor"
title: "getter가 있는 객체를 spread로 복사합니다. getter 실행 시점과 새 프로퍼티 descriptor는 어떻게 달라지나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","객체 복사","spread","structuredClone","참조 공유","심화 질문"]
related: ["js-object-copy","js-prototype-lookup","js-equality-coercion"]
promotedFrom: {"id":"js-object-copy","prompt":"getter 프로퍼티를 spread할 때 값 평가와 descriptor가 어떻게 달라지나요?"}
---

# getter가 있는 객체를 spread로 복사합니다. getter 실행 시점과 새 프로퍼티 descriptor는 어떻게 달라지나요?

## 구두 답변

object spread는 enumerable own property 값을 읽으므로 getter가 실행될 수 있고 보통 새 객체에는 그 결과를 데이터 프로퍼티로 만듭니다. 원래 getter descriptor나 prototype을 그대로 복사하는 것은 아닙니다.

getter의 부수 효과·예외·순서와 중첩 참조 공유를 시험합니다. descriptor 자체를 보존해야 하면 명시적인 descriptor API를 검토하되 내부 자원과 인가 의미까지 복제되는 것은 아닙니다.

## 득점 포인트

- object spread는 enumerable own property 값을 읽으므로 getter가 실행될 수 있고 보통 새 객체에는 그 결과를 데이터 프로퍼티로 만듭니다. 원래 getter descriptor나 prototype을 그대로 복사하는 것은 아닙니다.
- descriptor 자체를 보존해야 하면 명시적인 descriptor API를 검토하되 내부 자원과 인가 의미까지 복제되는 것은 아닙니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: object spread는 enumerable own property 값을 읽으므로 getter가 실행될 수 있고 보통 새 객체에는 그 결과를 데이터 프로퍼티로 만듭니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체를 spread로 복사했는데 중첩 값이 함께 바뀝니다. 얕은 복사와 structuredClone의 범위는 어떻게 다른가요?](/tech-interview/questions/js-object-copy/)

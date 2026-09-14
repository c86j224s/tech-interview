---
id: "java-unboxing-promotion-order"
title: "래퍼 숫자가 섞인 산술식에서 null 예외가 납니다. unboxing과 numeric promotion은 어떤 순서로 적용되나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","autoboxing","unboxing","Integer","null","심화 질문"]
related: ["java-boxing-null","java-equals-hashcode"]
promotedFrom: {"id":"java-boxing-null","prompt":"복합 산술식의 binary numeric promotion과 unboxing 순서를 어떻게 추적할까요?"}
---

# 래퍼 숫자가 섞인 산술식에서 null 예외가 납니다. unboxing과 numeric promotion은 어떤 순서로 적용되나요?

## 구두 답변

산술 연산에 필요한 primitive로 unboxing한 뒤 numeric promotion이 적용될 수 있어 null 래퍼는 실제 계산 전에 예외를 만들 수 있습니다. ==도 상대 타입에 따라 참조 비교와 unboxing 비교가 달라집니다.

조건식·오버로드·래퍼 혼합의 타입을 단계별로 확인합니다. 부재를 0으로 숨기지 않고 명시적으로 처리하며 작은 캐시 정수의 참조 동일성에 의존하지 않습니다.

## 득점 포인트

- 산술 연산에 필요한 primitive로 unboxing한 뒤 numeric promotion이 적용될 수 있어 null 래퍼는 실제 계산 전에 예외를 만들 수 있습니다. ==도 상대 타입에 따라 참조 비교와 unboxing 비교가 달라집니다.
- 부재를 0으로 숨기지 않고 명시적으로 처리하며 작은 캐시 정수의 참조 동일성에 의존하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 산술 연산에 필요한 primitive로 unboxing한 뒤 numeric promotion이 적용될 수 있어 null 래퍼는 실제 계산 전에 예외를 만들 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Integer 비교가 작은 수에서는 맞아 보이는데 null에서는 예외가 납니다. boxing·unboxing과 ==의 비교 대상을 구분해 보세요.](/tech-interview/questions/java-boxing-null/)

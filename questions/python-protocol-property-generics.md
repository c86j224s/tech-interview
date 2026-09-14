---
id: "python-protocol-property-generics"
title: "Python Protocol에 property와 제네릭을 선언합니다. 정적 검사와 런타임 구조 검사는 어디까지 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","duck typing","Protocol","타입 힌트","런타임 검증","심화 질문"]
related: ["python-duck-typing"]
promotedFrom: {"id":"python-duck-typing","prompt":"Protocol에서 property·generic 타입을 표현할 때 정적 검사 범위는 어떻게 달라지나요?"}
---

# Python Protocol에 property와 제네릭을 선언합니다. 정적 검사와 런타임 구조 검사는 어디까지 다른가요?

## 구두 답변

Protocol의 property·generic·variance는 정적 분석기가 계약을 검사하는 데 사용됩니다. runtime_checkable 검사는 일반적으로 속성 존재 등의 구조 확인이며 모든 타입 인자·행동·예외를 증명하지 않습니다.

실제 값·반환·멱등성·thread safety는 계약 테스트가 필요합니다. 읽기 전용 property와 가변 속성의 분산 규칙을 구분하고 사용 checker·Python 버전을 기록합니다.

## 득점 포인트

- Protocol의 property·generic·variance는 정적 분석기가 계약을 검사하는 데 사용됩니다. runtime_checkable 검사는 일반적으로 속성 존재 등의 구조 확인이며 모든 타입 인자·행동·예외를 증명하지 않습니다.
- 읽기 전용 property와 가변 속성의 분산 규칙을 구분하고 사용 checker·Python 버전을 기록합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Protocol의 property·generic·variance는 정적 분석기가 계약을 검사하는 데 사용됩니다.

## 더 파고들 거리

- [기본 상황과 비교: 서로 다른 클래스의 객체를 close() 메서드만으로 처리하려 합니다. Python의 Protocol로 무엇을 검사할 수 있으며 런타임에도 같은 계약이 보장되나요?](/tech-interview/questions/python-duck-typing/)

---
id: "java-generic-array-reifiability"
title: "Java에서 List<String>[] 생성은 안 되는데 일부 wildcard 배열은 가능합니다. 런타임 타입 검사와 어떤 관계가 있나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","제네릭","타입 소거","reifiable type","ClassCastException","심화 질문"]
related: ["java-generics-erasure"]
promotedFrom: {"id":"java-generics-erasure","prompt":"제네릭 배열 생성이 금지되고 `List<?>[]` 일부가 허용되는 이유는 무엇인가요?"}
---

# Java에서 List<String>[] 생성은 안 되는데 일부 wildcard 배열은 가능합니다. 런타임 타입 검사와 어떤 관계가 있나요?

## 구두 답변

배열은 런타임 원소 타입 검사를 하므로 소거되는 구체 제네릭 타입의 배열을 일반적으로 생성할 수 없습니다. `List<?>`처럼 reifiable한 타입과 `List<String>`의 차이를 확인합니다.

배열 공변성과 제네릭 불공변성이 섞인 heap pollution을 설명합니다. unchecked cast로 경고를 지워도 실제 원소 계약이 보장되지는 않습니다. List 기반 표현과 경계 검증을 우선 검토합니다.

## 득점 포인트

- 배열은 런타임 원소 타입 검사를 하므로 소거되는 구체 제네릭 타입의 배열을 일반적으로 생성할 수 없습니다. `List<?>`처럼 reifiable한 타입과 `List<String>`의 차이를 확인합니다.
- List 기반 표현과 경계 검증을 우선 검토합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 배열은 런타임 원소 타입 검사를 하므로 소거되는 구체 제네릭 타입의 배열을 일반적으로 생성할 수 없습니다.

## 더 파고들 거리

- [기본 상황과 비교: `List<String>`의 원소 타입을 실행 중에도 검사할 수 있나요? Java 제네릭의 컴파일 검사와 타입 소거가 만드는 한계를 설명해 보세요.](/tech-interview/questions/java-generics-erasure/)

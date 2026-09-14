---
id: "java-bridge-method-erasure"
title: "제네릭 메서드를 override했더니 bridge method가 생깁니다. 타입 소거 뒤 dispatch를 어떻게 연결하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","제네릭","타입 소거","reifiable type","ClassCastException","심화 질문"]
related: ["java-generics-erasure"]
promotedFrom: {"id":"java-generics-erasure","prompt":"브리지 메서드는 소거된 시그니처와 override를 어떻게 연결하나요?"}
---

# 제네릭 메서드를 override했더니 bridge method가 생깁니다. 타입 소거 뒤 dispatch를 어떻게 연결하나요?

## 구두 답변

타입 소거 뒤 부모의 erased 메서드와 자식의 구체 signature가 달라질 수 있습니다. compiler는 bridge로 필요한 cast·호출을 연결해 override의 동작을 유지할 수 있습니다.

bytecode·reflection에 보이는 bridge와 개발자가 작성한 overload를 구분합니다. raw type을 잘못 사용하면 bridge의 cast에서 예외가 날 수 있습니다. 컴파일 타입 안전성과 런타임 입력 검증을 함께 봅니다.

## 득점 포인트

- 타입 소거 뒤 부모의 erased 메서드와 자식의 구체 signature가 달라질 수 있습니다. compiler는 bridge로 필요한 cast·호출을 연결해 override의 동작을 유지할 수 있습니다.
- 컴파일 타입 안전성과 런타임 입력 검증을 함께 봅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 타입 소거 뒤 부모의 erased 메서드와 자식의 구체 signature가 달라질 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: `List<String>`의 원소 타입을 실행 중에도 검사할 수 있나요? Java 제네릭의 컴파일 검사와 타입 소거가 만드는 한계를 설명해 보세요.](/tech-interview/questions/java-generics-erasure/)

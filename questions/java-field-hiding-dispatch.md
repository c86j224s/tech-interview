---
id: "java-field-hiding-dispatch"
title: "선언 타입은 부모이고 실제 객체는 자식입니다. 같은 이름의 필드와 override 메서드는 왜 다르게 선택되나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","오버로딩","오버라이딩","컴파일 타임","동적 디스패치","심화 질문"]
related: ["java-overload-override","java-annotation-retention"]
promotedFrom: {"id":"java-overload-override","prompt":"필드 접근과 인스턴스 메서드 호출의 바인딩이 다른 이유는 무엇인가요?"}
---

# 선언 타입은 부모이고 실제 객체는 자식입니다. 같은 이름의 필드와 override 메서드는 왜 다르게 선택되나요?

## 구두 답변

필드 접근은 표현식의 정적 타입에 의해 선택되는 반면 override 가능한 인스턴스 메서드는 실제 객체의 동적 타입을 따라 dispatch합니다. 같은 이름의 필드는 override가 아니라 hiding일 수 있습니다.

부모 참조·자식 cast·static 메서드·private 메서드를 작은 예제로 구분합니다. 필드 hiding은 혼동을 늘릴 수 있어 명확한 API를 선택합니다. 컴파일된 overload 선택과 실행 시 override도 별도 단계입니다.

## 득점 포인트

- 필드 접근은 표현식의 정적 타입에 의해 선택되는 반면 override 가능한 인스턴스 메서드는 실제 객체의 동적 타입을 따라 dispatch합니다. 같은 이름의 필드는 override가 아니라 hiding일 수 있습니다.
- 컴파일된 overload 선택과 실행 시 override도 별도 단계입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 필드 접근은 표현식의 정적 타입에 의해 선택되는 반면 override 가능한 인스턴스 메서드는 실제 객체의 동적 타입을 따라 dispatch합니다.

## 더 파고들 거리

- [기본 상황과 비교: 선언 타입은 A지만 실제 객체는 B일 때, 오버로딩과 오버라이딩은 메서드를 각각 언제 결정하나요?](/tech-interview/questions/java-overload-override/)

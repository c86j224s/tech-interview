---
id: "java-null-overload-ambiguity"
title: "서로 관련 없는 두 참조 타입의 overload에 null을 넘깁니다. 가장 구체적인 메서드가 없으면 어떻게 되나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","오버로딩","오버라이딩","컴파일 타임","동적 디스패치","심화 질문"]
related: ["java-overload-override","java-annotation-retention"]
promotedFrom: {"id":"java-overload-override","prompt":"null 리터럴에서 가장 구체적인 overload가 하나가 아닐 때 컴파일러는 어떻게 거절하나요?"}
---

# 서로 관련 없는 두 참조 타입의 overload에 null을 넘깁니다. 가장 구체적인 메서드가 없으면 어떻게 되나요?

## 구두 답변

String과 Integer처럼 서로 하위 관계가 없는 overload에 null을 주면 둘 다 적용 가능하지만 가장 구체적인 하나가 없어 컴파일 오류가 될 수 있습니다. 런타임 객체로 선택하는 override와 다른 단계입니다.

명시적 cast는 의도를 고정할 수 있지만 API overload가 과도하게 모호한지 검토합니다. varargs·boxing·상속을 포함한 최소 예제로 컴파일 선택을 확인합니다.

## 득점 포인트

- String과 Integer처럼 서로 하위 관계가 없는 overload에 null을 주면 둘 다 적용 가능하지만 가장 구체적인 하나가 없어 컴파일 오류가 될 수 있습니다. 런타임 객체로 선택하는 override와 다른 단계입니다.
- varargs·boxing·상속을 포함한 최소 예제로 컴파일 선택을 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: String과 Integer처럼 서로 하위 관계가 없는 overload에 null을 주면 둘 다 적용 가능하지만 가장 구체적인 하나가 없어 컴파일 오류가 될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 선언 타입은 A지만 실제 객체는 B일 때, 오버로딩과 오버라이딩은 메서드를 각각 언제 결정하나요?](/tech-interview/questions/java-overload-override/)

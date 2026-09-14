---
id: "java-equals-inheritance-symmetry"
title: "상속한 값 객체에 필드를 추가하자 equals의 대칭성·추이성이 깨집니다. 어떤 동등성 경계를 선택하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","equals","hashCode","HashSet","가변 키","심화 질문"]
related: ["java-equals-hashcode","java-boxing-null"]
promotedFrom: {"id":"java-equals-hashcode","prompt":"상속 기반 equals에서 대칭성과 추이성이 깨지는 예를 어떻게 피할까요?"}
---

# 상속한 값 객체에 필드를 추가하자 equals의 대칭성·추이성이 깨집니다. 어떤 동등성 경계를 선택하나요?

## 구두 답변

부모 equals가 자식을 같은 값으로 보는데 자식은 추가 필드까지 요구하면 대칭성이나 추이성이 깨질 수 있습니다. 동등성의 타입 경계와 비교할 필드를 일관되게 정합니다.

getClass 비교·최종 값 타입·조합 등 대안을 선택하고 hashCode도 같은 의미를 따르게 합니다. 부모·자식·세 번째 객체의 양방향 비교와 HashSet 동작을 시험합니다.

## 득점 포인트

- 부모 equals가 자식을 같은 값으로 보는데 자식은 추가 필드까지 요구하면 대칭성이나 추이성이 깨질 수 있습니다. 동등성의 타입 경계와 비교할 필드를 일관되게 정합니다.
- 부모·자식·세 번째 객체의 양방향 비교와 HashSet 동작을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 부모 equals가 자식을 같은 값으로 보는데 자식은 추가 필드까지 요구하면 대칭성이나 추이성이 깨질 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체의 필드를 바꾼 뒤 HashSet에서 그 객체를 찾지 못합니다. equals와 hashCode의 계약과 가변 키의 문제를 설명해 보세요.](/tech-interview/questions/java-equals-hashcode/)

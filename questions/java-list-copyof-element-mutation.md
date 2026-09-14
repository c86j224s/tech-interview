---
id: "java-list-copyof-element-mutation"
title: "List.copyOf로 목록을 복사했는데 원소의 필드는 바뀝니다. 컬렉션 불변성과 원소의 깊은 불변은 어떻게 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","final","참조","불변성","방어적 복사","심화 질문"]
related: ["java-final-immutability","java-equals-hashcode"]
promotedFrom: {"id":"java-final-immutability","prompt":"List.copyOf의 원소가 가변일 때 어느 깊이까지 복사해야 할까요?"}
---

# List.copyOf로 목록을 복사했는데 원소의 필드는 바뀝니다. 컬렉션 불변성과 원소의 깊은 불변은 어떻게 다른가요?

## 구두 답변

List.copyOf는 목록 구조를 수정할 수 없는 복사본을 제공하지만 원소 객체까지 깊게 복제하지는 않습니다. 원소가 가변이면 기존 참조를 통해 두 목록에서 같은 변경이 보일 수 있습니다.

깊은 불변이 필요하면 원소를 불변 값으로 변환하거나 필요한 깊이의 방어 복사를 수행합니다. null 처리·view와 copy의 차이·중첩 collection을 시험합니다. 비용이 큰 전체 복사 대신 구조적 공유의 전제를 비교합니다.

## 득점 포인트

- List.copyOf는 목록 구조를 수정할 수 없는 복사본을 제공하지만 원소 객체까지 깊게 복제하지는 않습니다. 원소가 가변이면 기존 참조를 통해 두 목록에서 같은 변경이 보일 수 있습니다.
- 비용이 큰 전체 복사 대신 구조적 공유의 전제를 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: List.copyOf는 목록 구조를 수정할 수 없는 복사본을 제공하지만 원소 객체까지 깊게 복제하지는 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: final List를 선언했는데도 원소가 바뀝니다. final 변수, 참조 대상 객체의 변경, 진짜 불변 객체를 어떻게 구분하나요?](/tech-interview/questions/java-final-immutability/)

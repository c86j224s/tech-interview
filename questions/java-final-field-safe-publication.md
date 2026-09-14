---
id: "java-final-field-safe-publication"
title: "생성자에서 final 필드를 채운 객체를 공유합니다. final 필드 가시성과 this escape·중첩 가변성은 어떻게 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","final","참조","불변성","방어적 복사","심화 질문"]
related: ["java-final-immutability","java-equals-hashcode"]
promotedFrom: {"id":"java-final-immutability","prompt":"final 필드의 생성자 안전 공개와 참조 대상의 가변성은 어떤 메모리 모델 차이가 있나요?"}
---

# 생성자에서 final 필드를 채운 객체를 공유합니다. final 필드 가시성과 this escape·중첩 가변성은 어떻게 다른가요?

## 구두 답변

올바르게 생성된 final 필드는 Java 메모리 모델의 특별한 초기화 가시성 보장을 가질 수 있지만 생성자에서 this가 탈출하면 전제가 깨질 수 있습니다. 이후 가변 객체의 변경은 별도 동기화가 필요합니다.

생성 중 listener 등록·thread 시작·전역 저장을 피합니다. final 참조가 가리키는 목록을 외부가 바꾸지 못하게 방어 복사하고 일반 필드 게시와 혼동하지 않습니다.

## 득점 포인트

- 올바르게 생성된 final 필드는 Java 메모리 모델의 특별한 초기화 가시성 보장을 가질 수 있지만 생성자에서 this가 탈출하면 전제가 깨질 수 있습니다. 이후 가변 객체의 변경은 별도 동기화가 필요합니다.
- final 참조가 가리키는 목록을 외부가 바꾸지 못하게 방어 복사하고 일반 필드 게시와 혼동하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 올바르게 생성된 final 필드는 Java 메모리 모델의 특별한 초기화 가시성 보장을 가질 수 있지만 생성자에서 this가 탈출하면 전제가 깨질 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: final List를 선언했는데도 원소가 바뀝니다. final 변수, 참조 대상 객체의 변경, 진짜 불변 객체를 어떻게 구분하나요?](/tech-interview/questions/java-final-immutability/)

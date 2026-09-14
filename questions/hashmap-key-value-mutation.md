---
id: "hashmap-key-value-mutation"
title: "HashMap에서 value 필드 변경과 key의 비교 필드 변경은 조회에 왜 다른 영향을 주나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","equals","hashCode","HashSet","가변 키","심화 질문"]
related: ["java-equals-hashcode","java-boxing-null"]
promotedFrom: {"id":"java-equals-hashcode","prompt":"HashMap에서 값 변경과 키 변경의 조회 결과는 왜 다를까요?"}
---

# HashMap에서 value 필드 변경과 key의 비교 필드 변경은 조회에 왜 다른 영향을 주나요?

## 구두 답변

value의 내부 변경은 일반적으로 key의 hash 위치를 바꾸지 않지만 key의 equals·hashCode 필드 변경은 저장 당시 bucket과 조회 계산을 어긋나게 할 수 있습니다.

키를 불변 값으로 만들거나 변경 전 삭제 후 재삽입합니다. key가 value와 같은 객체를 공유하는 간접 mutation도 확인합니다. reference identity와 업무 동등성, map 자체 동시성도 별도로 검사합니다.

## 득점 포인트

- value의 내부 변경은 일반적으로 key의 hash 위치를 바꾸지 않지만 key의 equals·hashCode 필드 변경은 저장 당시 bucket과 조회 계산을 어긋나게 할 수 있습니다.
- reference identity와 업무 동등성, map 자체 동시성도 별도로 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: value의 내부 변경은 일반적으로 key의 hash 위치를 바꾸지 않지만 key의 equals·hashCode 필드 변경은 저장 당시 bucket과 조회 계산을 어긋나게 할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체의 필드를 바꾼 뒤 HashSet에서 그 객체를 찾지 못합니다. equals와 hashCode의 계약과 가변 키의 문제를 설명해 보세요.](/tech-interview/questions/java-equals-hashcode/)

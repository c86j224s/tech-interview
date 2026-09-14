---
id: "java-volatile-happens-before"
title: "일반 필드를 쓴 뒤 volatile 준비 플래그를 켭니다. 소비자가 어떤 쓰기를 읽을 때 데이터 가시성이 연결되나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","synchronized","volatile","가시성","원자성","심화 질문"]
related: ["java-synchronized-volatile","java-threadlocal-pool"]
promotedFrom: {"id":"java-synchronized-volatile","prompt":"volatile 게시에서 일반 필드가 보이는 happens-before 경로를 어떻게 증명할까요?"}
---

# 일반 필드를 쓴 뒤 volatile 준비 플래그를 켭니다. 소비자가 어떤 쓰기를 읽을 때 데이터 가시성이 연결되나요?

## 구두 답변

생산자가 일반 필드를 쓴 뒤 volatile에 게시하고 소비자가 그 게시와 동기화되는 volatile 읽기를 수행하면 happens-before로 이전 쓰기가 보일 수 있습니다. 단지 volatile 변수가 존재한다고 모든 읽기가 최신인 것은 아닙니다.

게시 뒤 다시 바꾸는 가변 필드와 복합 갱신은 별도 보호합니다. 소비자가 다른 flag나 오래된 참조를 읽는 경로를 검사합니다. 생성 중 this escape와 final 규칙도 volatile의 보장과 구분합니다.

## 득점 포인트

- 생산자가 일반 필드를 쓴 뒤 volatile에 게시하고 소비자가 그 게시와 동기화되는 volatile 읽기를 수행하면 happens-before로 이전 쓰기가 보일 수 있습니다. 단지 volatile 변수가 존재한다고 모든 읽기가 최신인 것은 아닙니다.
- 생성 중 this escape와 final 규칙도 volatile의 보장과 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 생산자가 일반 필드를 쓴 뒤 volatile에 게시하고 소비자가 그 게시와 동기화되는 volatile 읽기를 수행하면 happens-before로 이전 쓰기가 보일 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 공유 카운터에 volatile을 붙였는데도 최종 값이 작습니다. synchronized와 volatile은 가시성과 복합 연산을 어떻게 다르게 보장하나요?](/tech-interview/questions/java-synchronized-volatile/)

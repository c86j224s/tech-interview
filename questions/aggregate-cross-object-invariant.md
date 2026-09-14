---
id: "aggregate-cross-object-invariant"
title: "서로 다른 객체 두 개가 함께 지켜야 할 규칙이 있습니다. aggregate·서비스 transaction의 경계를 어떻게 정하나요?"
difficulty: "중하"
category: "설계"
tags: ["객체 지향","캡슐화","불변식","심화 질문"]
related: ["oop-encapsulation"]
promotedFrom: {"id":"oop-encapsulation","prompt":"서로 연관된 두 객체의 불변식을 한 객체가 함께 보장해야 할 때 경계를 어떻게 정할까요?"}
---

# 서로 다른 객체 두 개가 함께 지켜야 할 규칙이 있습니다. aggregate·서비스 transaction의 경계를 어떻게 정하나요?

## 구두 답변

두 객체가 함께 바뀌어야 할 불변식의 원자 범위를 먼저 정합니다. 같은 DB transaction 안 aggregate로 묶거나 상위 서비스가 조정하며, 별도 시스템이면 중간 상태·보상을 명시합니다.

A 차감 뒤 B 증가 실패는 각 객체의 잔액이 비음수여도 전체 합을 깨뜨릴 수 있습니다. private setter만으로 해결되지 않습니다. 상태 전이·동시 요청·예외·외부 효과를 함께 시험합니다.

## 득점 포인트

- 두 객체가 함께 바뀌어야 할 불변식의 원자 범위를 먼저 정합니다. 같은 DB transaction 안 aggregate로 묶거나 상위 서비스가 조정하며, 별도 시스템이면 중간 상태·보상을 명시합니다.
- 상태 전이·동시 요청·예외·외부 효과를 함께 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 두 객체가 함께 바뀌어야 할 불변식의 원자 범위를 먼저 정합니다.

## 더 파고들 거리

- [기본 상황과 비교: 주문 객체의 필드를 private으로 바꿨지만 setter로 음수 금액이나 잘못된 상태를 넣을 수 있습니다. 캡슐화가 보호해야 할 규칙은 무엇이며 API를 어떻게 바꾸나요?](/tech-interview/questions/oop-encapsulation/)

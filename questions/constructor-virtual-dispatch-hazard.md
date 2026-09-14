---
id: "constructor-virtual-dispatch-hazard"
title: "부모 생성자에서 재정의 가능한 메서드를 호출합니다. 자식 초기화 순서와 언어별 dispatch 때문에 어떤 문제가 생기나요?"
difficulty: "중하"
category: "설계"
tags: ["상속","조합","위임","다형성","심화 질문"]
related: ["inheritance-composition","service-boundary-design"]
promotedFrom: {"id":"inheritance-composition","prompt":"상속 계층이 깊어질 때 생성자 호출과 메서드 재정의 순서가 어떤 위험을 만들까요?"}
---

# 부모 생성자에서 재정의 가능한 메서드를 호출합니다. 자식 초기화 순서와 언어별 dispatch 때문에 어떤 문제가 생기나요?

## 구두 답변

Java에서는 부모 생성자의 virtual 호출이 아직 초기화되지 않은 자식 상태를 읽을 수 있습니다. C++ 생성·소멸 중 virtual dispatch는 현재 생성 단계의 클래스 규칙을 따라 Java와 같지 않습니다.

언어별 계약을 구분하고 생성 중 외부 공개·callback을 피합니다. 필요한 초기화는 완성 후 명시적 단계나 위임으로 옮기고 예외·상속 계층을 시험합니다.

## 득점 포인트

- Java에서는 부모 생성자의 virtual 호출이 아직 초기화되지 않은 자식 상태를 읽을 수 있습니다. C++ 생성·소멸 중 virtual dispatch는 현재 생성 단계의 클래스 규칙을 따라 Java와 같지 않습니다.
- 필요한 초기화는 완성 후 명시적 단계나 위임으로 옮기고 예외·상속 계층을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Java에서는 부모 생성자의 virtual 호출이 아직 초기화되지 않은 자식 상태를 읽을 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 알림 채널마다 로깅·재시도 기능을 조합하다 보니 하위 클래스가 계속 늘어납니다. 어떤 책임을 분리하고 상속과 조합 중 무엇을 선택하나요?](/tech-interview/questions/inheritance-composition/)

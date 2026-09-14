---
id: "lazy-initialization-publication-failure"
title: "공유 객체를 지연 초기화합니다. 생성자 예외·불완전 공개·동시 첫 접근은 어떻게 처리하나요?"
difficulty: "중하"
category: "설계"
tags: ["Singleton","전역 상태","초기화","스레드 안전성","심화 질문"]
related: ["singleton-global-state","configuration-validation"]
promotedFrom: {"id":"singleton-global-state","prompt":"지연 초기화에서 메모리 가시성과 생성자 예외를 안전하게 처리하는 방법은 무엇인가요?"}
---

# 공유 객체를 지연 초기화합니다. 생성자 예외·불완전 공개·동시 첫 접근은 어떻게 처리하나요?

## 구두 답변

초기화 중인 객체를 공개하지 않고 언어의 검증된 정적·lazy 초기화 기능을 우선합니다. 생성 실패 후 재시도할지 영구 실패로 둘지는 API 계약을 확인해야 합니다.

초기화 함수의 재진입·서로 의존하는 singleton cycle·외부 I/O를 주의합니다. double-checked locking은 올바른 memory model 전제가 필요합니다. 생성 한 번의 안전성과 이후 가변 필드 동시성은 별도입니다.

## 득점 포인트

- 초기화 중인 객체를 공개하지 않고 언어의 검증된 정적·lazy 초기화 기능을 우선합니다. 생성 실패 후 재시도할지 영구 실패로 둘지는 API 계약을 확인해야 합니다.
- 생성 한 번의 안전성과 이후 가변 필드 동시성은 별도입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 초기화 중인 객체를 공개하지 않고 언어의 검증된 정적·lazy 초기화 기능을 우선합니다.

## 더 파고들 거리

- [기본 상황과 비교: 싱글턴으로 만든 설정 객체가 테스트와 여러 스레드에서 문제를 일으킵니다. 유일한 인스턴스와 전역 상태는 왜 다른 문제인가요?](/tech-interview/questions/singleton-global-state/)

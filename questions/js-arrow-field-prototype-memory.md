---
id: "js-arrow-field-prototype-memory"
title: "클래스의 화살표 함수 필드와 prototype 메서드는 함수 공유·this·메모리에서 어떻게 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","화살표 함수","this","lexical this","심화 질문"]
related: ["js-arrow-this","js-this-binding"]
promotedFrom: {"id":"js-arrow-this","prompt":"클래스 인스턴스의 화살표 필드와 prototype 메서드는 메모리·this에서 어떻게 다를까요?"}
---

# 클래스의 화살표 함수 필드와 prototype 메서드는 함수 공유·this·메모리에서 어떻게 다른가요?

## 구두 답변

prototype 메서드는 여러 인스턴스가 함수 객체를 공유할 수 있고 호출 방식에 따라 this가 정해집니다. 화살표 필드는 보통 인스턴스마다 함수가 만들어져 생성 문맥의 this를 캡처합니다.

callback 전달의 편의와 함수 수·메모리·상속·테스트 비용을 비교합니다. arrow가 모든 문제를 해결하지 않고 캡처한 객체를 listener가 오래 붙잡을 수 있어 해제 수명을 관리합니다.

## 득점 포인트

- prototype 메서드는 여러 인스턴스가 함수 객체를 공유할 수 있고 호출 방식에 따라 this가 정해집니다. 화살표 필드는 보통 인스턴스마다 함수가 만들어져 생성 문맥의 this를 캡처합니다.
- arrow가 모든 문제를 해결하지 않고 캡처한 객체를 listener가 오래 붙잡을 수 있어 해제 수명을 관리합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: prototype 메서드는 여러 인스턴스가 함수 객체를 공유할 수 있고 호출 방식에 따라 this가 정해집니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체 메서드 안에서 만든 화살표 함수와 일반 함수의 this가 서로 다른 값을 가리키는 이유는 무엇인가요?](/tech-interview/questions/js-arrow-this/)

---
id: "js-callback-bind-arrow-wrapper"
title: "메서드를 callback으로 넘깁니다. bind·화살표 필드·래퍼 함수는 this·함수 정체성·메모리에서 어떻게 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","this","strict mode","bind","심화 질문"]
related: ["js-this-binding","js-arrow-this"]
promotedFrom: {"id":"js-this-binding","prompt":"class 메서드를 콜백으로 넘길 때 bind·화살표·래퍼 중 무엇을 고를까요?"}
---

# 메서드를 callback으로 넘깁니다. bind·화살표 필드·래퍼 함수는 this·함수 정체성·메모리에서 어떻게 다른가요?

## 구두 답변

bind는 this와 일부 인자를 고정한 새 함수, wrapper는 호출을 감싸는 새 함수, arrow 필드는 생성 문맥의 this를 캡처하는 인스턴스별 함수라는 차이가 있습니다.

listener 제거에는 등록한 같은 함수 참조가 필요하므로 매번 bind하거나 새 wrapper를 만들지 않습니다. 메모리·상속·callback 인자와 예외를 비교하고 소유 객체가 사라질 때 등록도 해제합니다.

## 득점 포인트

- bind는 this와 일부 인자를 고정한 새 함수, wrapper는 호출을 감싸는 새 함수, arrow 필드는 생성 문맥의 this를 캡처하는 인스턴스별 함수라는 차이가 있습니다.
- 메모리·상속·callback 인자와 예외를 비교하고 소유 객체가 사라질 때 등록도 해제합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: bind는 this와 일부 인자를 고정한 새 함수, wrapper는 호출을 감싸는 새 함수, arrow 필드는 생성 문맥의 this를 캡처하는 인스턴스별 함수라는 차이가 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체 메서드를 변수에 담아 호출했더니 this가 달라집니다. strict 환경에서 왜 실패하며 어떻게 고정하나요?](/tech-interview/questions/js-this-binding/)

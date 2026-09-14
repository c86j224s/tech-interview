---
id: "python-weakref-ownership"
title: "Python observer와 cache의 참조를 weakref로 바꾸려 합니다. 실제 소유 관계와 수명 보장을 어떻게 구분하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","CPython","참조 카운트","순환 GC","with","심화 질문"]
related: ["python-refcount-cycles"]
promotedFrom: {"id":"python-refcount-cycles","prompt":"weakref가 소유 순환을 끊는 데 적합한 관계는 무엇인가요?"}
---

# Python observer와 cache의 참조를 weakref로 바꾸려 합니다. 실제 소유 관계와 수명 보장을 어떻게 구분하나요?

## 구두 답변

weakref는 관찰 관계가 객체 수명을 연장하지 않게 할 수 있지만 실제 소유자를 대신할 수 없습니다. callback·cache가 반드시 객체를 유지해야 하는지 먼저 정합니다.

약한 참조를 얻은 뒤 유효한 강한 지역 참조로 사용하는 패턴과 동시 소멸을 고려합니다. 모든 타입이 weakref를 지원하는지 확인합니다. 순환 제거 뒤에도 다른 root가 남는지 gc·heap·RSS를 대조합니다.

## 득점 포인트

- weakref는 관찰 관계가 객체 수명을 연장하지 않게 할 수 있지만 실제 소유자를 대신할 수 없습니다. callback·cache가 반드시 객체를 유지해야 하는지 먼저 정합니다.
- 순환 제거 뒤에도 다른 root가 남는지 gc·heap·RSS를 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: weakref는 관찰 관계가 객체 수명을 연장하지 않게 할 수 있지만 실제 소유자를 대신할 수 없습니다.

## 더 파고들 거리

- [기본 상황과 비교: CPython 객체를 사용하던 외부 참조를 지웠는데 객체끼리 서로를 참조하고 있습니다. 메모리는 언제 회수되며 파일 닫기도 그 시점에 맡겨도 되나요?](/tech-interview/questions/python-refcount-cycles/)

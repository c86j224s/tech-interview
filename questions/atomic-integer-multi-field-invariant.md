---
id: "atomic-integer-multi-field-invariant"
title: "각 카운터를 AtomicInteger로 바꿨습니다. 두 카운터 합계 같은 복합 불변식에는 왜 별도 원자 경계가 필요한가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","synchronized","volatile","가시성","원자성","심화 질문"]
related: ["java-synchronized-volatile","java-threadlocal-pool"]
promotedFrom: {"id":"java-synchronized-volatile","prompt":"AtomicInteger와 synchronized는 복합 불변식에서 어떤 표현력 차이가 있나요?"}
---

# 각 카운터를 AtomicInteger로 바꿨습니다. 두 카운터 합계 같은 복합 불변식에는 왜 별도 원자 경계가 필요한가요?

## 구두 답변

각 카운터 증가가 원자적이어도 두 값을 함께 읽거나 A 감소·B 증가를 하나의 거래로 수행하는 것은 원자적이지 않습니다. 독자는 중간 조합을 볼 수 있습니다.

공통 lock·불변 묶음 CAS·단일 owner 등으로 불변식 범위를 보호합니다. AtomicInteger를 썼다는 사실만으로 전체 transaction이 되지 않습니다. 동시 읽기·예외·재시도에서 합계와 외부 효과를 검사합니다.

## 득점 포인트

- 각 카운터 증가가 원자적이어도 두 값을 함께 읽거나 A 감소·B 증가를 하나의 거래로 수행하는 것은 원자적이지 않습니다. 독자는 중간 조합을 볼 수 있습니다.
- 동시 읽기·예외·재시도에서 합계와 외부 효과를 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 각 카운터 증가가 원자적이어도 두 값을 함께 읽거나 A 감소·B 증가를 하나의 거래로 수행하는 것은 원자적이지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: 공유 카운터에 volatile을 붙였는데도 최종 값이 작습니다. synchronized와 volatile은 가시성과 복합 연산을 어떻게 다르게 보장하나요?](/tech-interview/questions/java-synchronized-volatile/)

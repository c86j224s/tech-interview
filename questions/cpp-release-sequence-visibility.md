---
id: "cpp-release-sequence-visibility"
title: "C++ release store 뒤 다른 스레드의 atomic RMW가 이어집니다. release sequence는 어떤 조건에서 이전 데이터를 공개하나요?"
difficulty: "중하"
category: "동시성"
tags: ["원자 연산","메모리 모델","가시성","심화 질문"]
related: ["atomics-memory-order","mutex-vs-serial-execution"]
promotedFrom: {"id":"atomics-memory-order","prompt":"release sequence가 여러 atomic 연산에 만드는 가시성 관계는 무엇인가요?"}
---

# C++ release store 뒤 다른 스레드의 atomic RMW가 이어집니다. release sequence는 어떤 조건에서 이전 데이터를 공개하나요?

## 구두 답변

release sequence에 속한 값을 acquire가 읽으면 그 head release 이전 쓰기의 가시성이 연결될 수 있습니다. 단순히 같은 atomic 변수에 연산이 이어졌다는 것만으로 모든 쓰기가 연결되는 것은 아닙니다.

C++20 이후 정의에서는 head 뒤 이어지는 RMW 연산의 조건을 확인해야 하며 중간의 일반 atomic store는 sequence를 끊을 수 있습니다. RMW가 relaxed라도 어떤 값을 읽은 acquire인지와 modification order를 확인합니다. 여러 atomic 객체의 임의 조합까지 원자 snapshot으로 만들지는 않습니다.

## 득점 포인트

- release sequence에 속한 값을 acquire가 읽으면 그 head release 이전 쓰기의 가시성이 연결될 수 있습니다. 단순히 같은 atomic 변수에 연산이 이어졌다는 것만으로 모든 쓰기가 연결되는 것은 아닙니다.
- 여러 atomic 객체의 임의 조합까지 원자 snapshot으로 만들지는 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: release sequence에 속한 값을 acquire가 읽으면 그 head release 이전 쓰기의 가시성이 연결될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: C++에서 결과를 채운 뒤 atomic 준비 플래그를 켭니다. 다른 스레드가 플래그를 보고 결과를 읽으면 항상 안전한가요?](/tech-interview/questions/atomics-memory-order/)

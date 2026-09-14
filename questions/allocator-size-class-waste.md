---
id: "allocator-size-class-waste"
title: "할당기가 크기 등급으로 메모리를 관리합니다. 내부 낭비와 자유 공간 재사용은 어떻게 맞바뀌나요?"
difficulty: "중하"
category: "운영체제"
tags: ["단편화","메모리 할당","가상 메모리","심화 질문"]
related: ["memory-fragmentation","memory-rss-vs-heap"]
promotedFrom: {"id":"memory-fragmentation","prompt":"size class가 내부 단편화를 줄이는 대신 만들 수 있는 낭비는 무엇인가요?"}
---

# 할당기가 크기 등급으로 메모리를 관리합니다. 내부 낭비와 자유 공간 재사용은 어떻게 맞바뀌나요?

## 구두 답변

size class는 비슷한 크기의 요청을 재사용 가능한 블록으로 묶어 할당을 단순화하지만 요청보다 큰 블록을 주는 내부 낭비가 생길 수 있습니다. 등급이 너무 많으면 풀별 유휴와 메타데이터가 늘 수 있습니다.

할당 크기 분포·보유 기간·thread cache·큰 객체를 구분해 측정합니다. 총 free가 있어도 다른 class나 arena에 묶일 수 있습니다. 실제 누수와 allocator 보관·회수 정책을 profile로 나눕니다.

## 득점 포인트

- size class는 비슷한 크기의 요청을 재사용 가능한 블록으로 묶어 할당을 단순화하지만 요청보다 큰 블록을 주는 내부 낭비가 생길 수 있습니다. 등급이 너무 많으면 풀별 유휴와 메타데이터가 늘 수 있습니다.
- 실제 누수와 allocator 보관·회수 정책을 profile로 나눕니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: size class는 비슷한 크기의 요청을 재사용 가능한 블록으로 묶어 할당을 단순화하지만 요청보다 큰 블록을 주는 내부 낭비가 생길 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 메모리 총 여유는 충분한데 큰 연속 영역 할당이 실패할 수 있나요?](/tech-interview/questions/memory-fragmentation/)

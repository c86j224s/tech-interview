---
id: "clock-page-replacement-approximation"
title: "Clock은 접근 비트로 최근성을 근사합니다. 어떤 참조 패턴에서 LRU와 다른 페이지를 제거하나요?"
difficulty: "중하"
category: "운영체제"
tags: ["페이지 교체","작업 집합","스래싱","심화 질문"]
related: ["page-replacement-thrashing","virtual-memory-page-fault"]
promotedFrom: {"id":"page-replacement-thrashing","prompt":"Clock이 접근 비트로 LRU를 근사할 때 어떤 참조 패턴에서 오차가 커질까요?"}
---

# Clock은 접근 비트로 최근성을 근사합니다. 어떤 참조 패턴에서 LRU와 다른 페이지를 제거하나요?

## 구두 답변

Clock은 참조 비트를 보고 최근 사용한 후보에 두 번째 기회를 주는 근사 방식입니다. 정확한 접근 순서 목록이 아니므로 비트가 모두 켜진 스캔·특정 반복 패턴에서 LRU와 다른 선택을 할 수 있습니다.

hand 진행·비트 초기화·dirty page 비용·working set을 확인합니다. fault 수뿐 아니라 writeback·지연·프로세스 간 간섭을 같은 trace로 비교합니다. 근사가 정확히 같은 eviction 순서를 보장한다고 하지 않습니다.

## 득점 포인트

- Clock은 참조 비트를 보고 최근 사용한 후보에 두 번째 기회를 주는 근사 방식입니다. 정확한 접근 순서 목록이 아니므로 비트가 모두 켜진 스캔·특정 반복 패턴에서 LRU와 다른 선택을 할 수 있습니다.
- 근사가 정확히 같은 eviction 순서를 보장한다고 하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Clock은 참조 비트를 보고 최근 사용한 후보에 두 번째 기회를 주는 근사 방식입니다.

## 더 파고들 거리

- [기본 상황과 비교: 프로세스들이 페이지를 계속 밀어내고 다시 읽으며 느려집니다. 페이지 교체 정책과 작업 집합을 어떻게 보나요?](/tech-interview/questions/page-replacement-thrashing/)

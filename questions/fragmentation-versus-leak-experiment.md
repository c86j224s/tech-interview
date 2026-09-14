---
id: "fragmentation-versus-leak-experiment"
title: "장시간 할당 뒤 RSS가 높습니다. 살아 있는 객체 누수와 단편화를 어떤 대조 부하로 구분하나요?"
difficulty: "중하"
category: "운영체제"
tags: ["단편화","메모리 할당","가상 메모리","심화 질문"]
related: ["memory-fragmentation","memory-rss-vs-heap"]
promotedFrom: {"id":"memory-fragmentation","prompt":"장시간 할당 패턴에서 단편화와 실제 메모리 누수를 어떤 그래프로 분리할까요?"}
---

# 장시간 할당 뒤 RSS가 높습니다. 살아 있는 객체 누수와 단편화를 어떤 대조 부하로 구분하나요?

## 구두 답변

동일한 최종 생존 객체 수를 만들되 할당 크기·수명 순서를 다르게 한 부하를 비교하면 allocator 단편화·보관을 좁힐 수 있습니다. 실제 참조 누수는 불필요한 owner 경로로 확인합니다.

heap in-use·RSS·free 영역·arena·native를 나누고 부하 종료 후 재사용·반환을 봅니다. GC나 allocator trim으로 감소했다고 원인을 모두 해결한 것은 아닙니다. 장기 추세와 경계 입력을 함께 검증합니다.

## 득점 포인트

- 동일한 최종 생존 객체 수를 만들되 할당 크기·수명 순서를 다르게 한 부하를 비교하면 allocator 단편화·보관을 좁힐 수 있습니다. 실제 참조 누수는 불필요한 owner 경로로 확인합니다.
- 장기 추세와 경계 입력을 함께 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 동일한 최종 생존 객체 수를 만들되 할당 크기·수명 순서를 다르게 한 부하를 비교하면 allocator 단편화·보관을 좁힐 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 메모리 총 여유는 충분한데 큰 연속 영역 할당이 실패할 수 있나요?](/tech-interview/questions/memory-fragmentation/)

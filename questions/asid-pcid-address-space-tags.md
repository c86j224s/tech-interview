---
id: "asid-pcid-address-space-tags"
title: "ASID·PCID는 서로 다른 프로세스의 TLB 변환을 어떻게 구분하며 context switch 비용을 무엇까지 줄이나요?"
difficulty: "중하"
category: "운영체제"
tags: ["TLB","페이지 테이블","가상 메모리","심화 질문"]
related: ["tlb-page-table","virtual-memory-page-fault"]
promotedFrom: {"id":"tlb-page-table","prompt":"ASID·PCID가 주소 공간별 변환을 어떻게 구분하나요?"}
---

# ASID·PCID는 서로 다른 프로세스의 TLB 변환을 어떻게 구분하며 context switch 비용을 무엇까지 줄이나요?

## 구두 답변

ASID·PCID는 TLB entry를 주소 공간과 연결해 context switch 때 모든 변환을 무조건 비우는 비용을 줄일 수 있습니다. 서로 다른 프로세스의 같은 가상 주소를 구분하는 태그입니다.

태그 재사용·페이지 권한 변경에는 적절한 invalidation이 필요합니다. cache 데이터·스케줄링·NUMA 비용까지 제거하지 않습니다. CPU·OS 지원과 실제 switch·TLB 지표를 확인합니다.

## 득점 포인트

- ASID·PCID는 TLB entry를 주소 공간과 연결해 context switch 때 모든 변환을 무조건 비우는 비용을 줄일 수 있습니다. 서로 다른 프로세스의 같은 가상 주소를 구분하는 태그입니다.
- CPU·OS 지원과 실제 switch·TLB 지표를 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: ASID·PCID는 TLB entry를 주소 공간과 연결해 context switch 때 모든 변환을 무조건 비우는 비용을 줄일 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 큰 메모리 영역을 불규칙하게 읽는 프로그램에서 TLB miss가 늘었습니다. TLB는 주소 변환 비용을 어떻게 줄이며 miss와 페이지 폴트는 어떻게 다른가요?](/tech-interview/questions/tlb-page-table/)

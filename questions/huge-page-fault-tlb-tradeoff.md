---
id: "huge-page-fault-tlb-tradeoff"
title: "대형 페이지를 적용합니다. TLB miss 절감과 첫 fault·메모리 낭비·할당 비용은 어떻게 비교하나요?"
difficulty: "중하"
category: "운영체제"
tags: ["가상 메모리","페이지 폴트","메모리","심화 질문"]
related: ["virtual-memory-page-fault","process-vs-thread"]
promotedFrom: {"id":"virtual-memory-page-fault","prompt":"대형 페이지를 적용할 때 fault 단위와 TLB 비용을 어떻게 비교할까요?"}
---

# 대형 페이지를 적용합니다. TLB miss 절감과 첫 fault·메모리 낭비·할당 비용은 어떻게 비교하나요?

## 구두 답변

대형 페이지는 한 TLB entry가 더 많은 주소를 덮어 miss를 줄일 수 있지만 큰 fault·제로 초기화·내부 낭비·연속 물리 할당 부담이 생길 수 있습니다.

THP·명시 huge page·fallback·compaction 정책을 환경별 확인합니다. 순차·무작위·작은 working set·메모리 압력에서 TLB·fault·RSS·p99를 비교합니다. 모든 workload에서 무조건 켜는 최적화는 아닙니다.

## 득점 포인트

- 대형 페이지는 한 TLB entry가 더 많은 주소를 덮어 miss를 줄일 수 있지만 큰 fault·제로 초기화·내부 낭비·연속 물리 할당 부담이 생길 수 있습니다.
- 모든 workload에서 무조건 켜는 최적화는 아닙니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 대형 페이지는 한 TLB entry가 더 많은 주소를 덮어 miss를 줄일 수 있지만 큰 fault·제로 초기화·내부 낭비·연속 물리 할당 부담이 생길 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 호스트에 여유 메모리가 있는데도 프로세스의 페이지 폴트가 늘고 지연이 생깁니다. 어떤 종류의 폴트인지와 실제 디스크 접근이 있는지를 어떻게 확인하나요?](/tech-interview/questions/virtual-memory-page-fault/)

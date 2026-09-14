---
id: "go-pointer-density-gc-scan"
title: "같은 바이트 크기라도 포인터가 많은 객체와 바이트 배열의 GC 스캔 비용은 왜 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","GC","메모리 할당","지연","심화 질문"]
related: ["go-gc-latency-tradeoff","memory-rss-vs-heap","throughput-vs-latency"]
promotedFrom: {"id":"go-gc-latency-tradeoff","prompt":"포인터가 많은 객체와 바이트 배열의 GC 스캔 비용을 어떻게 비교할까요?"}
---

# 같은 바이트 크기라도 포인터가 많은 객체와 바이트 배열의 GC 스캔 비용은 왜 다른가요?

## 구두 답변

GC는 살아 있는 포인터를 따라 참조 그래프를 추적하므로 같은 바이트 수라도 포인터 배열과 비포인터 바이트 영역의 scan 비용이 다를 수 있습니다. 할당 크기와 그래프 밀도를 별도 변수로 봅니다.

포인터를 줄이려고 unsafe 정수 주소를 쓰면 수명·이동·GC 계약을 깨뜨릴 수 있습니다. 구조적 공유·인덱스 배열·객체 수 감소를 안전한 타입 안에서 검토합니다. alloc·inuse·scan·GC CPU·p99를 같은 부하에서 비교합니다.

## 득점 포인트

- GC는 살아 있는 포인터를 따라 참조 그래프를 추적하므로 같은 바이트 수라도 포인터 배열과 비포인터 바이트 영역의 scan 비용이 다를 수 있습니다. 할당 크기와 그래프 밀도를 별도 변수로 봅니다.
- alloc·inuse·scan·GC CPU·p99를 같은 부하에서 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: GC는 살아 있는 포인터를 따라 참조 그래프를 추적하므로 같은 바이트 수라도 포인터 배열과 비포인터 바이트 영역의 scan 비용이 다를 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Go 서버의 지연이 튀는 시점에 GC도 자주 실행됩니다. GC가 원인인지 확인하고 메모리와 지연을 어떻게 조정하나요?](/tech-interview/questions/go-gc-latency-tradeoff/)

---
id: "go-alloc-inuse-profile"
title: "Go heap profile의 alloc_space는 큰데 inuse_space는 작습니다. 임시 할당 비용과 생존 객체 보유를 어떻게 구분하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","GC","메모리 할당","지연","심화 질문"]
related: ["go-gc-latency-tradeoff","memory-rss-vs-heap","throughput-vs-latency"]
promotedFrom: {"id":"go-gc-latency-tradeoff","prompt":"`alloc_space`와 `inuse_space`가 각각 임시 할당과 생존 보유를 어떻게 드러낼까요?"}
---

# Go heap profile의 alloc_space는 큰데 inuse_space는 작습니다. 임시 할당 비용과 생존 객체 보유를 어떻게 구분하나요?

## 구두 답변

alloc_space는 누적 할당량을, inuse_space는 현재 살아 있는 표본 보유량을 보는 데 유용합니다. 임시 객체가 빨리 사라져도 높은 할당률은 GC와 CPU 비용을 만들 수 있습니다.

같은 부하·관찰 창에서 alloc_objects와 생존 참조 경로를 함께 봅니다. profile sampling과 GC 시점의 영향을 기록합니다. RSS에는 런타임·스택·native·allocator 여유도 있어 heap 숫자 하나로 전체 메모리 누수를 확정하지 않습니다.

## 득점 포인트

- alloc_space는 누적 할당량을, inuse_space는 현재 살아 있는 표본 보유량을 보는 데 유용합니다. 임시 객체가 빨리 사라져도 높은 할당률은 GC와 CPU 비용을 만들 수 있습니다.
- RSS에는 런타임·스택·native·allocator 여유도 있어 heap 숫자 하나로 전체 메모리 누수를 확정하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: alloc_space는 누적 할당량을, inuse_space는 현재 살아 있는 표본 보유량을 보는 데 유용합니다.

## 더 파고들 거리

- [기본 상황과 비교: Go 서버의 지연이 튀는 시점에 GC도 자주 실행됩니다. GC가 원인인지 확인하고 메모리와 지연을 어떻게 조정하나요?](/tech-interview/questions/go-gc-latency-tradeoff/)

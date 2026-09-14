---
id: "numa-cross-pool-object-transfer"
title: "NUMA 노드별 풀 사이에 객체를 넘깁니다. 할당·사용·반환 위치와 소유권 이동 비용을 어떻게 측정하나요?"
difficulty: "중하"
category: "운영체제"
tags: ["NUMA","메모리 지역성","CPU affinity","심화 질문"]
related: ["numa-memory-locality","cpu-cache-false-sharing"]
promotedFrom: {"id":"numa-memory-locality","prompt":"노드별 pool 사이에 객체를 넘길 때 소유권 이전 비용을 어떻게 측정할까요?"}
---

# NUMA 노드별 풀 사이에 객체를 넘깁니다. 할당·사용·반환 위치와 소유권 이동 비용을 어떻게 측정하나요?

## 구두 답변

할당한 노드와 가장 자주 읽고 쓰는 노드가 다르면 remote memory·coherence 비용이 생길 수 있습니다. 객체 전달 횟수·크기·수명·실제 page 배치를 추적합니다.

반환을 원래 풀에 보낼지 사용 노드로 옮길지 동기화·복사 비용을 비교합니다. 강제 affinity가 부하 불균형을 키울 수 있어 전체 throughput·p99를 봅니다. 가짜 공유와 페이지 원격 접근을 구분합니다.

## 득점 포인트

- 할당한 노드와 가장 자주 읽고 쓰는 노드가 다르면 remote memory·coherence 비용이 생길 수 있습니다. 객체 전달 횟수·크기·수명·실제 page 배치를 추적합니다.
- 가짜 공유와 페이지 원격 접근을 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 할당한 노드와 가장 자주 읽고 쓰는 노드가 다르면 remote memory·coherence 비용이 생길 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: NUMA 서버에서 작업 스레드를 늘렸는데 처리량이 떨어졌습니다. 메모리 배치와 CPU 이동이 원인인지 어떻게 확인하나요?](/tech-interview/questions/numa-memory-locality/)

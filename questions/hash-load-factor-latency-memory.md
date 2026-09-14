---
id: "hash-load-factor-latency-memory"
title: "해시 테이블의 부하율 상한을 낮춥니다. 충돌 감소와 메모리·재해시 비용은 어떻게 비교하나요?"
difficulty: "중하"
category: "자료구조"
tags: ["해시 테이블","재해시","부하율","심화 질문"]
related: ["hash-table-resize","hash-collision-resolution"]
promotedFrom: {"id":"hash-table-resize","prompt":"부하율 상한을 낮추면 충돌과 지연은 줄지만 메모리가 늘어나는 이유를 설명해 보세요."}
---

# 해시 테이블의 부하율 상한을 낮춥니다. 충돌 감소와 메모리·재해시 비용은 어떻게 비교하나요?

## 구두 답변

낮은 부하율은 빈 슬롯을 빨리 찾기 쉽고 충돌을 줄일 수 있지만 같은 원소 수에 더 큰 배열과 cache working set을 요구합니다. 너무 낮으면 메모리·재해시가 전체 성능을 나쁘게 할 수 있습니다.

tombstone·키 분포·값 크기·실패 검색 비율에 따라 비용을 봅니다. chaining과 open addressing의 부하율 의미도 구분합니다. 평균 lookup뿐 아니라 확장 시 p99·최대 탐사·메모리 피크를 같은 데이터로 측정합니다.

## 득점 포인트

- 낮은 부하율은 빈 슬롯을 빨리 찾기 쉽고 충돌을 줄일 수 있지만 같은 원소 수에 더 큰 배열과 cache working set을 요구합니다. 너무 낮으면 메모리·재해시가 전체 성능을 나쁘게 할 수 있습니다.
- 평균 lookup뿐 아니라 확장 시 p99·최대 탐사·메모리 피크를 같은 데이터로 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 낮은 부하율은 빈 슬롯을 빨리 찾기 쉽고 충돌을 줄일 수 있지만 같은 원소 수에 더 큰 배열과 cache working set을 요구합니다.

## 더 파고들 거리

- [기본 상황과 비교: 해시 테이블의 원소가 늘면 왜 재해시가 필요하며 요청 지연에 어떤 영향을 주나요?](/tech-interview/questions/hash-table-resize/)

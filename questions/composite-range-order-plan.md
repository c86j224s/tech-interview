---
id: "composite-range-order-plan"
title: "복합 인덱스에서 앞 컬럼은 범위 조건이고 뒤 컬럼은 정렬입니다. 정렬 생략이 가능한지 어떤 구간을 그려 보나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["인덱스","복합 인덱스","B-tree","실행 계획","카디널리티","심화 질문"]
related: ["composite-index-column-order","transaction-and-lost-update","throughput-vs-latency"]
promotedFrom: {"id":"composite-index-column-order","prompt":"복합 키의 범위 조건과 정렬 구간을 실행 계획으로 그려 보세요."}
---

# 복합 인덱스에서 앞 컬럼은 범위 조건이고 뒤 컬럼은 정렬입니다. 정렬 생략이 가능한지 어떤 구간을 그려 보나요?

## 구두 답변

인덱스 (a,b)는 a별로 b가 정렬된 것이지 여러 a 구간의 b가 전역 정렬된 것은 아닙니다. a가 동등 조건이면 뒤 b 정렬을 활용하기 쉽지만 a가 범위이면 여러 구간을 합치는 추가 정렬이 필요할 수 있습니다.

예를 들어 a=1의 b=100 뒤 a=2의 b=1이 나타나면 b 전역 오름차순이 아닙니다. 인덱스 방향·필터·LIMIT·covering과 엔진 계획을 확인합니다. scan·seek 이름보다 읽은 행 수와 sort·lookup 실제 비용을 비교합니다.

## 득점 포인트

- 인덱스 (a,b)는 a별로 b가 정렬된 것이지 여러 a 구간의 b가 전역 정렬된 것은 아닙니다. a가 동등 조건이면 뒤 b 정렬을 활용하기 쉽지만 a가 범위이면 여러 구간을 합치는 추가 정렬이 필요할 수 있습니다.
- scan·seek 이름보다 읽은 행 수와 sort·lookup 실제 비용을 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 인덱스 (a,b)는 a별로 b가 정렬된 것이지 여러 a 구간의 b가 전역 정렬된 것은 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 특정 고객의 최근 주문 20개를 조회하려 합니다. 고객 ID와 주문 시각의 복합 인덱스 순서를 어떻게 정하고, 선택한 순서가 쿼리에 맞는지 어떻게 확인하나요?](/tech-interview/questions/composite-index-column-order/)

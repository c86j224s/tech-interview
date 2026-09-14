---
id: "metric-exemplar-trace-selection"
title: "지연 메트릭에 exemplar로 trace를 연결합니다. 모든 요청을 넣지 않고 어떤 표본과 보존 범위를 선택하나요?"
difficulty: "중하"
category: "성능"
tags: ["메트릭","카디널리티","관측","심화 질문"]
related: ["metrics-cardinality","distributed-tracing-boundaries"]
promotedFrom: {"id":"metrics-cardinality","prompt":"exemplar를 모든 요청이 아니라 일부 요청에만 연결해야 하는 기준은 무엇인가요?"}
---

# 지연 메트릭에 exemplar로 trace를 연결합니다. 모든 요청을 넣지 않고 어떤 표본과 보존 범위를 선택하나요?

## 구두 답변

exemplar는 집계 메트릭에서 대표 요청의 trace를 찾아가는 연결이지 모든 요청의 로그 저장소가 아닙니다. 느린·실패·대표 정상 표본과 보존 기간·접근권한을 정합니다.

trace가 sampling돼 없을 수 있는 경로와 label cardinality를 확인합니다. 사용자 ID·원문을 무제한 메트릭에 넣지 않습니다. 전체 비율은 histogram·counter로, 개별 원인은 trace로 분석합니다.

## 득점 포인트

- exemplar는 집계 메트릭에서 대표 요청의 trace를 찾아가는 연결이지 모든 요청의 로그 저장소가 아닙니다. 느린·실패·대표 정상 표본과 보존 기간·접근권한을 정합니다.
- 전체 비율은 histogram·counter로, 개별 원인은 trace로 분석합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: exemplar는 집계 메트릭에서 대표 요청의 trace를 찾아가는 연결이지 모든 요청의 로그 저장소가 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 사용자별 지연을 보고 싶어 메트릭 라벨에 사용자 ID를 넣었습니다. 어떤 문제가 생기고 개별 요청은 어떻게 분석하나요?](/tech-interview/questions/metrics-cardinality/)

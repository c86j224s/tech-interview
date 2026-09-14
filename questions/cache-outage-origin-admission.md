---
id: "cache-outage-origin-admission"
title: "인기 키 하나의 만료와 캐시 전체 장애는 원본 DB 부하가 어떻게 다르며 우회 요청을 어떻게 제한하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["캐시","캐시 스탬피드","singleflight","심화 질문"]
related: ["cache-stampede-singleflight","cache-aside-consistency"]
promotedFrom: {"id":"cache-stampede-singleflight","prompt":"캐시 전체 장애와 단일 만료 판별"}
---

# 인기 키 하나의 만료와 캐시 전체 장애는 원본 DB 부하가 어떻게 다르며 우회 요청을 어떻게 제한하나요?

## 구두 답변

키 하나 만료는 그 키의 singleflight와 지터로 줄일 수 있지만 전체 cache 장애는 모든 키의 원본 조회를 폭증시킵니다. 키별 합치기 외에 원본 전체 동시성·큐·rate·우선순위를 제한해야 합니다.

필수 데이터와 선택 데이터를 나눠 일부 stale·기능 축소·빠른 거절을 사용합니다. cache 재시도까지 모든 요청이 동시에 수행하지 않도록 breaker와 복구 지터를 둡니다. 적중률이 아니라 DB 포화·사용자 실패·복구 후 warm-up 비용을 함께 평가합니다.

## 득점 포인트

- 키 하나 만료는 그 키의 singleflight와 지터로 줄일 수 있지만 전체 cache 장애는 모든 키의 원본 조회를 폭증시킵니다. 키별 합치기 외에 원본 전체 동시성·큐·rate·우선순위를 제한해야 합니다.
- 적중률이 아니라 DB 포화·사용자 실패·복구 후 warm-up 비용을 함께 평가합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 키 하나 만료는 그 키의 singleflight와 지터로 줄일 수 있지만 전체 cache 장애는 모든 키의 원본 조회를 폭증시킵니다.

## 더 파고들 거리

- [기본 상황과 비교: 인기 상품의 캐시가 만료되자 여러 서버가 동시에 같은 데이터를 DB에서 읽습니다. 중복 조회와 사용자 대기를 어떻게 줄이나요?](/tech-interview/questions/cache-stampede-singleflight/)

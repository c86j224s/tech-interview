---
id: "request-scoped-loader-cache"
title: "같은 요청에서 고객을 여러 번 읽습니다. 요청별 loader cache와 전역 cache를 어떻게 구분하고 측정하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["N+1","JOIN","배치 조회","심화 질문"]
related: ["db-n-plus-one","composite-index-column-order"]
promotedFrom: {"id":"db-n-plus-one","prompt":"콜드·웜 캐시에서 요청별 캐시의 효과를 분리해 보세요."}
---

# 같은 요청에서 고객을 여러 번 읽습니다. 요청별 loader cache와 전역 cache를 어떻게 구분하고 측정하나요?

## 구두 답변

요청별 loader cache는 같은 요청 안의 중복 ID 조회를 합치고 요청 종료 때 버립니다. 전역 cache는 여러 요청의 데이터를 재사용해 무효화·권한·최신성 문제가 추가됩니다.

고객 ID를 모아 한 번 조회한 뒤 원래 순서로 매핑하며 부재·오류를 구분합니다. 여러 테넌트의 같은 ID를 혼합하지 않습니다. cold·warm·중복 ID·일대다 결과에서 쿼리 수와 총 바이트·메모리를 비교합니다.

## 득점 포인트

- 요청별 loader cache는 같은 요청 안의 중복 ID 조회를 합치고 요청 종료 때 버립니다. 전역 cache는 여러 요청의 데이터를 재사용해 무효화·권한·최신성 문제가 추가됩니다.
- cold·warm·중복 ID·일대다 결과에서 쿼리 수와 총 바이트·메모리를 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 요청별 loader cache는 같은 요청 안의 중복 ID 조회를 합치고 요청 종료 때 버립니다.

## 더 파고들 거리

- [기본 상황과 비교: 주문 목록을 한 번 조회한 뒤 각 주문의 고객 정보를 따로 읽어 쿼리 수가 늘어납니다. N+1 조회를 어떻게 줄이고, JOIN으로 바꿀 때는 어떤 비용을 확인하나요?](/tech-interview/questions/db-n-plus-one/)

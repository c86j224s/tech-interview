---
id: cache-storage-ignoresearch-identity
title: Cache Storage match에서 ignoreSearch를 쓰면 어떤 데이터 혼합 위험이 생기나요?
difficulty: 중하
category: 웹
tags:
  - Cache Storage
  - HTTP cache
  - Service Worker
  - offline
related:
  - cache-negative-results
---
# Cache Storage match에서 ignoreSearch를 쓰면 어떤 데이터 혼합 위험이 생기나요?

## 구두 답변

ignoreSearch:true는 Request URL의 query string 전체를 매칭에서 제외합니다. `/items?category=book`을 저장한 뒤 `/items?category=game`을 조회해도 path가 같다는 이유로 책 목록이 반환될 수 있습니다. query가 사용자 ID, 커서, 언어, 필터, 기능 플래그라면 이는 hit율 개선이 아니라 서로 다른 자원을 같은 Response로 혼합하는 버그입니다. Cache API는 이 선택이 안전한지 서버의 의미를 확인해 주지 않습니다.

안전한 기본값은 false입니다. 추적용 `utm`만 query에 있고 공개 썸네일의 실제 식별자는 path라는 불변식을 문서화한 경우에는 URL을 명시적으로 정규화하거나 ignoreSearch를 제한적으로 사용할 수 있습니다. 반면 `/profile?id=1`을 `/profile?id=2`와 합치면 서버의 인증·최신성 로직에 도달하기 전에 잘못된 응답을 반환합니다. 테스트는 저장 key와 조회 key의 query를 바꾸고, 반환 body의 owner/category가 요청과 일치하는지 확인해야 합니다. HTTP cache fresh 여부는 이미 선택된 Cache Storage 항목의 의미를 되돌리지 않습니다.

반례를 테스트할 때는 응답 본문뿐 아니라 저장 요청의 순서도 고정해야 합니다. `/items?category=book`을 먼저 넣고 game을 조회한 결과가 book이면 혼합을 재현한 것이고, 반대 순서라면 Cache API가 어떤 항목을 먼저 찾는지까지 기록해야 합니다. 추적 query만 제거하는 정규화라면 허용 목록을 만들어 `id`, `cursor`, `lang` 같은 의미 있는 매개변수는 남겨야 합니다. 사용자별 응답을 public namespace에 저장하지 않는 정책이 ignoreSearch 실수의 피해 범위를 줄입니다.

## 득점 포인트

- query 전체를 무시한다는 사실과 id/category 반례를 함께 제시합니다.
- 기본 false와 공개 자산의 정규화 불변식을 선택 기준으로 둡니다.
- Cache Storage match와 HTTP freshness·인증을 분리합니다.

## 감점 포인트

- 검색어만 무시하고 다른 query는 비교한다고 설명합니다.
- 같은 path의 모든 API 응답이 동일하다고 가정합니다.
- HTTP의 private 지시자가 이미 저장된 Cache Storage 사본을 자동 삭제한다고 말합니다.

## 더 파고들 거리

- 추적 query만 제거할 URL 정규화 함수의 테스트 불변식은 무엇인가요?
- 사용자 namespace와 query key 방식의 로그아웃·저장공간 비용을 비교해 보세요.

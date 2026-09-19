---
id: cache-storage-http-freshness
title: HTTP 응답은 fresh한데 Service Worker Cache Storage가 오래된 응답을 갖고 있으면 어느 값이 보일 수 있나요?
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
# HTTP 응답은 fresh한데 Service Worker Cache Storage가 오래된 응답을 갖고 있으면 어느 값이 보일 수 있나요?

## 구두 답변

Service Worker fetch handler가 Cache Storage를 먼저 조회하면 HTTP 응답이 fresh인지와 관계없이 저장된 오래된 Response가 보일 수 있습니다. `cache.match(/api/items)`는 Cache-Control의 max-age를 읽어 자동으로 miss로 만드는 HTTP cache가 아니라, 저장된 Request/Response를 선택하는 API입니다. runtime에 v1이 있고 HTTP cache와 origin에는 v2가 있어도 handler가 v1을 먼저 반환할 수 있습니다.

반대로 Cache Storage miss 뒤 `fetch()`를 호출하면 이번에는 HTTP cache의 fresh hit, 조건부 요청과 304, 또는 origin 응답이 관여합니다. 그러므로 runtime cache를 지웠다고 원본 최신값을 얻었다고 단정하지 않습니다. 공개 콘텐츠는 저장 시각과 TTL을 별도로 두고 stale-while-revalidate를 선택할 수 있지만, 재고·권한 응답은 network-first나 저장 금지에 가깝게 설계합니다. 진단 trace에는 storage hit/miss와 HTTP hit/304/origin, Age·ETag를 따로 기록해야 두 계층을 혼동하지 않습니다.

예를 들어 t0에 Cache Storage v1을 저장하고 t+3600초에 서버 v2가 배포됐더라도, handler가 storage hit를 먼저 반환하면 화면에는 v1이 보입니다. 이때 HTTP 응답이 fresh하다는 사실은 아직 fetch가 실행되지 않았으므로 관찰되지 않은 상태입니다. network-first로 바꾸면 이번에는 HTTP cache가 fresh v2를 주는지, validator가 304를 만드는지까지 별도 확인해야 합니다. 권한·재고처럼 stale을 허용할 수 없는 응답은 stale fallback을 성공으로 표시하지 말고 네트워크 실패를 명시하는 편이 안전합니다.

## 득점 포인트

- Cache.match가 HTTP freshness를 자동 평가하지 않는다고 직접 답합니다.
- storage hit와 miss 뒤 HTTP fetch의 두 경로를 수치·상태로 분리합니다.
- 콘텐츠 민감도에 따라 TTL·network-first를 선택합니다.

## 감점 포인트

- max-age가 지나면 Cache Storage 항목이 자동 miss라고 합니다.
- Cache Storage 삭제가 브라우저·CDN HTTP cache 삭제까지 의미한다고 말합니다.
- hit 종류를 하나의 cache hit 로그로 합칩니다.

## 더 파고들 거리

- 공개 피드와 재고 API의 허용된 stale 시간을 어떻게 다르게 테스트하겠습니까?
- Age·ETag·304와 Cache API 결과를 한 요청 trace에 어떤 필드로 남기겠습니까?

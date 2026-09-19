---
id: web-cache-storage-http-cache-boundary
title: Cache Storage와 HTTP 캐시의 경계
topic: 웹·클라이언트
summary: 스크립트 관리 Cache Storage와 HTTP 캐시의 freshness·validation 경로를 분리합니다.
questionIds: []
prerequisites:
  - http-cache
  - browser-navigation
related:
  - cache-freshness
  - cache-refill
  - web-service-worker-lifecycle-deployment
reviewedAt: '2026-09-19'
---
# Cache Storage와 HTTP 캐시의 경계

Cache Storage와 HTTP cache는 모두 응답을 보관하지만 소유자와 판단 시점이 다릅니다. HTTP cache는 서버의 `Cache-Control`, validator, `Vary`를 고려해 fetch 경로에서 fresh 재사용이나 재검증을 판단합니다. Cache API는 스크립트가 이름 있는 `Cache`에 Request/Response 쌍을 저장하고 `match()`로 직접 선택하는 저장소입니다. Service Worker가 먼저 Cache Storage를 반환하면 HTTP freshness를 평가할 기회 자체가 생략될 수 있습니다.

## 저장소·소유권

`caches.open('static-v4')`는 이름을 기준으로 Cache를 얻고, `cache.delete(request)`는 한 항목을, `caches.delete(name)`은 namespace 전체를 지웁니다. 이 작업은 브라우저 HTTP cache나 CDN entry를 지우지 않습니다. 반대로 `fetch()`를 호출해도 원 서버에서 반드시 새 본문을 받는 것은 아니며, HTTP cache의 fresh hit 또는 validator 기반 304 조합이 남을 수 있습니다.

## 요청 매칭·query identity

`cache.match(request)`는 URL, method, 검색어, `Vary` 등을 옵션에 따라 비교합니다. `ignoreSearch:true`는 query string 전체를 무시합니다. `/profile?id=1`을 저장한 뒤 `/profile?id=2`를 조회하면 같은 path의 첫 응답이 선택될 수 있습니다. query가 사용자 ID·커서·언어·기능 플래그라면 이는 단순 최적화가 아니라 다른 데이터 혼합입니다. 기본값 false를 유지하고, 공개 썸네일처럼 query가 추적용일 때만 정규화 불변식을 테스트합니다.

## Vary·ignoreVary 계약

저장 응답의 `Vary: Accept-Language`는 저장 당시 Request와 현재 조회 Request의 해당 헤더를 비교해 표현을 구분합니다. ko로 저장한 `/welcome`을 en 요청에 그대로 주면 안 됩니다. `ignoreVary:true`는 이 비교만 생략하므로 en 요청에 ko 표현을 반환할 수 있습니다. 이는 freshness나 인증 검사를 끄는 옵션이 아닙니다. 개인 응답의 권한 경계는 URL·namespace·로그아웃 삭제로 별도 보호해야 합니다.

```diagram
{"title":"두 캐시 계층의 선택 순서","caption":"Cache Storage hit와 fetch 이후 HTTP cache hit는 서로 다른 사건으로 로그에 남겨야 합니다.","rows":[[{"id":"request","label":"요청","detail":["URL · query · headers"]}],[{"id":"storage","label":"Cache Storage match"},{"id":"fetch","label":"HTTP fetch"}],[{"id":"stored","label":"저장 응답 반환"},{"id":"http","label":"HTTP cache/origin"}],[{"id":"put","label":"runtime put","detail":["정책에 따라"]}]],"edges":[{"from":"request","to":"storage","label":"worker 선조회"},{"from":"storage","to":"stored","label":"match hit"},{"from":"storage","to":"fetch","label":"miss 뒤 fetch"},{"from":"fetch","to":"http","label":"fresh·304·origin"},{"from":"http","to":"put","label":"응답 저장 정책"}]}
```

## Cache Storage·HTTP freshness

Cache Storage 항목에 `Cache-Control: max-age=60`이 붙어 있어도 한 시간이 지난 `cache.match()`가 자동 miss로 바뀌지는 않습니다. 앱이 저장 시각을 별도로 기록하고 TTL을 적용하거나, stale-while-revalidate를 구현해야 합니다. 반대로 runtime miss 뒤 `fetch('/api/items')`를 부르면 HTTP cache가 fresh v2를 줄 수도 있고, stale validator가 304로 v2를 확인할 수도 있습니다. `caches.delete()`와 브라우저 HTTP cache 삭제는 서로 다른 운영 작업입니다.

따라서 trace에는 `storage=hit/miss`, `cacheName`, `ignoreSearch`, `ignoreVary`, `http=HIT/304/origin`, `Age`, `ETag`, controller를 분리합니다. 이 필드가 없으면 “캐시가 최신 응답을 줬다”는 말을 검증할 수 없습니다.

## opaque 응답·검증 한계

`no-cors` 교차 출처 응답은 `type:'opaque'`, `status:0`, 읽을 수 없는 body와 제한된 헤더로 노출됩니다. 실제 원격 200인지 404 HTML인지 JavaScript가 판별할 수 없습니다. `cache.put()`이 성공해도 콘텐츠가 기대한 자산이라는 증거가 아니며, `add()`·`addAll()`의 성공 응답 요구와도 구분합니다. 검증이 필요하면 CORS를 허용해 읽을 수 있게 하거나 신뢰 가능한 프록시·서명·대체 자산을 사용합니다.

## 구현·격리·실패 복구

공개 자산과 사용자별 API 응답을 같은 namespace에 두지 않습니다. A의 `/orders`를 저장한 뒤 로그아웃하고 B가 같은 URL을 요청하면 worker가 서버 인가 전에 A의 응답을 반환할 수 있습니다. HTTP 응답에 `private`가 붙었다고 Cache Storage 사본이 자동 삭제되지 않습니다. 사용자 세대가 포함된 key, 로그아웃 시 명시적 delete, 또는 저장 금지 중에서 데이터 민감도에 맞는 선택을 합니다.

```js
async function readPublicAsset(request) {
  const cache = await caches.open('public-v4');
  const hit = await cache.match(request, {ignoreSearch: false, ignoreVary: false});
  if (hit) return hit;
  const response = await fetch(request);
  if (response.type !== 'opaque' && response.ok) await cache.put(request, response.clone());
  return response;
}
```

이 코드는 실행 측정이 아니라 판단 순서를 보이는 설명용 예시입니다. 동시 miss, TTL, abort, Vary, 용량 초과, 네트워크 오류는 별도 정책입니다.

## 비용·진단·참고자료

Cache Storage는 오프라인 hit와 세대별 rollback을 주지만 최신성·삭제·계정 격리를 앱이 부담합니다. HTTP cache는 서버 지시자와 validator를 활용하지만 explicit namespace와 offline fallback을 제공하지 않습니다. 두 계층을 조합할수록 로그와 테스트 비용이 증가합니다.

참고자료: [Service Workers 명세 Cache API 절](https://w3c.github.io/ServiceWorker/) (match/put 및 request matching), [MDN CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage), [MDN Cache.match](https://developer.mozilla.org/en-US/docs/Web/API/Cache/match), [MDN Cache.put](https://developer.mozilla.org/en-US/docs/Web/API/Cache/put) (2026-09-19 확인). MDN의 호환성 표는 대상 브라우저의 최신 지원을 자동 보증하지 않습니다.

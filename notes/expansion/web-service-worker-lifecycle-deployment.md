---
id: web-service-worker-lifecycle-deployment
title: Service Worker 수명과 캐시 버전 배포
topic: 웹·클라이언트
summary: >-
  installing·waiting·activating 수명과 캐시 버전 전환, skipWaiting·clients.claim의 적용 범위를
  설명합니다.
questionIds: []
prerequisites:
  - browser-navigation
  - http-cache
related:
  - flag-migration
  - object-publication
  - rollout-capacity
reviewedAt: '2026-09-19'
---
# Service Worker 수명과 캐시 버전 배포

Service Worker 배포는 파일 교체가 아니라 등록이 새 worker를 발견하고, 설치하고, 기존 client와의 경계를 정한 뒤 활성화하는 상태 전환입니다. `installing`, `waiting`, `activating`, `activated`와 페이지의 `controller`를 같은 “현재 버전” 값으로 합치면 precache 실패와 즉시 전환의 부작용을 놓칩니다. 배포는 worker 코드, 캐시 namespace, 페이지-API 계약을 함께 버전화해야 합니다.

## 등록·상태·controller

등록에는 installing·waiting·active worker 슬롯이 있을 수 있습니다. 새 스크립트가 발견되면 installing에서 시작하고, install 약속이 성공해도 기존 active worker가 제어하는 client가 남아 있으면 waiting에 머뭅니다. active가 바뀌었다는 사실은 이미 열린 문서의 모든 실행 맥락이 새 코드가 됐다는 뜻이 아닙니다. `navigator.serviceWorker.controller`는 특정 문서의 현재 제어자이므로 registration의 active 슬롯과 별도로 관찰합니다.

## install·precache 원자성

필수 자산은 `event.waitUntil(cache.addAll(...))`에 연결합니다. `/app.js`는 저장됐지만 `/style.css`가 reject되면 install promise 전체가 실패하고 새 worker는 active로 승격되지 않습니다. **기존 active worker가 있었다면** 그 worker와 기존 namespace가 계속 기준 경로로 남습니다. 그러나 최초 설치라면 이전 active worker나 controller가 존재하지 않으므로, 실패 뒤에는 새 worker가 제공하는 fallback이 생기지 않고 문서는 uncontrolled 상태로 네트워크를 사용할 수 있습니다. 이 구분이 “항상 이전 버전이 서비스한다”는 과장을 막습니다.

부분적으로 `app-v4`에 파일이 남았더라도 v4를 준비 완료로 표시하지 않습니다. install 실패를 기록하고 다음 update check에서 다시 설치하며, activate가 v3를 지우기 전에 v4 전체 조건을 검증합니다.

```diagram
{"title":"install 성공과 이전 worker 보존","caption":"기존 active가 있는 업데이트와 최초 설치 실패는 서로 다른 fallback을 가집니다.","rows":[[{"id":"install","label":"새 worker install","detail":["waitUntil precache"]}],[{"id":"ok","label":"모든 자산 성공"},{"id":"fail","label":"필수 자산 실패"}],[{"id":"waiting","label":"waiting worker"},{"id":"old","label":"기존 active 유지"}],[{"id":"first","label":"최초 설치 실패","detail":["uncontrolled 가능"]}],[{"id":"activate","label":"activate·controller 전환"}]],"edges":[{"from":"install","to":"ok","label":"promise fulfill"},{"from":"install","to":"fail","label":"promise reject"},{"from":"ok","to":"waiting","label":"설치 완료"},{"from":"fail","to":"old","label":"업데이트면 유지"},{"from":"fail","to":"first","label":"기존 active 없음"},{"from":"waiting","to":"activate","label":"활성화 조건"}]}
```

## waiting·skipWaiting

`skipWaiting()`은 waiting worker가 일반적으로 기다리는 단계를 건너뛰어 activation을 시도하게 합니다. 실행 중인 페이지 JavaScript를 중간에 교체하거나 이미 시작된 fetch 이벤트의 worker를 소급 변경하지는 않습니다. `clients.claim()`도 활성 worker가 자신의 scope 안에서 uncontrolled client를 제어하도록 요청하는 수단이지, 다른 출처의 탭이나 페이지의 데이터 계약을 자동으로 맞추는 기능이 아닙니다.

v3 페이지가 `{enabled:true}`를 기대하는데 v4 worker가 `{flags:{enabled:true}}`를 반환하면 즉시 activation은 코드-응답 불일치를 만들 수 있습니다. 자산 해시, 하위 호환 응답, 업데이트 알림 후 reload, controllerchange 후 재초기화 중 하나를 선택하고 중복 초기화를 막는 세대 토큰을 둡니다.

## activate·namespace 정리

install은 `app-static-v4`, `app-runtime-v4`를 채우고 activate는 v4가 아닌 **자신의 등록 소유** 캐시만 지웁니다. `caches.keys()`를 모두 삭제하면 다른 기능 또는 다른 등록의 데이터까지 훼손할 수 있습니다. 삭제 Promise는 `event.waitUntil()`에 연결해 activate 완료 기준과 일치시킵니다. fetch handler는 같은 `CACHE_VERSION` 상수로 v4를 읽어야 하며, 정리 규칙과 읽기 규칙이 다르면 activation 직후 miss가 발생합니다.

정적 precache와 runtime 응답은 수명이 다르므로 namespace를 분리합니다. rollback을 위해 v3를 잠시 보존할지, 저장공간을 줄이기 위해 즉시 삭제할지는 오류율·디스크 비용으로 결정합니다. `clients.claim()`은 이 삭제나 데이터 최신화를 기다려 주지 않습니다.

## updateViaCache 적용 규칙

등록 옵션 `updateViaCache`는 runtime `Cache Storage`가 아니라 worker script 업데이트 검사에서 HTTP cache를 어떻게 고려할지 정합니다. `imports`에서는 top-level worker script 검사에 HTTP cache를 우회하고, `importScripts()`로 불러온 imported script에는 HTTP cache를 허용합니다. `all`은 top-level과 imported script 모두 HTTP cache를 고려하고, `none`은 둘 다 우회합니다. 기본값은 `imports`입니다. 이 설정을 바꿔도 `caches.open('runtime-v4').match()`가 가진 JSON은 만료·삭제되지 않습니다.

작은 trace로는 `sw.js=v4`, `helper.js=v3`, `/api/items=runtime-v3`를 둡니다. imports라면 sw.js는 최신 검사 경로를 타지만 helper.js는 HTTP cache에서 v3가 나올 수 있고, runtime-v3는 별도 match 결과입니다. all이면 두 script 모두 HTTP cache 정책을 거치고, none이면 둘 다 우회합니다. 실제 검사 시점과 브라우저별 재검증은 대상 매트릭스에서 확인할 별도 항목입니다.

## 배포·실패 복구

새 asset을 해시 URL과 새 namespace에 먼저 게시하고 install 성공을 readiness로 둡니다. waiting을 알린 뒤 호환성이 확인될 때만 skipWaiting을 사용합니다. activate에서 삭제 실패를 성공으로 기록하지 말고 다음 fetch의 network fallback, controller, cache hit/miss를 함께 남깁니다. 최초 설치 실패는 uncontrolled 네트워크 경로를, 업데이트 실패는 기존 active 경로를 예상값으로 기록합니다.

## 비용·검증·참고자료

waiting 정책은 안정성을 높이는 대신 구버전 호환 기간과 저장공간을 요구합니다. 즉시 전환은 배포 지연을 줄이지만 페이지와 worker의 계약 테스트가 필수입니다. Service Workers 명세의 registration/updateViaCache/skipWaiting/claim과 install·activate 절을 읽어 정리했으며, 일부 브라우저의 업데이트 주기나 캐시 재검증 시점은 이 문서에서 확정하지 않습니다.

참고자료: [Service Workers Editor’s Draft](https://w3c.github.io/ServiceWorker/) (registration update via cache mode, lifecycle/control algorithms; 2026-09-19 확인), [MDN ServiceWorkerRegistration.updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache).

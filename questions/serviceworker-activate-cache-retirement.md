---
id: serviceworker-activate-cache-retirement
title: activate에서 이전 캐시를 지울 때 새 fetch와 namespace를 어떻게 일관되게 연결하나요?
difficulty: 중하
category: 웹
tags:
  - Service Worker
  - install
  - activate
  - cache version
related:
  - feature-flag-rollout
---
# activate에서 이전 캐시를 지울 때 새 fetch와 namespace를 어떻게 일관되게 연결하나요?

## 구두 답변

install·activate·fetch가 같은 버전 상수와 소유권 규칙을 사용해야 합니다. v4 install은 `app-static-v4`와 `app-runtime-v4`를 채우고, activate는 자신의 등록이 소유한 `app-` namespace 중 v4가 아닌 것만 삭제합니다. fetch도 동일한 `CACHE_VERSION`으로 v4를 읽어야 합니다. activate에서 모든 `caches.keys()`를 삭제하거나 fetch는 v3를 읽게 두면 활성화 직후 miss와 다른 기능 데이터 삭제가 함께 발생합니다.

삭제 Promise는 `event.waitUntil()`에 연결해 삭제가 끝나기 전 activate가 성공한 것처럼 보이지 않게 합니다. 정적 파일과 runtime 데이터의 수명이 다르므로 namespace를 분리하면 rollback 때 v3 runtime을 잠시 보존할 수 있습니다. `clients.claim()`은 문서 제어권을 바꾸는 기능이지 캐시 삭제 완료나 runtime 최신화를 기다려 주는 기능이 아닙니다. 따라서 trace에는 `active=v4`, `read=app-runtime-v4`, `deleted=[app-static-v3]`, `deleteError`, `fetchMiss`를 남기고, miss면 네트워크 fallback을 명시합니다.

삭제 범위는 이름의 접두사만으로 충분하지 않을 수 있습니다. 같은 origin의 다른 등록이 `app-` 이름을 사용한다면 registration 소유권을 구분하는 접두사나 manifest가 필요합니다. 또한 activate에서 삭제를 기다리는 동안 fetch가 발생할 수 있으므로, 새 worker는 v4 miss를 네트워크로 채울 수 있어야 하고 삭제 실패를 다음 활성화의 재시도 대상으로 남겨야 합니다. rollback 지표가 나쁘면 v3 namespace를 즉시 삭제하지 않는 선택이 저장공간보다 중요한 경우가 있습니다.

## 득점 포인트

- install·activate·fetch가 공유하는 상수와 namespace 소유권을 제시합니다.
- 정적·runtime 캐시의 수명과 rollback 비용을 구분합니다.
- waitUntil, 삭제 실패, fetch miss를 독립 관찰값으로 둡니다.

## 감점 포인트

- 모든 CacheStorage 항목을 activate에서 지웁니다.
- clients.claim을 캐시 정리 완료 신호로 해석합니다.
- fetch가 읽는 세대와 삭제하는 세대를 다른 규칙으로 계산합니다.

## 더 파고들 거리

- rollback을 위해 이전 namespace를 언제까지 보존할지 어떤 오류율로 결정하겠습니까?
- activate 직후 miss가 나면 네트워크·fallback 순서를 어떻게 설계하겠습니까?

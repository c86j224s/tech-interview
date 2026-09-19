---
id: serviceworker-install-precache-failure
title: install 중 precache 하나가 실패하면 활성 worker는 어떤 버전을 계속 제공해야 하나요?
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
# install 중 precache 하나가 실패하면 활성 worker는 어떤 버전을 계속 제공해야 하나요?

## 구두 답변

필수 precache를 `event.waitUntil()`에 연결하고 하나라도 reject되면 새 worker를 active로 승격시키지 않는 것이 기본 계약입니다. 업데이트 상황에서 v3 active와 `app-v3`가 이미 있다면 v4의 일부 파일만 저장됐어도 v3 worker와 namespace가 기준 응답을 계속 제공합니다. 그렇지만 최초 설치에는 이전 active worker나 controller가 없으므로 “항상 이전 버전이 제공된다”고 말할 수 없습니다. 그 경우 새 worker는 활성화되지 않고, 문서는 uncontrolled 상태에서 네트워크 경로를 사용할 수 있습니다.

예를 들어 `/app.js`는 성공했지만 `/style.css`가 실패했다면 v4를 부분 자산으로 노출하지 않습니다. 실패 원인과 남은 v4 항목을 기록하고 다음 update check에서 다시 설치합니다. activate에서 v3를 삭제하는 작업은 v4가 실제로 설치·활성화된 뒤에만 수행해야 합니다. 최초 설치와 업데이트를 로그의 `hadPreviousActive`로 분리하면 복구 기대값도 달라집니다. 이 답변의 상태 trace는 설명용이며 브라우저 런타임 실행 결과를 가장하지 않습니다.

업데이트와 최초 등록의 차이는 controller 관찰에서도 드러납니다. 업데이트 실패라면 기존 페이지의 `navigator.serviceWorker.controller`가 v3를 계속 가리킬 수 있지만, 최초 설치 실패 문서는 controller가 null일 수 있습니다. 따라서 “네트워크로 보인다”는 결과도 기존 worker의 network fallback인지 uncontrolled navigation인지 로그로 나눠야 합니다. precache는 필수 자산만 묶고 선택 자산은 런타임 fallback으로 분리하면 한 이미지 오류 때문에 전체 worker를 폐기하는 비용을 조절할 수 있습니다.

## 득점 포인트

- waitUntil의 reject와 installing worker가 active가 되지 않는 경계를 설명합니다.
- 이전 active가 있는 업데이트와 최초 설치 실패의 fallback을 구분합니다.
- 부분 v4와 activate 정리 시점을 분리합니다.

## 감점 포인트

- 모든 install 실패가 자동으로 이전 worker 응답을 보장한다고 단정합니다.
- 파일 하나의 저장 성공을 전체 설치 성공으로 해석합니다.
- 실패한 v4가 남아도 v3 캐시를 즉시 삭제합니다.

## 더 파고들 거리

- 최초 설치 실패에서 uncontrolled 네트워크와 사용자 메시지를 어떻게 다르게 처리하겠습니까?
- 불안정한 네트워크에서 부분 cache 항목을 다음 install에서 식별하는 방법은 무엇인가요?

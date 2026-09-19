---
id: serviceworker-updateviacache-scripts
title: updateViaCache는 worker script의 업데이트 검사와 runtime Cache Storage를 어떻게 다르게 다루나요?
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
# updateViaCache는 worker script의 업데이트 검사와 runtime Cache Storage를 어떻게 다르게 다루나요?

## 구두 답변

updateViaCache는 등록된 worker script의 업데이트 검사에서 HTTP cache를 사용할지 정하는 등록 설정이고, runtime Cache Storage의 응답 선택과는 별개입니다. 세 값의 차이는 명확합니다. `imports`는 top-level worker script는 HTTP cache를 우회하지만 imported script에는 HTTP cache를 허용합니다. `all`은 top-level과 imported script 모두 HTTP cache를 고려하고, `none`은 둘 다 우회합니다. 기본값은 imports입니다.

예를 들어 `sw.js=v4`, `helper.js=v3`, runtime cache의 `/api/items=v1`을 두면 imports에서는 sw.js의 검사는 새 바이트를 확인하는 경로가 되고 helper.js는 HTTP cache 정책 영향을 받을 수 있습니다. runtime-v1은 그 어느 값에서도 자동으로 만료되지 않습니다. worker가 새로 설치돼도 fetch handler가 `runtime-v1`을 먼저 match하면 오래된 API가 반환됩니다. 그래서 로그를 script update check, install/activate, runtime match, HTTP Age·ETag·304로 분리합니다. 명세의 값과 알고리즘을 기준으로 설명했지만 실제 업데이트 검사 시점과 브라우저별 재검증은 대상 매트릭스에서 확인해야 합니다.

여기서 “우회”는 runtime fetch가 네트워크로만 간다는 뜻이 아니라 업데이트 알고리즘이 HTTP cache를 고려하는 방식의 차이입니다. `importScripts('/helper.js')`로 의존하는 파일은 imports 모드에서 top-level과 다른 경로를 가지므로, helper 변경을 배포했는데 sw.js 바이트만 확인한 상황을 별도로 테스트해야 합니다. 반면 `/api/items`는 worker가 실행된 뒤 Cache API로 조회하는 데이터이므로 세 enum의 직접 대상이 아닙니다. script 응답의 버전과 runtime 응답의 세대를 같은 로그 필드에 섞지 않는 것이 핵심입니다.

## 득점 포인트

- imports·all·none의 top-level/imported script 차이를 구체적으로 답합니다.
- updateViaCache와 runtime Cache Storage를 서로 다른 상태·저장소로 나눕니다.
- script와 API 응답의 trace 필드를 분리합니다.

## 감점 포인트

- updateViaCache가 runtime JSON의 max-age나 Cache Storage 항목을 지운다고 합니다.
- worker script가 새로 내려오면 모든 열린 페이지 데이터도 최신이라고 봅니다.
- enum 이름만 말하고 top-level/import 차이를 생략합니다.

## 더 파고들 거리

- import script가 오래된 HTTP cache에서 읽히는 조건을 대상 브라우저에서 어떤 테스트로 고정하겠습니까?
- worker 버전과 runtime API 버전을 함께 롤아웃할 호환 계약은 무엇인가요?

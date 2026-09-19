---
id: serviceworker-skipwaiting-control
title: waiting worker에 skipWaiting을 호출해도 열린 탭의 모든 요청이 즉시 새 worker로 바뀌지 않는 이유는 무엇인가요?
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
# waiting worker에 skipWaiting을 호출해도 열린 탭의 모든 요청이 즉시 새 worker로 바뀌지 않는 이유는 무엇인가요?

## 구두 답변

skipWaiting()은 waiting worker가 기존 client가 사라지기를 기다리는 단계를 건너뛰고 activation을 시도하게 하는 요청이지, 열린 문서의 JavaScript 실행 맥락을 원자적으로 교체하는 명령이 아닙니다. 이미 실행 중인 이벤트는 시작된 worker에서 진행하고, 문서의 `controller`도 별도 상태로 관찰해야 합니다. clients.claim()을 함께 호출해도 scope 안 uncontrolled client를 새 active worker가 제어하도록 할 뿐, 페이지가 기대하는 응답 형식이나 이미 실행 중인 코드를 검증해 주지는 않습니다.

v3 페이지가 `/api/config`의 `{enabled:true}`를 기대하는데 v4 worker가 `{flags:{enabled:true}}`를 반환한다고 하겠습니다. v4를 즉시 활성화하면 새 요청은 v4, 기존 코드는 v3 계약이라 런타임 오류가 생길 수 있습니다. 해결은 해시 자산과 하위 호환 응답을 유지하거나, 업데이트 알림 뒤 새로고침하게 하거나, controllerchange에서 한 번만 재초기화하는 정책입니다. 즉시 보안 수정이면 구버전 페이지가 잠시 사용할 URL·메시지·응답을 새 worker가 지원할 기간을 정합니다.

controllerchange 이벤트가 발생해도 현재 DOM과 메모리 상태를 무조건 초기화하면 사용자가 작성 중인 입력을 잃습니다. 페이지는 worker 세대와 페이지 번들을 함께 기록하고, 새 controller가 호환 세대인지 확인한 뒤 읽기 전용 재검증이나 전체 reload를 선택해야 합니다. 반대로 보안 패치처럼 즉시 전환이 필수라면 오래된 페이지가 호출하는 endpoint를 일정 기간 유지하고, 그 기간이 끝난 뒤에만 구버전 worker와 API를 제거합니다. skipWaiting은 이 정책을 대신 결정하지 않습니다.

## 득점 포인트

- skipWaiting의 범위를 waiting 생략·activation 진행으로 한정합니다.
- controller, 실행 중 이벤트, API 응답 계약을 따로 추적합니다.
- 즉시 전환의 호환성 비용과 clients.claim의 범위를 함께 말합니다.

## 감점 포인트

- skipWaiting이 모든 탭의 JS를 원자적으로 교체한다고 합니다.
- clients.claim이 캐시와 데이터 계약을 자동 정렬한다고 봅니다.
- controller 변경을 확인하지 않고 새 기능을 노출합니다.

## 더 파고들 거리

- 보안 수정으로 즉시 적용할 때 구버전 페이지 호환 기간을 어떤 지표로 정하겠습니까?
- controllerchange 뒤 중복 초기화를 막는 세대 토큰은 어디에 두겠습니까?

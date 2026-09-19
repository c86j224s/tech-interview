---
id: bfcache-beforeunload-eligibility
title: beforeunload를 상시 등록한 페이지가 bfcache에 불리할 수 있는 이유와 대안은 무엇인가요?
difficulty: 중하
category: 웹
tags:
  - bfcache
  - pageshow
  - pagehide
  - history
related:
  - ios-view-lifecycle
---
# beforeunload를 상시 등록한 페이지가 bfcache에 불리할 수 있는 이유와 대안은 무엇인가요?

## 구두 답변

`beforeunload`는 모든 종료 처리를 맡기는 훅이 아니라, 저장하지 않은 변경을 잃을 때 이탈 확인을 요청하는 장치입니다. 일부 브라우저에서는 상시 `beforeunload` 리스너가 bfcache 적격성에 불리하게 작용할 수 있어 뒤로 가기가 문서 복원이 아닌 재탐색이 되고, 입력·스크롤 보존과 복원 성능이 달라질 수 있습니다. 따라서 편집 내용이 처음 변경돼 dirty가 된 순간 등록하고, 서버 저장이나 사용자가 취소해 dirty가 해소되면 제거하는 방식이 기본 대안입니다.

예를 들어 문서 세대 5가 clean이면 리스너가 없습니다. 사용자가 제목을 한 글자 바꾸면 dirty=true와 함께 리스너를 붙이고 draft 저장을 시작합니다. 저장 성공으로 dirty=false가 되면 즉시 제거합니다. 이탈 직전에만 등록하는 것은 bfcache 가능성을 넓히지만 저장 자체를 보장하지는 않습니다. 대화상자에서 “떠나기”를 눌러도 진행 중인 fetch가 끝났다는 뜻이 아니며, 서버가 draft를 받았다는 확인과 별도입니다.

그래서 입력 이벤트마다 로컬 임시 저장이나 서버 draft로 내구성을 먼저 확보하고, `visibilitychange`·`pagehide`를 보조 신호로 target 브라우저에서 시험합니다. 모바일 프로세스 종료에서는 beforeunload가 오지 않을 수 있으므로 이벤트 한 번에 중요한 데이터를 맡기지 않습니다. pagehide listener 자체를 bfcache 배제 조건으로 일반화하지 말고, 실제 history 이동에서 persisted와 DevTools 원인을 확인합니다. 예를 들어 dirty 세대 6의 저장 응답이 늦게 도착하면 세대 7에서 새로 쓴 draft를 덮지 않도록 draft version을 비교합니다. 경고를 띄우는 수단과 마지막 문자를 잃지 않는 저장 경계를 분리해야 합니다.

## 득점 포인트

- dirty 상태에 따라 beforeunload를 연결·해제하는 구체적인 전이를 제시합니다.
- 이탈 경고, draft 내구화, bfcache 적격성을 서로 다른 계약으로 나눕니다.
- 모바일에서 이벤트가 오지 않는 실패 경계를 포함합니다.

## 감점 포인트

- beforeunload가 있으면 모든 브라우저에서 bfcache가 반드시 금지된다고 말합니다.
- 경고 대화상자가 보였으므로 서버 저장이 완료됐다고 추론합니다.
- pagehide와 beforeunload가 어떤 종료에서도 순서대로 온다고 가정합니다.

## 더 파고들 거리

- 저장 요청이 진행 중인 상태에서 history 복원이 일어나면 draft 세대를 어떻게 보호할까요?
- 변경되지 않은 인증 캐시와 사용자가 작성한 draft를 같은 복구 정책으로 묶으면 어떤 문제가 생길까요?

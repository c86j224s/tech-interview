---
id: browser-bfcache-lifecycle
title: bfcache 복원과 페이지 수명
topic: 웹
summary: 뒤로 가기·앞으로 가기의 bfcache 복원과 일반 재탐색을 pageshow·pagehide persisted로 구분합니다.
questionIds: []
prerequisites:
  - browser-navigation
related:
  - view-lifecycle
  - js-task-lifetime
  - rendering-layout
reviewedAt: '2026-09-19'
---
# bfcache 복원과 페이지 수명

뒤로 가기와 앞으로 가기는 네트워크에서 HTML을 다시 받는 재탐색과 같은 동작이 아닐 수 있습니다. 브라우저는 history entry에 연결된 문서의 DOM, 입력값, 스크롤 위치와 실행 상태를 back-forward cache(bfcache)에 보관했다가 다시 활성화할 수 있습니다. 따라서 `DOMContentLoaded`를 “화면이 다시 보일 때마다” 실행되는 훅으로 쓰면 복원 경로를 놓칩니다. 반대로 `pageshow`가 왔다고 서버 데이터가 최신이라고 가정해도 안 됩니다. 이 장은 문서 복원, 애플리케이션 최신성, 서버 인가를 서로 다른 소유권 경계로 분리합니다.

## 문서 상태와 history 경로

새 문서 진입에서는 HTML 파싱, 모듈 평가, 초기화가 새로 일어납니다. bfcache 복원에서는 같은 문서 객체가 다시 활성화될 수 있으므로 이미 입력된 검색어와 선택 상태가 남습니다. `pagehide`는 현재 문서가 history 표시에서 빠지는 순간의 신호이고, `pageshow`는 문서가 표시되는 순간의 신호입니다. 두 이벤트의 `persisted`는 브라우저가 캐시 보관·복원 경로를 사용했을 가능성을 나타내는 관찰값이지, 영구 저장소의 성공 보고나 서버 상태의 스냅숏은 아닙니다.

`persisted === false`인 `pageshow`도 새로고침이나 일반 진입에서 발생할 수 있으므로 “false면 아무것도 하지 않는다”는 분기는 안전하지 않습니다. 공통 진입 함수는 화면을 준비하되, true일 때만 복원 이후 재검증을 조금 더 적극적으로 수행하는 식으로 설계합니다. 정확한 적격성은 브라우저, WebView, 버전, 열려 있는 리소스와 문서 상태에 따라 달라집니다.

## pageshow·pagehide 관찰 순서

복원 후보의 전형적인 관찰은 `pagehide(persisted=true) → 문서 일시 보관 → pageshow(persisted=true)`입니다. 이때 `pagehide`가 호출됐다는 사실은 문서가 즉시 파괴됐다는 뜻이 아닙니다. 반대로 `persisted=false`라고 해서 모바일 종료까지 모두 관찰했다는 뜻도 아닙니다. 애플리케이션 로그에는 문서 세대, history 이동 여부, persisted 값, 네트워크 재요청, WebSocket 상태를 함께 남겨야 합니다.

```diagram
{"title":"문서 복원과 최신성 경계","caption":"persisted는 복원 경로를 관찰하는 값이고, 데이터 최신성과 권한은 pageshow 뒤 별도 검증이 필요합니다.","rows":[[{"id":"active","label":"활성 문서","detail":["DOM·입력·세대"]}],[{"id":"hide","label":"pagehide","detail":["persisted 관찰"]}],[{"id":"cache","label":"bfcache 보관","detail":["실행 상태 보존 가능"]}],[{"id":"show","label":"pageshow","detail":["복원 후 진입"]}],[{"id":"check","label":"재검증","detail":["데이터·권한·연결"]}]],"edges":[{"from":"active","to":"hide","label":"history 이탈"},{"from":"hide","to":"cache","label":"재사용 가능"},{"from":"cache","to":"show","label":"문서 재활성화"},{"from":"show","to":"check","label":"앱 정책 실행"}]}
```

## 데이터 신선도와 세대

복원된 검색 목록은 잠시 stale한 화면을 보여 주고 `ETag` 조건부 요청으로 검증할 수 있습니다. 하지만 잔액, 가격, 예약 가능 여부처럼 행동을 허용하는 값은 버튼을 누르는 순간 서버가 현재 세션과 자원 권한을 다시 검사해야 합니다. 브라우저가 보관한 DOM은 서버의 권한을 보장하지 않습니다.

중간 상태를 고정하면 경합이 분명해집니다. 화면 세대 7에서 `pageshow`가 발생해 ETag `"v7"` 검증 요청 A를 보냅니다. 사용자가 응답 전에 계정을 바꾸면 세대 8과 새 요청 B가 생깁니다. A가 먼저 304로 도착해도 응답의 세대가 7이면 버리고, B의 세대 8 결과만 적용합니다. ETag가 같다는 것은 표현이 같다는 뜻이지, 계정이 같다는 뜻이 아니므로 캐시 키에도 계정·권한 범위를 넣어야 합니다.

## 연결 자원과 재개

화면 전용 `setInterval`은 pagehide에서 논리적으로 중지하고 pageshow에서 현재 시각을 기준으로 재계산하는 편이 맞습니다. “남은 tick이 3개”를 보존하면 백그라운드에서 흐른 시간을 잃습니다. 만료 시각이 10:05이고 복원이 10:06이라면 즉시 만료 상태를 계산해야 합니다. WebSocket은 객체가 존재하는지보다 handshake, ping/pong, 애플리케이션 sequence로 생존 여부를 확인합니다. 마지막 처리 sequence가 42라면 재연결 시 snapshot 또는 43 이후 증분을 요청하고, 재연결 시도는 세대별 하나로 제한합니다.

`pagehide`에서 항상 모든 socket을 닫는 정책도, socket을 무조건 살려 두는 정책도 자동으로 옳지 않습니다. 복원 중 연결이 중복되면 같은 메시지가 두 번 반영되고, 끊긴 동안 보낸 이벤트를 서버가 재생하지 않으면 화면이 조용히 낡습니다. 연결 owner, 마지막 sequence, 재구독 id를 하나의 상태로 기록합니다.

## beforeunload와 dirty 상태

`beforeunload`는 저장하지 않은 변경을 잃을 때 이탈 확인을 요청하는 용도입니다. 상시 리스너는 일부 브라우저에서 bfcache 적격성에 불리할 수 있으므로, 문서가 dirty가 된 순간 등록하고 저장·취소가 완료되면 제거합니다. 이는 모든 브라우저가 같은 방식으로 배제한다는 단정이 아니라, 적격성 손실 가능성과 불필요한 대화상자를 함께 줄이는 선택입니다.

이탈 대화상자는 저장 완료의 증거가 아닙니다. 입력 이벤트에서 로컬 draft나 서버 draft에 먼저 내구화하고, 모바일에서 beforeunload가 오지 않는 종료 경계도 고려해야 합니다. `pagehide`는 관찰 신호로 쓸 수 있지만 종료 전송을 반드시 완료시키는 API로 취급하지 않습니다.

## 로그아웃과 민감한 화면

로그아웃 후 뒤로 가기에서 과거 DOM이 잠시 그려질 수 있으므로 `pageshow`는 세션 상태와 account namespace를 다시 확인하는 운영 경계가 됩니다. 인증이 없으면 즉시 보호 화면으로 전환하고, query cache·draft·구독을 계정별로 폐기하거나 격리합니다. 그러나 pageshow 검사는 confidentiality barrier가 아닙니다. 이미 복원된 DOM이 먼저 그려질 수 있고 클라이언트가 내려받은 데이터도 자동 삭제되지 않기 때문입니다.

최종 경계는 개인 API의 매 요청 인가입니다. 클라이언트가 버튼을 숨겨도 서버는 세션, 자원 소유권, 현재 version을 확인해 401/403을 반환해야 합니다. 서비스 워커나 CacheStorage가 개인 응답을 저장한다면 로그아웃 시 namespace 삭제 정책과 캐시 응답의 민감도도 별도로 정합니다.

## 검증 비용과 실패 경계

DevTools의 bfcache 검사와 이벤트 로그를 사용해 새로고침, 일반 링크 이동, 뒤로 가기, 세션 만료를 분리 재현합니다. 확인할 실패는 복원 화면이 재검증 전에 낡은 권한 버튼을 보이는 경우, A 응답이 B 화면을 덮는 경우, socket 재연결이 두 개 생기는 경우, 모바일에서 pagehide 없이 프로세스가 끝나는 경우입니다. 전체 fetch는 최신성을 높이지만 지연·서버 비용이 크고, 검증 endpoint만 호출하면 비용은 낮지만 표시 필드 전체의 신선도는 보장하지 않습니다.

## 참고 자료와 적용 범위

[MDN pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event)는 문서 표시와 history 복원 가능성, `persisted` 관찰을 설명하는 secondary documentation입니다. [MDN pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event)는 문서 이탈과 보관 가능성, pagehide listener 자체를 bfcache 배제 근거로 삼지 않는 점을 다룹니다. 이 자료만으로 특정 브라우저·WebView 버전의 모든 적격성을 확정하지 않았습니다. target 환경에서는 실제 bfcache 검사, 네트워크, 모바일 종료를 별도로 확인해야 합니다.

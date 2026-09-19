---
id: dom-passive-listener-contract
title: Passive 이벤트 리스너와 스크롤 기본 동작
topic: 웹
summary: passive가 preventDefault 계약과 스크롤 입력 관찰·취소를 바꾸는 방식을 설명합니다.
questionIds: []
prerequisites:
  - event-delegation
related:
  - event-delegation
  - rendering-layout
reviewedAt: '2026-09-19'
---
# Passive 이벤트 리스너와 스크롤 기본 동작

`passive`는 콜백이 빠르다는 성능 보장이 아니라 “이 리스너는 기본 동작을 `preventDefault()`로 취소하지 않겠다”는 계약입니다. 브라우저는 이 약속을 이용해 wheel·touch 입력에서 취소 여부를 기다리지 않고 기본 스크롤을 진행할 수 있습니다. 따라서 관찰용 analytics 리스너와 실제 제스처 owner를 같은 옵션으로 바꾸면 안 됩니다.

## 이벤트 경로와 취소 상태

`target`은 이벤트가 시작된 노드이고 `currentTarget`은 현재 callback이 등록된 노드입니다. `capture`와 bubbling은 전달 경로를 결정하고, `cancelable`은 기본 동작 취소 자체가 가능한지를 나타냅니다. `preventDefault()`는 기본 동작을 막고, `stopPropagation()`은 다른 노드로의 전파를 멈춥니다. 같은 이벤트에서 둘을 호출해도 서로의 효과가 생기지 않습니다.

passive는 이 중 취소 권한만 제한합니다. passive callback도 delta, pointer 좌표, modifier 키를 읽고 상태를 기록할 수 있습니다. 다만 callback에서 큰 계산과 DOM write를 하면 passive여도 메인 스레드 비용은 남습니다. 스크롤 지연을 줄이는 첫 단계는 취소 계약과 실행 시간 모두를 분리해서 기록하는 것입니다.

## passive와 preventDefault

```js
panel.addEventListener('wheel', event => {
  event.preventDefault();
  recordDelta(event.deltaY);
}, {passive: true});
```

위 코드에서 callback은 실행되지만 passive 리스너의 `preventDefault()`는 기본 동작 취소를 만들지 않습니다. 콘솔 경고가 있을 수 있지만 경고가 없다고 성공한 것도 아닙니다. `{passive:false}`로 바꾸면 cancelable한 실제 입력에서 취소를 요청할 수 있을 뿐, 모든 wheel이 반드시 멈추는 것은 아닙니다.

```diagram
{"title":"입력에서 기본 동작까지","caption":"리스너 호출, 이벤트 취소 가능성, passive 계약과 브라우저 기본 동작은 별도 경계입니다.","rows":[[{"id":"input","label":"wheel·touch","detail":["입력 생성"]}],[{"id":"route","label":"전달 경로","detail":["capture·bubble"]}],[{"id":"handler","label":"callback","detail":["관찰·취소 요청"]}],[{"id":"decision","label":"취소 판정","detail":["cancelable·passive"]}],[{"id":"default","label":"기본 동작","detail":["스크롤·확대"]}]],"edges":[{"from":"input","to":"route","label":"이벤트 경로"},{"from":"route","to":"handler","label":"리스너 호출"},{"from":"handler","to":"decision","label":"preventDefault"},{"from":"decision","to":"default","label":"취소 실패 시 진행"}]}
```

## 리스너 동일성과 제거

제거에는 같은 `EventTarget`, type, callback 객체가 필요하고 `capture` 값이 등록과 일치해야 합니다. `passive`와 `once`는 matching key가 아니지만 callback 함수 객체는 반드시 같아야 합니다. 같은 함수 `onMove`를 `capture:true`와 `capture:false`로 각각 등록한 뒤 `removeEventListener(type,onMove,{capture:true})`를 호출하면 capture 등록 하나만 제거되고 bubble 등록은 남습니다. 따라서 “callback만 같다”는 답은 부족합니다.

새 화살표 함수를 제거 시점에 다시 만들면 소스가 같아 보여도 identity가 달라집니다. mount에서 handler와 options를 저장하고 unmount에서 같은 handler와 capture를 전달하거나, 여러 리스너를 `AbortSignal` 하나에 묶어 owner 종료 시 중단하는 방식을 사용합니다. 남은 closure는 중복 호출과 이전 DOM·상태 보존을 동시에 만들 수 있습니다.

## cancelable과 실행 시점

`event.cancelable === false`인 합성 이벤트는 passive를 false로 바꿔도 취소되지 않습니다. `new Event('wheel')`처럼 cancelable 기본값을 설정하지 않은 경우가 대표적입니다. 실제 입력도 기본 동작 시점이 지난 뒤 `setTimeout`에서 `preventDefault()`를 호출하면 이미 실행된 scroll을 되돌리지 못합니다. `defaultPrevented`와 실제 `scrollTop` 변화를 같이 관찰해야 “호출됐다”와 “효과가 났다”를 구분할 수 있습니다.

또한 한 이벤트의 다른 listener가 이미 상태를 바꾸거나 서버 요청을 시작했다면 preventDefault가 그 외부 효과를 취소하지 않습니다. 전파를 막고 싶으면 stopPropagation, 기본 동작을 막고 싶으면 preventDefault라는 책임을 명시합니다.

## touch-action과 제스처 owner

터치 제스처의 허용 방향을 CSS `touch-action`으로 선언하면 브라우저가 제스처를 판단하는 계약을 미리 알 수 있습니다. 가로 carousel이 가로 드래그를 소유하고 세로 문서 스크롤을 허용하는 경우, CSS 선언과 JavaScript의 방향 판정이 일치해야 합니다. `touch-action`은 임의 callback의 cancelable을 true로 바꾸는 옵션이 아니며, 실제 target 브라우저의 pointer/touch 해석을 검증해야 합니다.

모든 touch listener를 passive로 만들면 관찰용 입력은 가벼워질 수 있지만 지도 핀치 확대, canvas drag처럼 기본 동작을 취소해야 하는 owner는 망가질 수 있습니다. 반대로 모두 non-passive면 스크롤 시작이 긴 handler를 기다리는 비용이 생깁니다. 필요한 요소와 이벤트에만 non-passive를 남깁니다.

## 측정과 실패 추적

작은 재현에서는 같은 callback을 passive true/false로 각각 등록하고 `cancelable`, `defaultPrevented`, handler 실행 시간, `scrollTop`을 기록합니다. 다음으로 capture 값을 바꿔 제거 결과를 확인하고, synthetic cancelable false와 실제 device 입력을 분리합니다. 자동 passive 정책은 이벤트·브라우저별로 달라질 수 있으므로 target 환경의 등록 결과와 콘솔을 확인합니다.

흔한 실패는 passive를 callback 미실행으로 오해하는 것, stopPropagation으로 스크롤을 막으려는 것, capture mismatch로 리스너가 남는 것, touch-action만 넣고 gesture owner를 정의하지 않는 것입니다. 기록만 필요한 값은 짧은 버퍼와 rAF로 화면 갱신을 합칠 수 있지만, rAF 안에서 무거운 layout read/write를 반복하면 다른 비용이 생깁니다.

## 비용과 참고 범위

[DOM Standard passive 정의](https://dom.spec.whatwg.org/#dom-eventlisteneroptions-passive)는 passive가 preventDefault에 의한 기본 동작 취소 금지 계약임을 규정합니다. 이 원문을 읽고 listener matching과 취소 구분을 적용했습니다. wheel·touch의 자동 passive 기본값, touch-action과 WebView 조합, 각 엔진의 스크롤 시점은 특정 target 버전의 동작으로 좁혀 검증해야 합니다. 기존 event delegation 내용은 전파 경로의 전제만 제공하며, 이 노트의 핵심은 취소 권한과 listener 수명입니다.

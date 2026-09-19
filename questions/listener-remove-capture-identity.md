---
id: listener-remove-capture-identity
title: passive listener를 제거할 때 callback만 같게 넘기면 충분한가요?
difficulty: 중하
category: 웹
tags:
  - passive
  - preventDefault
  - scroll
  - DOM event
related:
  - capture-versus-bubble-delegation
---
# passive listener를 제거할 때 callback만 같게 넘기면 충분한가요?

## 구두 답변

callback만 같게 넘기는 것으로는 충분하지 않습니다. 같은 `EventTarget`, 이벤트 type, 같은 callback 객체가 필요하고, 등록할 때의 `capture` 값과 제거할 때의 `capture` 값이 일치해야 합니다. `passive`와 `once`는 matching에서 capture처럼 비교되는 값이 아니지만, 함수 identity는 반드시 같아야 합니다.

두 등록을 실제 상태로 보겠습니다.

```js
function onMove(e) { console.log(e.type); }
window.addEventListener('touchmove', onMove, {capture: true, passive: true});
window.addEventListener('touchmove', onMove, {capture: false, passive: true});
window.removeEventListener('touchmove', onMove, {capture: true});
```

첫 제거 뒤 capture=true 등록은 사라지지만 capture=false 등록은 남습니다. 따라서 다음 touchmove에는 callback이 한 번 실행됩니다. 제거 시 `{capture:false}`를 한 번 더 전달해야 bubble 등록까지 없어집니다. 반대로 `removeEventListener('touchmove', e => console.log(e.type), {capture:true})`는 새 함수 객체라서 원래 등록과 같지 않습니다. 소스 코드가 같은 화살표인지가 아니라 객체 identity가 기준입니다.

SPA에서는 owner가 handler와 capture 정책을 함께 보관하거나 `AbortController.signal`로 수명을 묶습니다. 남은 listener는 중복 처리뿐 아니라 이전 closure가 화면 state와 DOM을 붙잡는 원인이 됩니다. `passive` 값만 바꿔 제거가 실패했다고 말하지 말고, target/type/callback/capture 네 경계를 먼저 확인합니다.

## 득점 포인트

- capture true·false 두 등록 뒤 한 번 제거했을 때 한 등록만 남는 trace를 제시합니다.
- callback 객체 identity와 capture matching을 passive·once와 분리합니다.
- SPA 수명에서 중복 실행과 closure 보존 비용을 설명합니다.

## 감점 포인트

- 옵션 객체가 내용상 같으면 새 화살표 callback도 제거된다고 합니다.
- passive 값이 다르면 capture가 같아도 반드시 제거되지 않는다고 단정합니다.
- DOM 노드가 사라지면 window에 남은 listener도 자동으로 정리된다고 가정합니다.

## 더 파고들 거리

- AbortSignal로 capture가 다른 여러 listener를 묶을 때 owner 종료 순서는 어떻게 정할까요?
- listener가 fetch를 시작한 뒤 제거돼도 응답 callback이 남는 문제는 어떻게 끊을까요?

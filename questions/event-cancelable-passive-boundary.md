---
id: event-cancelable-passive-boundary
title: event.cancelable=false일 때 passive를 false로 바꿔도 해결되지 않는 것은 무엇인가요?
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
# event.cancelable=false일 때 passive를 false로 바꿔도 해결되지 않는 것은 무엇인가요?

## 구두 답변

`cancelable:false`는 그 이벤트가 취소할 수 있는 기본 동작을 제공하지 않는다는 뜻이므로, listener를 `{passive:false}`로 바꿔도 `preventDefault()`로 막을 수 없습니다. passive는 취소 가능한 이벤트에서 이 listener가 취소하지 않겠다는 제한이고, cancelable은 이벤트 객체 자체의 계약입니다. 두 조건을 AND로 봐야 합니다.

예를 들어 `new Event('wheel')`은 cancelable을 명시하지 않으면 false인 합성 이벤트가 됩니다. handler가 `preventDefault()`를 호출해도 `defaultPrevented`는 false로 남습니다. `new WheelEvent('wheel', {cancelable:true})`처럼 테스트 입력을 만들면 passive false listener에서 취소 요청을 관찰할 수 있지만, 실제 브라우저의 scroll을 합성 이벤트가 재현하는 것은 아니므로 `defaultPrevented`와 실제 입력의 scrollTop을 구분합니다. 또한 `setTimeout(() => event.preventDefault())`처럼 기본 동작 시점 뒤에 호출하면 cancelable true여도 이미 진행된 동작을 되돌릴 수 없습니다.

`stopPropagation()`은 이 문제의 대안이 아닙니다. 기본 동작을 취소하려면 취소 가능한 실제 입력을 적절한 시점에 non-passive listener에서 처리하거나 CSS `touch-action`으로 제스처 계약을 선언해야 합니다. 진단 순서는 이벤트 생성 주체와 종류, cancelable, passive/capture 등록, 기본 동작 owner, 호출 시각, defaultPrevented, 실제 위치 변화를 한 로그로 묶는 것입니다.

## 득점 포인트

- cancelable과 passive를 독립된 축으로 설명합니다.
- 합성 이벤트의 기본값, 비동기 호출 시점, 실제 scroll 결과를 서로 구분합니다.
- defaultPrevented가 true여도 외부 요청이 자동 취소되지 않는 경계를 말합니다.

## 감점 포인트

- passive false가 cancelable false를 true로 바꾼다고 합니다.
- preventDefault를 늦게 호출해도 이미 실행된 기본 동작을 되돌린다고 설명합니다.
- stopPropagation을 기본 동작 취소의 대체재로 사용합니다.

## 더 파고들 거리

- 합성 이벤트 테스트에서 bubbles와 cancelable을 각각 고정해야 하는 이유는 무엇일까요?
- 기본 동작은 허용하되 listener가 만든 UI 변경만 보정해야 하는 경우 어떤 상태 모델을 둘까요?

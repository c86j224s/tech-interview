---
id: passive-preventdefault-contract
title: passive wheel listener의 preventDefault가 스크롤을 막지 못하는 이유는 무엇인가요?
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
# passive wheel listener의 preventDefault가 스크롤을 막지 못하는 이유는 무엇인가요?

## 구두 답변

`passive:true`는 callback을 실행하지 않겠다는 옵션이 아니라, 그 callback이 기본 동작을 `preventDefault()`로 취소하지 않겠다는 계약입니다. 그래서 다음 wheel에서 handler가 호출되고 `event.preventDefault()` 문장까지 실행돼도 passive listener의 호출은 스크롤 취소 효과를 만들지 않습니다. 브라우저는 listener가 취소할지 기다리지 않고 기본 동작을 진행할 수 있습니다.

작은 비교를 이렇게 고정합니다. `scrollTop=100`인 panel에 같은 함수 객체를 passive true와 false로 각각 등록하고 cancelable wheel을 보냅니다. true handler에서는 `cancelable=true`, 호출 전 `defaultPrevented=false`, 호출 뒤에도 취소 효과가 없고 scrollTop이 증가할 수 있습니다. false handler는 실제 이벤트가 cancelable하고 다른 조건이 없다면 `defaultPrevented=true`가 되어 기본 스크롤을 막을 수 있습니다. 그러나 두 handler가 함께 있으면 false 쪽이 취소할 수 있고, 어느 listener가 먼저 실행됐는지까지 로그해야 합니다. synthetic event가 `cancelable:false`라면 false로 바꿔도 결과는 달라지지 않습니다.

`stopPropagation()`은 전달 경로를 제어할 뿐 기본 스크롤을 취소하지 않습니다. 실제 취소가 필요한 gesture owner만 non-passive로 좁히고, 관찰용 listener는 passive로 둡니다. non-passive handler가 긴 layout 계산을 하면 스크롤 지연이 커질 수 있으며, touch 제스처는 CSS `touch-action` 계약도 함께 확인해야 합니다.

## 득점 포인트

- passive를 성능 힌트가 아닌 preventDefault 금지 계약으로 말합니다.
- cancelable/defaultPrevented/scrollTop의 입력과 결과를 비교합니다.
- stopPropagation과 preventDefault의 책임을 분리합니다.

## 감점 포인트

- passive면 callback 자체가 호출되지 않는다고 합니다.
- passive false이면 cancelable 여부와 무관하게 모든 스크롤이 멈춘다고 단정합니다.
- 콘솔 경고가 없으면 preventDefault가 성공했다고 판정합니다.

## 더 파고들 거리

- 브라우저가 특정 touch listener를 자동 passive로 취급하는지 어떻게 측정할까요?
- passive false handler의 긴 작업을 취소 권한을 잃지 않고 어떤 실행 단위로 줄일까요?

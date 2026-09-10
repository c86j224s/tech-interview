---
id: dom-event-delegation
title: "동적으로 추가되는 목록 항목의 클릭을 한 곳에서 처리하려면 이벤트 위임을 어떻게 적용하나요?"
answerMinutes: 5
followups: [{"id":"css-cascade-specificity","prompt":"위임으로 찾은 항목의 상태 class가 여러 스타일과 충돌할 때 동작 코드와 최종 CSS 값을 어떻게 분리해 확인하나요?"},{"id":"js-event-loop-microtasks","prompt":"클릭 handler가 DOM을 갱신하고 Promise callback에서 다시 읽을 때 이벤트 작업과 microtask의 실행 순서를 어떻게 판단하나요?"},{"id":"browser-rendering-layout","prompt":"대량 목록 클릭 뒤 각 항목의 layout을 측정해야 한다면 handler 안의 DOM 읽기·쓰기를 어떻게 배치할까요?"}]
difficulty: 하
category: 웹
tags: ["DOM","이벤트","버블링","이벤트 위임","JavaScript"]
related: []
---

# 동적으로 추가되는 목록 항목의 클릭을 한 곳에서 처리하려면 이벤트 위임을 어떻게 적용하나요?

## 구두 답변

이벤트 위임은 동적으로 생기는 각 목록 항목에 리스너를 따로 붙이는 대신, 공통 조상에 하나의 리스너를 두고 이벤트 버블링으로 대상을 찾는 방식입니다. 항목이 나중에 추가돼도 조상 리스너는 이미 존재하므로 새 등록이 필요 없습니다. 다만 `event.target`이 실제 클릭한 가장 안쪽 요소이고 `currentTarget`이 리스너가 붙은 조상이라는 점, 이벤트가 버블링되는 종류인지, 중첩 구조가 안전한지를 함께 확인해야 합니다.

### 대상과 범위를 안전하게 찾습니다

`#items` 목록 안의 `[data-id]` 항목을 처리하는 예시는 다음과 같습니다. 목록이 DOM에 있고 코드가 파싱 뒤 실행된다는 전제입니다.

```js
const list = document.querySelector('#items');
list.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const item = event.target.closest('[data-id]');
  if (!item || !list.contains(item)) return;
  console.log(item.dataset.id);
});
```

버튼 안의 `span`을 눌러도 target은 span이므로 `closest`로 의도한 항목을 찾습니다. `list.contains(item)`은 목록 밖 조상에서 일치한 대상을 제외하지만, 목록 안의 중첩 컴포넌트까지 구분하지는 않습니다. 더 엄격하게 목록의 직접 자식만 대상으로 하거나 `closest` 뒤 `item.parentElement === list`를 확인할 수도 있습니다. data-id는 표시 문자열이 아니라 서버가 검증할 식별자로 사용하고, 삭제된 항목이나 비활성 상태도 이벤트 시점에 다시 검사하겠습니다.

### 전파와 기본 동작을 분리합니다

캡처 단계는 조상에서 대상 방향으로 내려가고 버블 단계는 대상에서 조상 방향으로 올라갑니다. 위 코드는 기본 버블 단계입니다. 자식 컴포넌트가 `stopPropagation()`을 호출하면 조상 리스너에 도달하지 않을 수 있고, `preventDefault()`는 링크 이동·폼 제출 같은 기본 동작만 취소할 뿐 이벤트 전파를 멈추지 않습니다. 링크 클릭을 가로채야 한다면 이벤트가 cancelable인지와 키보드 활성화·보조 기술 사용을 함께 고려합니다. 이벤트 자체가 버블링되지 않는 경우에는 캡처 리스너나 해당 요소의 직접 처리 등 다른 경로를 선택해야 합니다.

Shadow DOM 경계에서는 target이 재지정될 수 있어 외부 조상에서 내부 요소를 그대로 보지 못할 수 있습니다. 컴포넌트가 의도한 composed 이벤트인지 `composedPath()`가 필요한지 확인하고, 경계를 무시하는 전역 위임으로 내부 구현을 결합하지 않겠습니다.

위임은 많은 항목에서 리스너 수·등록 비용을 줄이고 동적 목록에 자연스럽지만, 모든 클릭이 조상까지 올라와 선택자 검사 비용이 생깁니다. 컴포넌트 경계가 강하거나 이벤트가 매우 빈번하면 더 가까운 조상이나 개별 리스너가 낫습니다. 키보드 접근성은 click만 받으면 자동으로 완성되지 않으므로 실제 button·link 요소의 기본 keyboard semantics를 사용하고, div라면 필요한 key event와 role·focus를 명시하겠습니다.

검증은 동적 추가·삭제, 내부 span 클릭, 중첩 목록, stopPropagation, 링크 기본 동작, 키보드 활성화, Shadow DOM과 pointer/keyboard 이벤트를 포함합니다. 코드가 짧은 것보다 어떤 조상이 어떤 대상 범위를 소유하는지가 명확한 것이 좋은 위임입니다.



`contains`는 목록 바깥에서 우연히 일치한 대상을 제외할 뿐, 목록 내부의 중첩 컴포넌트를 격리하지는 않습니다. 같은 선택자를 쓰는 하위 위젯이 있으면 직접 자식 조건이나 컴포넌트별 root를 사용해 상위 목록의 위임 범위를 좁히겠습니다. 각 위젯이 이벤트를 소비할지 상위 목록에 전달할지도 계약으로 정하고, 링크와 메뉴 버튼의 기본 동작을 무조건 가로채지 않겠습니다.

## 득점 포인트

- 공통 조상·버블링·동적 요소 처리의 관계를 코드로 설명한다.
- target·currentTarget·closest·contains의 역할을 구분한다.
- stopPropagation과 preventDefault, 캡처·버블 단계를 나눈다.
- 중첩·Shadow DOM·키보드 접근성과 성능 비용을 포함한다.

## 감점 포인트

- 동적으로 추가된 요소에도 개별 리스너가 자동 등록된다고 말한다.
- currentTarget이 실제 클릭된 요소라고 설명한다.
- preventDefault가 전파까지 중단한다고 말한다.
- 모든 이벤트가 버블링하고 click만 처리하면 키보드 접근성도 해결된다고 단정한다.

## 더 파고들 거리

- 캡처 위임이 버블 위임보다 필요한 이벤트는 어떤 경우일까요?
- Shadow DOM 경계에서 target 재지정과 composedPath를 어떻게 확인할까요?
- pointer·keyboard 이벤트를 하나의 항목 활성화 모델로 묶으려면 무엇을 보완할까요?

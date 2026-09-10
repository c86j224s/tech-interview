---
id: dom-event-delegation
title: "동적으로 추가되는 목록 항목의 클릭을 한 곳에서 처리하려면 이벤트 위임을 어떻게 적용하나요?"
difficulty: 하
category: 웹
tags: ["DOM","이벤트","버블링","이벤트 위임","JavaScript"]
related: []
---

# 동적으로 추가되는 목록 항목의 클릭을 한 곳에서 처리하려면 이벤트 위임을 어떻게 적용하나요?

## 구두 답변

이벤트 위임은 각 항목에 리스너를 붙이는 대신, 공통 조상에 하나의 리스너를 두고 이벤트 버블링을 이용해 처리하는 방식입니다. 예를 들어 목록의 항목이 나중에 추가될 수 있다면 다음처럼 작성할 수 있습니다. #items 목록 요소와 그 안의 data-id 항목이 존재하고 DOM 파싱 이후 이 코드를 실행한다고 가정합니다.

```js
const list = document.querySelector('#items');
list.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const item = event.target.closest('[data-id]');
  if (!item || !list.contains(item)) return;
  console.log(item.dataset.id);
});
```

버튼 안의 `span`을 눌러도 `event.target`은 실제로 눌린 span일 수 있으므로 `closest`로 의도한 항목을 찾습니다. `target`은 최초 이벤트 대상이고 `currentTarget`은 현재 리스너가 등록된 목록입니다. 캡처 단계에서는 조상에서 대상 방향으로 내려가고, 버블 단계에서는 대상에서 조상 방향으로 올라가므로 위 코드는 기본 버블 단계에서 실행됩니다. 이벤트가 버블링되지 않는 종류라면 위임을 그대로 적용할 수 없습니다.

동일한 조상 안에 중첩된 항목이 있거나 클릭 대상이 삭제되는 경우에는 `contains`와 선택자 범위를 확인해야 합니다. 자식 컴포넌트가 `stopPropagation()`을 호출하면 조상 리스너에 도달하지 않을 수 있고, `preventDefault()`는 기본 동작만 취소할 뿐 전파를 멈추지 않습니다. 링크의 이동을 막으려면 이벤트가 취소 가능한지 확인하고 필요한 경우 `preventDefault()`를 별도로 호출하겠습니다.

위임은 동적 요소와 많은 항목에서 리스너 수와 등록 작업을 줄이는 장점이 있습니다. 하지만 모든 클릭이 조상까지 올라오므로 복잡한 화면에서는 선택자 검사 비용과 의도하지 않은 대상 매칭이 생길 수 있습니다. 이벤트가 매우 빈번하거나 컴포넌트 경계가 강하면 개별 리스너나 더 가까운 조상에 두는 편이 낫습니다. 먼저 전파 단계, target/currentTarget, 중첩 구조를 확인한 뒤 선택하겠습니다.

## 득점 포인트

- 버블링을 이용해 동적 항목을 처리하는 구조와 코드를 제시한다.
- target과 currentTarget의 실제 차이를 설명한다.
- stopPropagation과 preventDefault를 서로 다른 동작으로 구분한다.

## 감점 포인트

- currentTarget이 항상 실제 클릭된 요소라고 말한다.
- 동적으로 추가된 요소에도 기존 개별 리스너가 자동으로 붙는다고 말한다.
- preventDefault가 이벤트 전파까지 중단한다고 설명한다.

## 더 파고들 거리

- 캡처 단계 위임이 필요한 사례와 버블링 위임의 차이를 비교해 보세요.
- Shadow DOM 경계에서 target 재지정과 composedPath가 왜 필요한가요?
- 이벤트 위임으로 키보드 접근성과 포인터 이벤트를 함께 처리하려면 무엇을 보완할까요?

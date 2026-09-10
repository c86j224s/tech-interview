---
id: browser-rendering-layout
title: "DOM을 여러 번 바꾸는 화면에서 layout이 반복되어 느려집니다. 브라우저 렌더링 단계와 레이아웃 스래싱을 설명해 보세요."
answerMinutes: 5
followups: [{"id":"browser-url-navigation","prompt":"HTML과 CSS 리소스가 순차적으로 도착할 때 네트워크 완료와 첫 화면 표시 사이의 렌더링 비용을 어떻게 나눠 측정하나요?"},{"id":"ssr-csr-hydration","prompt":"서버 HTML이 표시된 뒤 hydration이 DOM을 바꾸면 layout과 상호작용 지연이 어떤 방식으로 추가될 수 있나요?"},{"id":"js-event-loop-microtasks","prompt":"마이크로태스크에서 DOM을 대량 변경하면 브라우저의 입력·렌더링 기회가 어떻게 지연될 수 있나요?"}]
difficulty: 중하
category: 웹
tags: ["브라우저 렌더링","DOM","CSSOM","layout","성능"]
related: ["browser-url-navigation"]
---

# DOM을 여러 번 바꾸는 화면에서 layout이 반복되어 느려집니다. 브라우저 렌더링 단계와 레이아웃 스래싱을 설명해 보세요.

## 구두 답변

브라우저는 HTML을 파싱해 DOM을 만들고 CSS를 파싱해 CSSOM을 만든 뒤, 화면에 필요한 대상을 계산하고 layout에서 각 상자의 위치와 크기를 정합니다. 그 결과를 paint 명령으로 만들고 레이어를 합성해 화면에 표시합니다. DOM에 있다고 모두 layout에 참여하는 것은 아니며 `display: none`처럼 렌더링 대상에서 제외되는 요소도 있습니다. 문제의 핵심은 모든 변경이 같은 비용이라는 것이 아니라, 읽기와 쓰기를 어떤 순서로 섞는가입니다.

### 렌더링 단계와 변경 범위를 구분합니다

색상이나 그림자 변경은 style 계산과 paint가 필요할 수 있고, 크기·위치·폰트 변경은 주변 상자의 재배치인 layout까지 유발할 수 있습니다. 변경 범위는 DOM 구조, 스타일 의존성, containment에 따라 달라지므로 속성 이름만 보고 항상 같은 단계를 단정하지 않겠습니다. `transform`과 `opacity`는 layout을 다시 하지 않고 합성으로 처리될 가능성이 높아 애니메이션에 유리하지만, 새 레이어의 메모리와 합성 비용이 사라지는 것은 아닙니다.

레이아웃 스래싱은 루프에서 스타일을 쓰고 곧바로 최신 기하 정보를 읽는 패턴을 반복해 브라우저의 지연 계산을 매번 강제하는 현상입니다. 예를 들어 `style.width`를 바꾼 뒤 `offsetWidth`나 `getBoundingClientRect()`를 읽고, 다시 width를 바꾸면 브라우저는 지금까지의 변경을 반영하려 layout을 앞당길 수 있습니다. 이런 현상을 **강제 동기 레이아웃** (forced synchronous layout)이라고 부릅니다. 한 번의 읽기가 항상 큰 문제라는 뜻이 아니라 많은 요소에 대해 쓰기와 읽기를 교차시키는 패턴이 문제입니다.

### 읽기와 쓰기를 배치합니다

먼저 필요한 기하 값을 모두 읽고, 그 다음 스타일 변경을 모아 적용하겠습니다. 여러 DOM 노드는 문서 조각이나 프레임워크의 batch 업데이트를 활용하고, scroll·resize처럼 빈번한 입력은 `requestAnimationFrame` 안에서 한 프레임당 한 번 측정하도록 묶습니다. 반복되는 레이아웃이 독립 영역이라면 `contain`으로 영향 범위를 줄이고, 화면 밖 콘텐츠는 `content-visibility`를 검토할 수 있습니다. 다만 containment가 크기·상속·접근성에 미치는 의미를 확인하고 무작정 적용하지 않습니다.

이미지를 늦게 읽거나 웹 폰트가 바뀌면 초기 계산 후 위치가 다시 바뀌어 누적 레이아웃 이동이 생길 수 있습니다. 이미지 크기와 글꼴 대체 전략을 선언하고, 긴 JavaScript 작업이 layout보다 먼저 메인 스레드를 막고 있는지도 분리해서 보겠습니다.

개발자 도구 Performance 기록에서 Recalculate Style, Layout, Paint, Composite Layers와 긴 작업·프레임 드롭을 변경 전후로 비교합니다. DOM 노드 수를 무조건 줄이는 것보다 실제 forced layout 호출, 영향을 받은 영역, 사용자에게 보이는 입력 지연을 찾아 줄이는 것이 목표입니다. 검증은 정상 화면뿐 아니라 대량 목록 갱신, scroll 중 측정, 이미지·폰트 로딩, 저사양 기기에서 수행하겠습니다.

레이아웃 비용을 줄인다는 이유로 모든 요소에 `will-change`를 붙이지 않겠습니다. 브라우저가 레이어를 많이 만들면 GPU 메모리와 합성 작업이 늘고 오히려 스크롤이 나빠질 수 있습니다. `content-visibility: auto`는 화면 밖 콘텐츠 계산을 미룰 수 있지만 대략적인 크기 보정이 없으면 스크롤바와 위치가 바뀔 수 있으므로 실제 콘텐츠 크기와 접근성 탐색을 확인합니다. 가상 목록은 DOM 수를 줄이는 대신 항목 재사용·포커스 이동·스크린 리더의 전체 목록 인식이라는 계약을 추가합니다. 변경 전후에는 평균 프레임 시간뿐 아니라 p95 입력 지연과 저사양 기기의 메모리도 비교하겠습니다.

## 득점 포인트

- DOM·CSSOM·style·layout·paint·합성의 역할을 구분한다.
- 쓰기 뒤 기하 읽기가 forced synchronous layout을 만들 수 있음을 설명한다.
- 읽기·쓰기 배치, rAF, transform의 이점과 레이어 비용을 비교한다.
- Performance 기록에서 레이아웃·paint·긴 JS를 분리해 검증한다.

## 감점 포인트

- DOM과 렌더링 대상이 항상 같은 노드라고 말한다.
- 모든 스타일 변경이 전체 layout을 동일하게 유발한다고 단정한다.
- transform을 쓰면 비용이 전혀 없다고 설명한다.
- 브라우저가 읽기·쓰기 교차를 항상 자동으로 최적화한다고 믿는다.

## 더 파고들 거리

- contain과 content-visibility가 영향 범위와 초기 표시를 어떻게 바꾸는지 비교해 보세요.
- 폰트·이미지 로딩과 누적 레이아웃 이동을 어떤 지표로 연결할까요?
- 긴 JavaScript 작업과 강제 layout의 인과 순서를 Performance에서 어떻게 확인할까요?

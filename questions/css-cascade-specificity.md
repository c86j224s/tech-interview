---
id: css-cascade-specificity
title: "부모에 글자색을 지정하고 컴포넌트 스타일도 추가했는데 예상과 다른 색이 표시됩니다. 상속과 여러 스타일시트의 선언 중 어떤 값이 적용되는지 어떤 순서로 확인하나요?"
answerMinutes: 5
followups: [{"id":"css-reset-normalize","prompt":"브라우저 기본 스타일을 줄이려는 reset이 cascade와 포커스·제목 의미에 어떤 영향을 줄 수 있는지 어떻게 검증하나요?"},{"id":"browser-rendering-layout","prompt":"선택된 스타일이 색상만 바꾸는지 크기와 위치까지 바꾸는지에 따라 렌더링 비용을 어떻게 판단하나요?"},{"id":"ssr-csr-hydration","prompt":"서버와 클라이언트가 서로 다른 class를 처음 렌더하면 cascade 결과와 hydration 일치를 어떻게 확인할까요?"}]
difficulty: 하
category: 웹
tags: ["CSS","cascade","specificity","상속","선택자"]
related: ["css-reset-normalize"]
---

# 부모에 글자색을 지정하고 컴포넌트 스타일도 추가했는데 예상과 다른 색이 표시됩니다. 상속과 여러 스타일시트의 선언 중 어떤 값이 적용되는지 어떤 순서로 확인하나요?

## 구두 답변

CSS의 최종 값은 선택자가 더 긴지부터 보는 것이 아니라 cascade의 우선순위를 순서대로 비교해 정합니다. 일반적으로 출처와 `!important`, 애니메이션·트랜지션 같은 중요도 조건, cascade layer, specificity, `@scope`를 사용한다면 스코프 근접성, 마지막으로 소스 순서를 확인합니다. 이 앞 단계가 같을 때 ID가 클래스·속성·가상 클래스보다 강하고, 클래스 계열이 요소 선택자보다 강합니다. 부모의 값은 자식의 직접 선언과 같은 경쟁에 들어가는 것이 아니라 상속 경로로 사용됩니다.

### 직접 선언과 상속을 먼저 나눕니다

`p`에 직접 `color`가 있으면 부모 `.card`의 color보다 직접 선언이 우선합니다. 자식에 적용 가능한 선언이 없고 해당 속성이 상속되는 경우에만 부모 값을 물려받습니다. 모든 CSS 속성이 상속되는 것은 아니며, `margin`이나 `width`를 부모에서 지정했다고 자식이 자동으로 같은 값을 얻는다고 생각하면 안 됩니다. `inherit`는 부모 값을 명시적으로 가져오고, `initial`은 명세의 초기값으로, `unset`은 속성의 상속 여부에 따라 초기값 또는 상속값으로 해석됩니다.

예를 들어 출처·중요도·레이어가 같고 p가 .card 내부에 있다면 다음에서는 `.card p`가 `p`보다 specificity가 높아 green이 됩니다.

```css
p { color: blue; }
.card p { color: green; }
```

반대로 부모가 `color: red`를 갖고 자식 `p`에 `color: blue`가 직접 지정돼 있다면 부모 색상이 자식 선언을 덮지 못합니다. DevTools에서 상속된 값인지 직접 선언인지, 취소선의 이유가 specificity인지 layer·출처인지 구분하겠습니다.

### 우선순위를 키우기보다 구조를 고칩니다

ID 선택자와 `!important`를 계속 추가하면 컴포넌트가 서로의 우선순위를 이기기 위한 경쟁을 시작합니다. reset·base·components·utilities를 cascade layer로 나누고, 낮은 specificity의 예측 가능한 선택자를 사용하겠습니다. `:where()`처럼 specificity를 낮추는 도구와 `:is()`처럼 인자 중 최대 specificity를 취하는 도구의 차이도 설계에 영향을 줍니다. 같은 specificity인 규칙은 scope 근접성까지 같을 때 로드·선언 순서가 결과를 바꾸므로 스타일시트 import 순서와 layer 순서를 명시합니다.

상태 클래스가 붙었는데 색이 예상과 다르면 먼저 해당 요소에 직접 적용된 선언과 상속 여부를 보고, 그 뒤 출처·important·layer·specificity·scope·소스 순서를 확인합니다. 브라우저 기본 스타일은 작성자 스타일보다 다른 우선순위를 가질 수 있으므로 reset이 모든 문제를 해결한다고 보지 않습니다.

검증은 같은 요소에 여러 출처와 layer, 부모 상속, `!important`, 동적 class 추가, shadow 경계, `unset`·`inherit`를 넣어 실제 computed value를 확인합니다. ‘더 구체적인 선택자가 이긴다’는 설명은 앞선 조건이 동일할 때만 맞으며, 디버깅도 이 전제를 지키는 것이 핵심입니다.

예시의 조건을 더 분명히 하면, 같은 출처·중요도·layer이고 `<div class="card"><p>text</p></div>`처럼 p가 .card 안에 있을 때 두 번째 선언이 승자가 됩니다. 만약 서로 다른 `@scope` 블록에 있고 specificity까지 같다면 scope의 근접성을 먼저 비교하고, 그 뒤에도 같을 때 선언 순서를 봅니다. 따라서 DevTools에서 단순히 파일의 아래쪽 규칙을 찾는 방식은 부족합니다. `:where(.card p)`로 컴포넌트 기본 규칙의 specificity를 0으로 낮추고 사용자가 덮어쓸 지점을 열어 두는 식으로 설계하면 `!important`의 확산을 줄일 수 있습니다. CSS-in-JS나 shadow root를 사용해도 최종 computed value와 경계별 스타일 출처를 확인하겠습니다.

## 득점 포인트

- 상속과 자식의 직접 선언을 구분한다.
- 출처·중요도·layer·specificity·scope·소스 순서의 판단 순서를 설명한다.
- 예측 가능한 layer와 낮은 specificity로 해결하는 운영 기준을 제시한다.
- DevTools에서 computed value와 승자 규칙의 탈락 이유를 확인한다.

## 감점 포인트

- 선택자가 긴 규칙은 항상 이긴다고 말한다.
- 모든 CSS 속성이 부모에서 상속된다고 말한다.
- 해결책으로 ID와 `!important`를 무조건 추가한다.
- 같은 specificity에서 선언 순서와 layer를 무시한다.

## 더 파고들 거리

- `:where()`와 `:is()`가 컴포넌트 선택자 설계에 주는 차이는 무엇일까요?
- cascade layer 도입으로 기존 스타일의 승자와 유지보수 책임이 어떻게 바뀔까요?
- 상속되지 않는 속성에서 `unset`과 `inherit`가 실제로 만드는 값을 비교해 보세요.

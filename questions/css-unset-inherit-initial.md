---
id: "css-unset-inherit-initial"
title: "상속되지 않는 CSS 속성에 unset과 inherit를 적용하면 어떤 값이 되며 initial과는 어떻게 다른가요?"
difficulty: "중하"
category: "웹"
tags: ["CSS","cascade","specificity","상속","선택자","심화 질문"]
related: ["css-cascade-specificity","css-reset-normalize"]
promotedFrom: {"id":"css-cascade-specificity","prompt":"상속되지 않는 속성에서 `unset`과 `inherit`가 실제로 만드는 값을 비교해 보세요."}
---

# 상속되지 않는 CSS 속성에 unset과 inherit를 적용하면 어떤 값이 되며 initial과는 어떻게 다른가요?

## 구두 답변

inherit는 부모의 계산값을 사용하고 initial은 속성의 명세상 초기값을 사용합니다. unset은 상속 속성이면 inherit처럼, 비상속 속성이면 initial처럼 동작합니다.

예를 들어 margin 같은 비상속 속성에 unset을 주면 부모 margin을 받는 것이 아닙니다. revert·revert-layer는 cascade를 되돌리는 다른 의미입니다. 브라우저 기본 스타일·layer·명시도와 함께 computed style로 확인하고 reset을 모든 속성의 부모 복사로 해석하지 않습니다.

## 득점 포인트

- inherit는 부모의 계산값을 사용하고 initial은 속성의 명세상 초기값을 사용합니다. unset은 상속 속성이면 inherit처럼, 비상속 속성이면 initial처럼 동작합니다.
- 브라우저 기본 스타일·layer·명시도와 함께 computed style로 확인하고 reset을 모든 속성의 부모 복사로 해석하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: inherit는 부모의 계산값을 사용하고 initial은 속성의 명세상 초기값을 사용합니다.

## 더 파고들 거리

- [기본 상황과 비교: 부모에 글자색을 지정하고 컴포넌트 스타일도 추가했는데 예상과 다른 색이 표시됩니다. 상속과 여러 스타일시트의 선언 중 어떤 값이 적용되는지 어떤 순서로 확인하나요?](/tech-interview/questions/css-cascade-specificity/)

---
id: "shadow-dom-composed-path"
title: "Shadow DOM 안에서 발생한 클릭의 target이 바뀌어 보입니다. retargeting과 composedPath로 어떤 경계를 확인하나요?"
difficulty: "중하"
category: "웹"
tags: ["DOM","이벤트","버블링","이벤트 위임","JavaScript","심화 질문"]
related: ["dom-event-delegation"]
promotedFrom: {"id":"dom-event-delegation","prompt":"Shadow DOM 경계에서 target 재지정과 composedPath를 어떻게 확인할까요?"}
---

# Shadow DOM 안에서 발생한 클릭의 target이 바뀌어 보입니다. retargeting과 composedPath로 어떤 경계를 확인하나요?

## 구두 답변

Shadow DOM은 경계 밖에서 target을 host 등으로 재지정할 수 있습니다. composedPath는 이벤트의 경로를 이해하는 데 도움되지만 closed shadow와 composed 여부의 공개 범위를 따릅니다.

이벤트가 bubble·composed인지 확인하고 외부에서 내부 구조에 과하게 의존하지 않습니다. 컴포넌트는 의미 있는 custom event와 필요한 데이터만 공개할 수 있습니다. 중첩 shadow·중복 클릭·키보드·stopPropagation을 시험해 한 사용자 동작이 한 번만 반영되는지 봅니다.

## 득점 포인트

- Shadow DOM은 경계 밖에서 target을 host 등으로 재지정할 수 있습니다. composedPath는 이벤트의 경로를 이해하는 데 도움되지만 closed shadow와 composed 여부의 공개 범위를 따릅니다.
- 중첩 shadow·중복 클릭·키보드·stopPropagation을 시험해 한 사용자 동작이 한 번만 반영되는지 봅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Shadow DOM은 경계 밖에서 target을 host 등으로 재지정할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 동적으로 추가되는 목록 항목의 클릭을 한 곳에서 처리하려면 이벤트 위임을 어떻게 적용하나요?](/tech-interview/questions/dom-event-delegation/)

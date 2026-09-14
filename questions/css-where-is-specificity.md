---
id: "css-where-is-specificity"
title: "컴포넌트 스타일을 쉽게 덮어쓸 수 있게 만들려 합니다. :where와 :is의 명시도 차이는 무엇인가요?"
difficulty: "중하"
category: "웹"
tags: ["CSS","cascade","specificity","상속","선택자","심화 질문"]
related: ["css-cascade-specificity","css-reset-normalize"]
promotedFrom: {"id":"css-cascade-specificity","prompt":"`:where()`와 `:is()`가 컴포넌트 선택자 설계에 주는 차이는 무엇일까요?"}
---

# 컴포넌트 스타일을 쉽게 덮어쓸 수 있게 만들려 합니다. :where와 :is의 명시도 차이는 무엇인가요?

## 구두 답변

:where는 인자 선택자의 명시도를 0으로 만들고 :is는 인자 목록의 명시도 규칙을 따릅니다. 공통 컴포넌트 기본 스타일을 쉽게 덮게 하려면 :where가 유용할 수 있습니다.

명시도보다 origin·importance·layer 등 앞선 cascade 조건이 먼저 적용됩니다. :is에 ID 선택자를 섞으면 다른 분기에도 예상보다 높은 명시도가 생길 수 있어 구체 예제로 계산합니다. selector가 매칭되는지와 누가 이기는지를 별도로 검사합니다.

## 득점 포인트

- :where는 인자 선택자의 명시도를 0으로 만들고 :is는 인자 목록의 명시도 규칙을 따릅니다. 공통 컴포넌트 기본 스타일을 쉽게 덮게 하려면 :where가 유용할 수 있습니다.
- selector가 매칭되는지와 누가 이기는지를 별도로 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: :where는 인자 선택자의 명시도를 0으로 만들고 :is는 인자 목록의 명시도 규칙을 따릅니다.

## 더 파고들 거리

- [기본 상황과 비교: 부모에 글자색을 지정하고 컴포넌트 스타일도 추가했는데 예상과 다른 색이 표시됩니다. 상속과 여러 스타일시트의 선언 중 어떤 값이 적용되는지 어떤 순서로 확인하나요?](/tech-interview/questions/css-cascade-specificity/)

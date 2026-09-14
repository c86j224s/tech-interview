---
id: "scoped-reset-typography-layers"
title: "컴포넌트 reset이 전역 글꼴과 링크 스타일을 덮습니다. 범위·상속·layer의 책임을 어떻게 정하나요?"
difficulty: "중하"
category: "웹"
tags: ["CSS","reset","normalize","접근성","기본 스타일","심화 질문"]
related: ["css-reset-normalize","css-cascade-specificity"]
promotedFrom: {"id":"css-reset-normalize","prompt":"컴포넌트 범위 reset과 전역 typography가 충돌하면 layer·상속을 어떻게 정할까요?"}
---

# 컴포넌트 reset이 전역 글꼴과 링크 스타일을 덮습니다. 범위·상속·layer의 책임을 어떻게 정하나요?

## 구두 답변

reset은 기본 표현을 정리하고 typography는 제품의 읽기 규칙을 제공합니다. 컴포넌트 루트 범위와 layer 순서를 정해 전역 링크·글꼴이 우연히 제거되지 않게 합니다.

상속되는 글꼴·색과 상속되지 않는 box 속성을 나누고 :where 같은 낮은 명시도 기본값을 검토합니다. native form·focus·forced colors를 유지합니다. 서로 다른 컴포넌트를 중첩한 화면에서 computed style과 키보드 동작을 확인합니다.

## 득점 포인트

- reset은 기본 표현을 정리하고 typography는 제품의 읽기 규칙을 제공합니다. 컴포넌트 루트 범위와 layer 순서를 정해 전역 링크·글꼴이 우연히 제거되지 않게 합니다.
- 서로 다른 컴포넌트를 중첩한 화면에서 computed style과 키보드 동작을 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: reset은 기본 표현을 정리하고 typography는 제품의 읽기 규칙을 제공합니다.

## 더 파고들 거리

- [기본 상황과 비교: 같은 폼과 목록이 브라우저마다 다르게 보입니다. 기본 스타일을 초기화하는 reset과 차이를 보정하는 normalize 중 무엇을 선택하고, 접근성은 어떻게 확인하나요?](/tech-interview/questions/css-reset-normalize/)

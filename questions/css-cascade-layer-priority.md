---
id: "css-cascade-layer-priority"
title: "기존 CSS에 cascade layer를 도입합니다. 일반 선언·important·레이어 밖 스타일의 우선순위는 어떻게 바뀌나요?"
difficulty: "중하"
category: "웹"
tags: ["CSS","cascade","specificity","상속","선택자","심화 질문"]
related: ["css-cascade-specificity","css-reset-normalize"]
promotedFrom: {"id":"css-cascade-specificity","prompt":"cascade layer 도입으로 기존 스타일의 승자와 유지보수 책임이 어떻게 바뀔까요?"}
---

# 기존 CSS에 cascade layer를 도입합니다. 일반 선언·important·레이어 밖 스타일의 우선순위는 어떻게 바뀌나요?

## 구두 답변

일반 선언에서는 뒤에 선언한 layer가 앞 layer보다 우선하고 layer 밖 일반 선언이 layered 선언보다 우선하는 규칙을 확인합니다. important 선언은 layer 우선순위가 반대가 되어 단순 역순 덮기와 다릅니다.

같은 origin 안에서도 importance·layer가 specificity보다 앞서므로 높은 명시도만으로 이기지 못할 수 있습니다. reset·기본·컴포넌트·override의 책임을 정하고 기존 스타일의 승자가 바뀌는 요소를 실제 computed style로 검사합니다.

## 득점 포인트

- 일반 선언에서는 뒤에 선언한 layer가 앞 layer보다 우선하고 layer 밖 일반 선언이 layered 선언보다 우선하는 규칙을 확인합니다. important 선언은 layer 우선순위가 반대가 되어 단순 역순 덮기와 다릅니다.
- reset·기본·컴포넌트·override의 책임을 정하고 기존 스타일의 승자가 바뀌는 요소를 실제 computed style로 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 일반 선언에서는 뒤에 선언한 layer가 앞 layer보다 우선하고 layer 밖 일반 선언이 layered 선언보다 우선하는 규칙을 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: 부모에 글자색을 지정하고 컴포넌트 스타일도 추가했는데 예상과 다른 색이 표시됩니다. 상속과 여러 스타일시트의 선언 중 어떤 값이 적용되는지 어떤 순서로 확인하나요?](/tech-interview/questions/css-cascade-specificity/)

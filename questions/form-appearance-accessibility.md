---
id: "form-appearance-accessibility"
title: "폼 control의 appearance를 없애고 직접 그립니다. 키보드·포커스·disabled·고대비 상태를 어떻게 보존하나요?"
difficulty: "중하"
category: "웹"
tags: ["CSS","reset","normalize","접근성","기본 스타일","심화 질문"]
related: ["css-reset-normalize","css-cascade-specificity"]
promotedFrom: {"id":"css-reset-normalize","prompt":"form control의 appearance를 바꿀 때 반드시 보존해야 할 브라우저 기능은 무엇인가요?"}
---

# 폼 control의 appearance를 없애고 직접 그립니다. 키보드·포커스·disabled·고대비 상태를 어떻게 보존하나요?

## 구두 답변

appearance 제거는 기본 표시를 바꾸는 것이지 native control의 의미·키보드 동작을 새로 구현해 준다는 뜻이 아닙니다. 가능하면 실제 input·button 요소를 유지하고 시각만 조정합니다.

focus-visible·disabled·checked·invalid·고대비 상태와 키보드 조작을 시험합니다. outline 제거 뒤 대체 포커스 표시가 없으면 접근성이 깨집니다. 브라우저별 native 표시 차이를 모두 지우는 것보다 의미와 조작을 보존하는 범위를 선택합니다.

## 득점 포인트

- appearance 제거는 기본 표시를 바꾸는 것이지 native control의 의미·키보드 동작을 새로 구현해 준다는 뜻이 아닙니다. 가능하면 실제 input·button 요소를 유지하고 시각만 조정합니다.
- 브라우저별 native 표시 차이를 모두 지우는 것보다 의미와 조작을 보존하는 범위를 선택합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: appearance 제거는 기본 표시를 바꾸는 것이지 native control의 의미·키보드 동작을 새로 구현해 준다는 뜻이 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 같은 폼과 목록이 브라우저마다 다르게 보입니다. 기본 스타일을 초기화하는 reset과 차이를 보정하는 normalize 중 무엇을 선택하고, 접근성은 어떻게 확인하나요?](/tech-interview/questions/css-reset-normalize/)

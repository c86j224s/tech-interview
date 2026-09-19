---
id: resizeobserver-loop-feedback
title: ResizeObserver callback에서 width를 매번 1px 키우면 왜 계속 실행되거나 loop error가 날 수 있나요?
difficulty: 중하
category: 웹
tags:
  - IntersectionObserver
  - ResizeObserver
  - delivery
  - layout feedback
related:
  - browser-rendering-layout
---
# ResizeObserver callback에서 width를 매번 1px 키우면 왜 계속 실행되거나 loop error가 날 수 있나요?

## 구두 답변

callback에서 `width += 1px`를 실행하면 callback이 만든 DOM write가 다음 레이아웃의 새로운 관찰 입력이 됩니다. 300px에서 시작한 작은 상태는 `layout(300) → callback(300) → write(301) → layout(301) → callback(301)`로 변하고 안정점이 없습니다. 따라서 callback이 “크기를 읽기만 한다”는 가정이 깨지고, 같은 원인이 계속 새로운 entry를 만듭니다.

Resize Observer는 한 전달 단계에서 관찰을 무한히 재귀 호출하지 않습니다. active observation을 깊이 기준으로 모아 전달하고, 조상·자식 write 때문에 이번 단계에 전달되지 않은 skipped observation이 남으면 resize loop error를 보고할 수 있습니다. 이것을 JavaScript 문법 오류나 네트워크 오류로 해석하면 안 됩니다. 정확히 언제 다음 callback과 paint가 일어나는지는 엔진 scheduling의 target 의존성이므로 콘솔 메시지만으로 특정 frame 수를 단정하지 않습니다.

해결은 `disconnect()`를 먼저 부르는 것이 아니라 write가 수렴하도록 만드는 것입니다. 폭이 500 미만이면 compact class를 켜고 그 이상이면 끄는 식으로 현재 상태와 목표 상태가 다를 때만 write합니다. 상한·최소 변화량·owner를 두고, 부모와 자식이 서로 폭을 바꾸면 하나의 owner가 크기를 결정합니다. rAF로 write를 옮기면 전달 단계와 render 작업을 분리할 수 있지만 폭이 계속 바뀌는 논리 자체는 사라지지 않습니다. target에서 entry size, callback generation, write 값을 기록해 반복 원인을 확인합니다.

## 득점 포인트

- 300→301→302 상태 trace로 callback write가 새 입력이 되는 과정을 보입니다.
- active/skipped observation과 loop error를 알고리즘 경계로 설명합니다.
- 멱등 class 전환, 상한, owner 분리와 rAF의 한계를 구분합니다.

## 감점 포인트

- ResizeObserver callback은 DOM을 변경할 수 없다고 합니다.
- `disconnect()` 한 번이면 이미 설계된 feedback의 원인도 해결된다고 말합니다.
- loop error를 네트워크 오류나 문법 오류로 분류합니다.

## 더 파고들 거리

- 부모와 자식 observer가 서로 크기를 바꿀 때 depth와 owner를 어떻게 로그로 확인할까요?
- write를 rAF로 옮겨도 값이 수렴하지 않는 경우 어떤 상한이나 모델 변경이 필요할까요?

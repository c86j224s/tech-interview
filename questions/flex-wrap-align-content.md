---
id: flex-wrap-align-content
title: wrap된 flex에서 align-items와 align-content가 각각 정하는 것은 무엇인가요?
difficulty: 중하
category: 웹
tags:
  - Flexbox
  - min-width
  - flex-shrink
  - automatic minimum
related:
  - browser-rendering-layout
---
# wrap된 flex에서 align-items와 align-content가 각각 정하는 것은 무엇인가요?

## 구두 답변

`align-items`는 각 flex line 내부 item의 cross-axis 정렬이고, `align-content`는 여러 line 묶음을 container cross-axis 안에서 배치합니다. 높이 300px container에 두 line의 cross-size 합이 160px이면 leftover는 140px입니다. `align-content:space-between`은 두 line 사이에 140px을 두고, `center`는 위·아래 70px씩 남깁니다. `align-items:center`는 각 line 안에서 높이 40px과 80px인 item의 위치를 맞출 뿐 line 사이 빈 공간은 만지지 않습니다.

`align-content`는 multi-line container에 효과가 있고 single-line에서는 line packing을 바꾸지 않습니다. `align-items:stretch`도 item의 cross-size가 auto이고 양쪽 cross margin이 auto가 아닌 등 조건을 만족해야 하며 min/max를 존중합니다. 따라서 wrap 후 카드 높이가 모두 같아지지 않는다면 line의 cross-size, item의 used cross-size, min/max를 분리해 기록합니다. `align-self`는 한 item에 대한 align-items의 예외입니다.

예를 들어 두 line이 각각 70px과 90px이고 container 높이가 300px이면 남는 140px은 line packing의 대상입니다. 첫 line 안에서 40px item을 center에 놓는 일은 70px line의 내부 정렬이고, 두 line 자체를 70px 간격으로 벌리는 일은 align-content입니다. `stretch`에서는 line cross-size가 늘어날 수 있지만 item에 고정 height나 max-height가 있으면 item이 그만큼 늘지 않습니다. 따라서 카드 높이가 다를 때 line box, item used height, max-height를 순서대로 확인해야 합니다.

## 득점 포인트

- item과 line 묶음의 소유권을 구분합니다.
- 300px, 160px, leftover 140px trace를 제시합니다.
- single-line에서 align-content가 효과 없음을 말합니다.
- stretch 조건과 min/max를 함께 확인합니다.

## 감점 포인트

- align-items가 모든 줄 사이 간격을 결정한다고 합니다.
- align-content가 single-line item의 중앙 정렬 속성이라고 설명합니다.
- stretch가 어떤 item이든 무조건 같은 높이로 만든다고 합니다.
- cross-axis line packing과 main-axis justify-content를 혼동합니다.

## 더 파고들 거리

- line cross-size가 item max-content와 stretch 조건으로 정해지는 순서를 두 줄 fixture에서 어떻게 추적하나요?
- align-self 하나가 line 크기와 주변 item 배치에 미치는 영향을 어떤 box measurement로 검증하나요?

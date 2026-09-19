---
id: grid-spanning-intrinsic-contribution
title: 두 track을 span하는 item의 intrinsic contribution을 한 열에 단순히 더하면 안 되는 이유는 무엇인가요?
difficulty: 중하
category: 웹
tags:
  - CSS Grid
  - intrinsic sizing
  - minmax
  - overflow
related:
  - css-containment-content-visibility
---
# 두 track을 span하는 item의 intrinsic contribution을 한 열에 단순히 더하면 안 되는 이유는 무엇인가요?

## 구두 답변

span item의 요구는 특정 한 열의 요구가 아니라 span 전체가 만족해야 하는 제약입니다. 두 track의 현재 base size가 120px·140px, gap이 20px이면 span 폭은 `120+20+140=280px`입니다. 제목의 최소 요구가 360px이면 부족량은 80px이지만, 이 80px을 첫 열에 더해 200px·140px으로 만드는 것은 임의의 예입니다. 첫 열이 fixed로 더 자랄 수 없거나 둘째 열의 growth limit이 남아 있을 수 있기 때문입니다.

Grid는 span 수, 각 track의 min/max sizing function, base size, growth limit, 다른 item의 기여를 track-sizing 단계에서 함께 적용합니다. 따라서 flexible track이 있다는 사실만으로 비례 분배한다고 말할 수 없고, 여러 flexible track을 span하면 automatic minimum이 적용되는 조건도 제한됩니다. 실제 분석에서는 span 범위와 gap, 각 track의 base/limit, item min-content를 기록한 뒤 한 track 고정 fixture와 `minmax(0,1fr)` fixture를 비교합니다. 80px은 부족량의 산술이지 사양이 보장하는 분배 결과가 아닙니다.

검증 시에는 먼저 span item을 제거해 두 track의 독립적인 base size를 기록하고, 같은 item을 다시 넣어 span 전체의 변화량을 비교합니다. 예를 들어 첫 track이 fixed 120px로 고정되어 있으면 80px 부족량을 그 track에 추가할 수 없고, 둘째 track의 growth limit이나 auto 단계가 남은 요구를 처리합니다. 반대로 두 track을 0 최소 flexible로 두면 nominal free-space 계산과 intrinsic minimum 단계가 달라집니다. 이 비교 없이 최종 폭만 보고 “첫 열이 제목을 먹었다”고 하면 원인과 결과를 뒤집게 됩니다.

## 득점 포인트

- span 전체 제약과 단일 열 기여를 구분합니다.
- `120+20+140=280`, 요구 360, 부족 80px을 추적합니다.
- fixed·auto·flexible, base size·growth limit이 결과를 바꾼다고 설명합니다.
- “비율로 나눈다”는 일반화를 버리고 track-sizing 단계로 판단합니다.

## 감점 포인트

- span item의 폭을 항상 시작 열의 min-content에 더합니다.
- 두 열이면 gap 없이 단순 합산한다고 설명합니다.
- flexible track이면 모든 intrinsic minimum이 자동으로 0이 된다고 합니다.
- 최종 폭만 보고 어떤 span이 track을 성장시켰는지 검증하지 않습니다.

## 더 파고들 거리

- span하는 track 중 하나가 fixed이고 다른 하나가 auto일 때 부족량이 어느 성장 단계에서 처리되는지 설명할 수 있나요?
- 여러 flexible track을 span한 item에서 automatic minimum 적용 조건을 어떻게 확인하나요?

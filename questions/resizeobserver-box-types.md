---
id: resizeobserver-box-types
title: >-
  ResizeObserver의 contentBoxSize·borderBoxSize·devicePixelContentBoxSize는 어떤 단위와
  상자를 관찰하나요?
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
# ResizeObserver의 contentBoxSize·borderBoxSize·devicePixelContentBoxSize는 어떤 단위와 상자를 관찰하나요?

## 구두 답변

`contentBoxSize`는 padding과 border를 제외한 content box를, `borderBoxSize`는 padding과 border를 포함한 border box를 논리적 `inlineSize`·`blockSize`로 나타냅니다. `devicePixelContentBoxSize`는 content box를 device pixel 기준에서 읽으려는 값입니다. 따라서 세 필드를 모두 같은 CSS width로 취급하면 padding·border 변화나 장치 해상도 변화에서 틀립니다.

구체적으로 가로 쓰기에서 content inline이 300px, padding이 양쪽 8px, border가 양쪽 1px이면 contentBox inline은 300 CSS px이고 borderBox inline은 `300 + 8+8 + 1+1 = 318` CSS px입니다. `box-sizing:border-box`는 CSS width를 계산하는 방식에 영향을 주지만, 어떤 box를 entry로 읽는지까지 content로 바꾸지는 않습니다. 세로 writing mode에서는 inline/block 축이 물리 가로/세로와 다르므로 logical 값을 유지한 채 layout 방향을 해석합니다.

DPR이 2인 이상적인 정수 layout에서 content 300 CSS px는 약 600 device px에 대응합니다. 그러나 300.25 CSS px, fractional transform, 엔진의 반올림과 해당 필드 지원 여부가 있으면 600을 모든 환경의 보장값으로 말할 수 없습니다. canvas backing store를 맞출 때는 `devicePixelContentBoxSize?.[0]`를 우선하되 미지원이면 content size×DPR을 fallback으로 사용하고, 분수·반올림 테스트를 target browser에서 합니다. 관찰 옵션, entry 배열 형태, `contentRect` fallback도 함께 확인해야 합니다.

## 득점 포인트

- content 300, padding 8, border 1에서 318이라는 중간 계산을 보여 줍니다.
- writing mode의 logical 축과 CSS/device pixel 단위를 분리합니다.
- DPR 산술을 이상적 기대값으로만 두고 지원·분수·fallback을 명시합니다.

## 감점 포인트

- borderBox가 border만 포함하고 padding은 제외한다고 말합니다.
- 세 box가 언제나 같은 CSS pixel 수를 준다고 가정합니다.
- DPR×CSS 값이 모든 엔진에서 devicePixelContentBox의 관찰값과 정확히 같다고 단정합니다.

## 더 파고들 거리

- 세로 writing mode에서 inline/block 값을 물리 축으로 매핑하는 테스트를 어떻게 만들까요?
- device pixel 필드가 없을 때 canvas backing store의 반올림 정책을 어디에서 결정할까요?

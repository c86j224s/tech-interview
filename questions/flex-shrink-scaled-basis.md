---
id: flex-shrink-scaled-basis
title: 같은 flex-shrink인데 한 item이 더 많이 줄어드는 이유는 무엇인가요?
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
# 같은 flex-shrink인데 한 item이 더 많이 줄어드는 이유는 무엇인가요?

## 구두 답변

Flex는 `flex-shrink` 숫자만 비교하지 않고 `flex-shrink × inner flex base size`인 scaled factor로 음의 free space를 배분합니다. A base 400px, B base 100px, 두 shrink가 1이고 부족량이 100px이면 factor는 400:100입니다. A가 `100×400/500=80px`, B가 `100×100/500=20px` 줄어 최종은 A=320px, B=80px입니다.

이것은 declared width의 단순 비례가 아닙니다. `flex-basis:auto`이면 width 또는 content가 basis가 되고 padding·border와 box-sizing이 outer 계산에 참여합니다. B에 `min-width:90px`가 있으면 80px 목표가 clamp되어 B=90px로 freeze되고 A가 부족분을 더 부담합니다. shrink를 2로 올려도 B가 90px 아래로 내려가지는 않습니다. 먼저 같은 flex line인지, computed basis와 used min/max가 무엇인지 기록해야 합니다.

숫자를 적용할 때는 inner flex base size를 사용해야 합니다. padding 20px이 각 item에 있고 선언 width가 content-box라면 화면에서 보이는 outer 폭과 factor에 쓰는 inner 값이 달라질 수 있습니다. 또 B가 min-width에 걸려 90px로 freeze된 뒤의 남은 부족량은 최초 80/20 비율을 그대로 재사용하지 않고, freeze되지 않은 item만 대상으로 다시 계산합니다. 이 때문에 DevTools에서 최종 width만 읽으면 분배 과정을 복원할 수 없습니다. line, basis, used min/max를 같은 시점에 기록해야 합니다.

## 득점 포인트

- scaled factor 식과 400:100, 80/20 trace를 제시합니다.
- flex-basis:auto가 content와 main-size를 참조할 수 있음을 설명합니다.
- min-width clamp 후 freeze와 재분배를 말합니다.
- shrink factor와 minimum boundary가 다른 책임임을 구분합니다.

## 감점 포인트

- shrink가 같으면 같은 픽셀만큼 줄어든다고 합니다.
- shrink 값을 키우면 모든 minimum을 무시한다고 합니다.
- 선언된 width가 항상 flex base라고 전제합니다.
- 다른 flex line의 item까지 한 pool로 계산합니다.

## 더 파고들 거리

- `flex:1`과 `flex:1 1 0`의 basis 차이가 content가 다른 두 item의 결과를 어떻게 바꾸나요?
- min violation과 max violation이 함께 있을 때 freeze 방향을 어떤 trace로 검증하나요?

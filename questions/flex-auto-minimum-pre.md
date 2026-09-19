---
id: flex-auto-minimum-pre
title: 'Flex row의 긴 pre가 flex-shrink:1인데도 넘치는 이유는 무엇인가요?'
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
# Flex row의 긴 pre가 flex-shrink:1인데도 넘치는 이유는 무엇인가요?

## 구두 답변

`flex-shrink:1`은 음의 free space를 분배할 수 있다는 뜻이지 automatic minimum을 무시한다는 뜻이 아닙니다. row가 320px이고 label basis 120px, code basis 200px이면 basis 합은 320px입니다. 그런데 code의 `pre`가 공백 없는 900px 줄을 갖고, code item의 `min-width:auto`가 non-scrollable computed overflow 조건에서 content-based minimum을 반영하면 target size가 320px 아래로 내려가지 못할 수 있습니다. 이는 shrink를 무시한 것이 아니라 min violation 뒤 경계를 적용한 결과입니다.

`.code{min-width:0}`은 item box가 줄어들 수 있게 하지만 `pre{white-space:pre}`의 줄 자체를 바꾸지 않습니다. 따라서 clientWidth는 320px이어도 scrollWidth는 900px일 수 있습니다. 원문을 보존하려면 code 영역에 `overflow:auto`, 읽기 폭을 우선하면 줄바꿈 정책을 둡니다. 부모 `overflow:hidden`만 넣는 것은 paint clipping이고 sizing 해결과 다릅니다. overflow:auto/hidden/clip의 computed value와 실제 scroll-container 여부는 target engine에서 함께 검증해야 합니다.

특히 `overflow:auto`를 넣었다고 곧바로 모든 엔진에서 같은 결과를 기대하면 안 됩니다. computed overflow 값, 실제로 scroll container가 되었는지, used automatic minimum이 얼마인지가 서로 다른 관찰 항목입니다. 작은 fixture에서 `.code`의 min-width를 auto와 0으로 바꾸고, overflow를 hidden/auto/clip으로 바꾼 뒤 computed style·clientWidth·scrollWidth·Tab focus를 함께 저장해야 합니다. box가 320px로 줄어도 900px pre를 숨겨 버리면 정보 접근성이 나빠지므로, 코드 보존이면 horizontal scrolling과 복사 동선을 설계합니다.

## 득점 포인트

- shrink 분배와 automatic minimum을 서로 다른 단계로 설명합니다.
- basis 120+200과 pre 900의 경계를 실제 상태로 추적합니다.
- min-width:0 이후에도 clientWidth와 scrollWidth가 다를 수 있음을 말합니다.
- computed overflow, scroll-container 여부, used min-width를 별도 관찰합니다.

## 감점 포인트

- shrink 1이면 어떤 content도 부모 안으로 줄어든다고 합니다.
- min-width:0만 넣으면 pre가 자동 줄바꿈한다고 주장합니다.
- overflow:hidden이면 모든 엔진에서 automatic minimum이 0이라고 단정합니다.
- declared width만 보고 flex basis와 padding·box sizing을 생략합니다.

## 더 파고들 거리

- overflow:auto가 실제 scroll container가 되는 상태와 computed overflow를 어떤 DevTools 값으로 대조하나요?
- nested flex에서 min-width:0을 어느 item 경계에 둬야 내부 code scroll이 작동하나요?

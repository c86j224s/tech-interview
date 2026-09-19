---
id: flex-overflow-clipping-vs-sizing
title: '부모 overflow:hidden과 child min-width:0은 flex overflow에서 어떤 계약 차이가 있나요?'
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
# 부모 overflow:hidden과 child min-width:0은 flex overflow에서 어떤 계약 차이가 있나요?

## 구두 답변

부모 `overflow:hidden`은 paint clipping이고 child `min-width:0`은 flex item의 main-axis sizing 경계를 낮추는 선언입니다. row가 400px이고 child의 콘텐츠 최소가 700px이라고 하겠습니다. 부모 clipping만 적용하면 child box가 700px에 가깝게 남은 채 300px이 잘릴 수 있습니다. focus ring, dropdown, shadow, 텍스트 선택도 잘릴 위험이 있습니다. child에 `min-width:0`을 주면 flex 계산이 400px 안의 box를 선택할 수 있고, 내부 code 영역의 `overflow:auto`가 그 box를 scrollport로 사용합니다.

따라서 카드 폭을 맞추고 코드는 보존해야 하는 경우 child에 min-width:0, code에 overflow:auto를 둡니다. 부모 clipping은 장식 마스크처럼 의도적으로 잘라야 할 때 사용합니다. 다만 automatic minimum 조건은 computed overflow와 실제 scroll-container 성립을 구분하므로 overflow:hidden이 모든 엔진에서 항상 min-width를 0으로 만든다고 말하지 않습니다. box width와 scrollWidth를 각각 기록해 sizing과 content overflow를 분리합니다.

이 차이는 nested flex에서 더 분명합니다. 바깥 item에 min-width:0을 주지 않으면 안쪽 code 영역에 overflow:auto를 줘도 바깥 item의 automatic minimum이 전체 폭을 밀어낼 수 있습니다. 반대로 모든 조상에 hidden을 걸면 popup이나 focus ring을 잘라 버리면서 문제를 감춥니다. 바깥 item의 실제 width, 안쪽 scrollport의 clientWidth, pre의 scrollWidth를 단계별로 측정하고, keyboard focus가 scrollport로 이동할 수 있는지도 확인합니다. clipping은 마지막 표시 선택이지 sizing 대체재가 아닙니다.

## 득점 포인트

- clipping은 보이는 영역, min-width는 실제 layout box라는 차이를 설명합니다.
- 700px child와 400px parent에서 잘림과 축소의 서로 다른 결과를 제시합니다.
- focus ring·dropdown·shadow 부작용을 sizing 선택 비용으로 말합니다.
- nested flex와 내부 code scroll의 책임 경계를 제시합니다.

## 감점 포인트

- 두 선언이 같은 효과라고 합니다.
- 부모 overflow만으로 child automatic minimum이 언제나 없어졌다고 합니다.
- min-width:0이 모든 내부 텍스트를 자동 줄바꿈한다고 주장합니다.
- 보이는 overflow가 사라진 것만 보고 focus와 keyboard scroll을 통과 처리합니다.

## 더 파고들 거리

- overflow:hidden/clip/auto의 scroll-container 및 focus 이동 차이를 목표 브라우저에서 어떤 값으로 비교하나요?
- nested flex의 각 경계에 min-width:0을 적용해야 하는 이유는 무엇인가요?

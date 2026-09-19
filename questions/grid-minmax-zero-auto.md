---
id: grid-minmax-zero-auto
title: 'minmax(auto,1fr)의 긴 URL이 overflow되는 이유와 minmax(0,1fr)의 의미는 무엇인가요?'
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
# minmax(auto,1fr)의 긴 URL이 overflow되는 이유와 minmax(0,1fr)의 의미는 무엇인가요?

## 구두 답변

`1fr`을 무조건 0부터 줄어드는 단위로 보면 안 됩니다. Grid의 flexible track은 남은 공간을 나누지만, auto 최소와 item의 intrinsic contribution을 먼저 고려합니다. content width가 600px이고 gap이 16px이면 두 track에 분배할 폭은 `600-16=584px`입니다. 첫 item의 최소 기여가 180px, 공백 없는 URL의 min-content 기여가 520px이면 합이 700px이라 116px이 부족합니다. `minmax(auto,1fr)`에서는 URL track이 520px 아래로 내려가지 않아 grid 자체가 716px을 요구할 수 있습니다.

`minmax(0,1fr)`은 track의 최소 함수만 0으로 명시합니다. 따라서 layout target은 `584/2=292px`씩 계산될 수 있지만, URL이 `white-space:nowrap`이거나 분할 불가능하면 `clientWidth=292`, `scrollWidth=520`인 content overflow가 남습니다. 그래서 track에는 `minmax(0,1fr)`, item에는 필요에 따라 `min-width:0`, URL에는 `overflow-wrap:anywhere`나 `overflow:auto`를 별도로 선택합니다. clipping은 정보 보존이 아니므로 코드·복사 가능한 URL이면 스크롤을 우선 검토합니다.

추가로 `min-width:0`의 위치를 잘못 잡으면 원인이 남습니다. Grid item 자체가 flex container라면 바깥 grid item의 최소 경계를 낮춘 뒤 내부 flex item에도 같은 경계가 필요할 수 있습니다. 반대로 URL을 잘라서는 안 되는 화면에서 `anywhere`를 공통 적용하면 도메인이나 경로가 읽기 어려워지므로, 복사 가능한 별도 code block과 가로 스크롤을 제공하는 편이 낫습니다. 측정할 때는 track의 `getBoundingClientRect().width`와 URL 요소의 `clientWidth/scrollWidth`를 따로 기록해 “열이 넓어진 것”과 “열 안에서 내용이 넘친 것”을 구별합니다.

## 득점 포인트

- `600-16=584`, 최소 합 `180+520=700`, 부족량 116px의 중간 상태를 계산합니다.
- auto 최소와 0 최소를 track sizing 경계의 차이로 설명합니다.
- 0 하한이 URL의 줄바꿈이나 scroll 정책까지 결정하지 않는다고 구분합니다.
- `min-width:0`, `overflow-wrap`, `overflow:auto`, `overflow:hidden`의 책임을 나누어 말합니다.

## 감점 포인트

- `1fr`은 항상 0에서 시작하므로 긴 URL도 자동으로 줄어든다고 합니다.
- `minmax(0,1fr)`만 쓰면 `pre`나 URL이 자동으로 줄바꿈된다고 주장합니다.
- 부모 `overflow:hidden`이 item의 intrinsic minimum을 언제나 제거한다고 단정합니다.
- Grid의 `fr` 분배를 Flex의 scaled shrink factor와 같은 알고리즘이라고 설명합니다.

## 더 파고들 거리

- 두 track을 span하는 제목의 80px 부족량이 왜 첫 열에 단순히 더해지지 않는지 track sizing 단계로 설명할 수 있나요?
- natural width 1600px 이미지를 290px track 안에서 비율 보존과 잘림 정책으로 분리하려면 어떤 속성을 조합하나요?

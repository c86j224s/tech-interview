---
id: grid-min-max-content
title: min-content와 max-content track은 긴 텍스트의 줄바꿈과 폭을 어떻게 다르게 만드나요?
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
# min-content와 max-content track은 긴 텍스트의 줄바꿈과 폭을 어떻게 다르게 만드나요?

## 구두 답변

`min-content`는 허용된 줄바꿈을 최대한 적용했을 때의 최소 intrinsic 폭이고, `max-content`는 줄바꿈하지 않고 한 줄에 놓는 선호 폭입니다. 세 단어의 측정 폭이 80·120·60px이고 공백에서 줄바꿈할 수 있다고 가정하면 설명용으로 max-content는 공백을 포함한 약 280px, min-content는 가장 긴 단어인 약 120px입니다. `grid-template-columns:min-content 1fr`에서는 첫 track이 약 120px로 접히고 둘째 track이 남은 공간을 받지만, `max-content 1fr`에서는 첫 열이 280px을 요구해 옆 열을 압박합니다.

이 숫자는 글꼴과 실제 분할 규칙을 고정한 산술이지 모든 브라우저의 측정값이 아닙니다. 공백 없는 URL이나 긴 코드 토큰은 min-content도 커질 수 있고, `overflow-wrap:anywhere`는 가능한 break point 자체를 늘립니다. 또한 `width:min-content`는 item의 used width를 정하는 선언이고, `grid-template-columns:min-content`는 track의 sizing function입니다. DevTools에서 track width만 보지 말고 줄 수, `scrollWidth`, `white-space`, wrap 규칙을 함께 확인해야 합니다.

실무에서 `min-content`의 하한은 콘텐츠에 줄바꿈 기회가 있다는 전제에서만 작동합니다. 예를 들어 하이픈이 없는 500px 토큰 하나가 있으면 다른 단어가 120px이어도 min-content는 500px 쪽으로 올라갑니다. 반대로 `overflow-wrap:anywhere`를 적용하면 가능한 break point가 늘어 intrinsic 계산과 실제 행 높이가 함께 달라집니다. 그러므로 track 함수만 바꾼 뒤 “줄바꿈이 해결됐다”고 판정하지 말고, 동일한 font와 writing mode에서 line count와 scrollWidth를 비교해야 합니다.

## 득점 포인트

- min-content를 문자열 길이가 아닌 줄바꿈 가능한 intrinsic 하한으로 설명합니다.
- max-content가 한 줄 선호 폭이며 긴 토큰에서는 min-content도 커질 수 있음을 말합니다.
- 80·120·60과 약 280/120px 계산을 설명용으로 한정합니다.
- item의 `width:min-content`와 track 함수의 차이를 구분합니다.

## 감점 포인트

- min-content는 항상 0이거나 max-content는 항상 viewport 폭이라고 합니다.
- `overflow-wrap:anywhere`가 모든 엔진에서 track 폭과 표시 결과를 동일하게 만든다고 단정합니다.
- max-content를 쓰면 긴 제목이 옆 열을 절대 밀지 않는다고 말합니다.
- computed track 폭만 보고 실제 줄바꿈과 콘텐츠 overflow를 생략합니다.

## 더 파고들 거리

- `minmax(auto,1fr)`에서 auto 최소와 `minmax(0,1fr)`의 차이를 URL의 min-content trace로 설명할 수 있나요?
- writing mode와 font metrics가 intrinsic 폭 숫자를 바꿀 때 fixture를 어떤 축으로 고정해야 하나요?

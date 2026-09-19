---
id: grid-image-intrinsic-ratio
title: intrinsic width가 큰 이미지를 Grid에 넣을 때 track을 넓히지 않고 비율을 보존하려면 무엇을 정하나요?
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
# intrinsic width가 큰 이미지를 Grid에 넣을 때 track을 넓히지 않고 비율을 보존하려면 무엇을 정하나요?

## 구두 답변

track sizing과 이미지의 used size를 따로 정합니다. 600px content width, gap 20px의 두 열이면 각 track은 `(600-20)/2=290px`입니다. `minmax(0,1fr)`은 track이 natural width 때문에 커지는 경계를 낮추는 선택이고, 이미지에는 `display:block;width:100%;height:auto;max-width:100%`를 두어 grid area 폭을 used width로 사용하게 합니다. 1600px natural width, 16:9 ratio라면 설명용 높이는 `290×9/16=163.125px`, 약 163px입니다.

`minmax(0,1fr)`만으로 이미지가 자동 축소되거나 비율이 보존되는 것은 아닙니다. `width:auto`는 natural size와 size suggestion이 intrinsic 계산에 참여할 수 있고, `max-width:100%`는 폭의 상한이지 높이·잘림 정책이 아닙니다. 고정 box를 채우려면 `aspect-ratio`와 `object-fit:cover/contain`을 별도로 선택합니다. cover는 일부를 자르고 contain은 빈 여백을 허용합니다. width/height 속성은 로딩 전 공간 예약에 도움을 주지만 loaded 이후 모든 sizing 조건을 없애지는 않습니다.

여기서 `height:auto`는 이미지의 intrinsic ratio를 이용하는 것이고 `object-fit`은 이미 정해진 content box 안에서 이미지를 배치하는 규칙입니다. 둘은 대체 관계가 아닙니다. 290px 폭에서 원본 16:9의 자연 높이를 보존하려면 약 163px이지만, 카드 box를 120px로 고정하고 `cover`를 택하면 163px 중 일부가 잘립니다. 정보 이미지라면 `contain`과 대체 텍스트가 더 적절하고, 장식 썸네일이면 cover의 crop 기준을 명시합니다. 로딩 전 width/height와 로딩 후 rendered ratio도 별도 측정합니다.

## 득점 포인트

- 600px·gap 20px·290px track·16:9 약 163px trace를 제시합니다.
- track 최소와 replaced element의 used size를 별도 층으로 설명합니다.
- `width:100%`, `height:auto`, `max-width:100%`의 역할을 구분합니다.
- `cover/contain`, 공간 예약, 정보 손실을 별도 정책으로 말합니다.

## 감점 포인트

- `minmax(0,1fr)`만 쓰면 natural width와 ratio가 모두 자동 해결된다고 합니다.
- `height:100%`를 쓰면 어떤 이미지에서도 비율이 보존된다고 설명합니다.
- `overflow:hidden`을 이미지 크기 조절과 같은 계약으로 취급합니다.
- loading 전 layout shift와 loaded 이후 overflow를 하나의 원인으로 합칩니다.

## 더 파고들 거리

- 반대 축의 definite size가 transferred size suggestion으로 intrinsic minimum에 참여하는 경우를 어떻게 분리해 재현하나요?
- HTML width/height와 CSS aspect-ratio가 예약 높이와 실제 used size에 미치는 차이를 어떤 fixture로 확인하나요?

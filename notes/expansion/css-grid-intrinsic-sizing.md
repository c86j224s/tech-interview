---
id: css-grid-intrinsic-sizing
title: CSS Grid의 intrinsic sizing과 minmax
topic: 웹
summary: min-content·max-content 기여와 minmax·overflow 상호작용을 추적합니다.
questionIds: []
prerequisites:
  - rendering-layout
  - css-cascade
related:
  - rendering-layout
reviewedAt: '2026-09-19'
---
# CSS Grid의 intrinsic sizing과 minmax

CSS Grid의 `fr`은 남은 공간을 나누는 단위이지만, 그 단계에 도달하기 전에 track의 base size와 item의 intrinsic contribution이 하한을 만들 수 있습니다. 그래서 `grid-template-columns: 1fr 1fr`이 600px 컨테이너 안에서 항상 292px씩(폭 600px, gap 16px) 줄어든다고 말하면 긴 URL, `pre`, 자연 폭이 큰 이미지에서 틀립니다. 먼저 inline 축의 컨테이너 폭과 gap을 확정하고, 각 track의 min/max sizing function, item의 min-content·max-content 기여, spanning 여부를 분리해 기록해야 합니다. 이 글은 CSS Grid Layout Module의 읽을 수 있는 편집자 초안에서 intrinsic track sizing, `minmax()`, flexible track, spanning item 규칙을 대조한 설명입니다. 특정 엔진의 최신 동작을 보증하는 측정 결과는 아닙니다.

## 문제 경계와 용어

Intrinsic size는 “문자 수 × 고정 픽셀”이 아니라 글꼴, writing mode, 줄바꿈 기회, 지정된 크기와 replaced element의 비율을 반영한 크기 제안입니다. `min-content`는 허용된 줄바꿈을 최대한 사용한 뒤 남는 최소 폭에 가깝고, `max-content`는 줄바꿈하지 않은 선호 폭에 가깝습니다. 단어 사이에 공백이 있으면 min-content는 가장 긴 분할 불가능 조각으로 내려갈 수 있지만, 공백 없는 URL은 URL 전체가 분할 불가능 조각이 되어 하한을 크게 만들 수 있습니다. `overflow-wrap:anywhere` 같은 콘텐츠 정책은 분할 기회를 바꾸므로 sizing과 paint를 한 문제로 뭉치지 않습니다.

Track sizing에서 item은 하나 이상의 track에 기여합니다. 단일 열 item은 그 열의 base size를 올릴 수 있지만, 두 열을 span하는 item의 요구 폭은 span 전체 제약입니다. 두 track 사이 gap도 span 폭에 포함됩니다. item의 `min-width:0`은 grid item의 자동 최소 경계를 낮추는 데 도움을 주지만, track을 `minmax(0,1fr)`로 만들지 않으면 track의 최소 함수가 여전히 콘텐츠를 반영할 수 있고, 반대로 track만 0으로 만들어도 자식 텍스트가 한 줄이면 paint가 넘칠 수 있습니다.

## Track 함수와 하한

`minmax(min, max)`는 하나의 track에 최소와 최대 sizing function을 줍니다. 최소가 최대보다 크면 최대가 최소로 올려지므로 `minmax(240px,120px)`는 120px track이 되지 않습니다. `1fr`은 flexible max를 뜻하고, bare `1fr`은 Grid 문맥에서 auto 최소를 가진 flexible track으로 이해해야 합니다. 따라서 긴 URL이 있는 `minmax(auto,1fr)`는 콘텐츠 기반 최소에서 멈출 수 있습니다. `minmax(0,1fr)`는 track의 최소를 명시적으로 0으로 두어, free space가 부족해도 track box 자체를 줄일 수 있게 합니다.

다만 0 하한은 정보 표현 정책이 아닙니다. item 내부에서 `white-space:nowrap`이나 `pre`가 유지되면 box가 292px로 줄어도 `scrollWidth`는 520px 이상일 수 있습니다. 읽을 수 있는 URL은 `overflow-wrap:anywhere` 또는 `word-break` 계열을 검토하고, 코드와 로그는 `overflow:auto`로 원문을 보존하며 가로 이동을 제공하는 쪽이 더 정직할 수 있습니다. `overflow:hidden`은 잘라서 보이는 영역을 제한하지만 복사·검색·포커스 링을 보존하지 않습니다.

## 계산 추적

```diagram
{"title":"Grid intrinsic sizing 경로","caption":"콘텐츠 기여가 track 경계를 거쳐 flexible 공간 분배에 들어가는 순서입니다.","rows":[[{"id":"content","label":"콘텐츠","detail":["URL · 이미지 · 텍스트"]}],[{"id":"intrinsic","label":"intrinsic 기여","detail":["min-content · max-content"]}],[{"id":"track","label":"track 경계","detail":["minmax · base · limit"]}],[{"id":"flex","label":"flex 분배","detail":["남은 공간 · fr"]}]],"edges":[{"from":"content","to":"intrinsic","label":"측정"},{"from":"intrinsic","to":"track","label":"최소 기여"},{"from":"track","to":"flex","label":"경계 후 분배"}]}
```

설명용 상태로 content box 600px, gap 16px, track 두 개를 두겠습니다. 분배 대상은 `600 - 16 = 584px`입니다. 첫 카드의 최소 기여가 180px, 공백 없는 URL의 min-content 기여가 520px이면 최소 기여 합은 `180 + 520 = 700px`이고 부족량은 `700 - 584 = 116px`입니다. 이 상태에서 auto 최소를 그대로 쓰면 두 track을 단순히 `584 / 2 = 292px`로 정할 수 없습니다. URL track이 520px을 고수하면 첫 track에 남는 폭은 `584 - 520 = 64px`이고, 첫 카드의 180px 하한까지 유지하려면 필요한 전체 폭은 `180 + 16 + 520 = 716px`입니다. 600px 컨테이너에 대해 116px overflow가 생기는 이유가 드러납니다.

이제 두 track을 `minmax(0,1fr)`로 바꾸면 track box 계산의 최소 합은 0이므로 nominal target은 `584 / 2 = 292px`입니다. 그러나 URL의 inline content는 자동으로 분할되지 않습니다. `scrollWidth=520`, `clientWidth=292`라는 관찰이 가능하고, 이때 layout은 컨테이너 안에 있지만 content는 overflow인 상태입니다. `min-width:0`을 item에도 적용하면 item 자체의 자동 최소 경계가 track을 다시 밀어 올리는 경로를 줄입니다. 마지막으로 콘텐츠 정책을 `overflow-wrap:anywhere`로 정하면 URL이 여러 줄로 나뉘어 scrollWidth가 줄지만 행 높이와 읽기 순서가 바뀝니다. 이 세 단계는 각각 다른 비용을 지닙니다.

## Intrinsic 기여 비교

폭 320px의 grid에서 단어 폭을 80px, 120px, 60px로 측정하고 공백에서 줄바꿈할 수 있다고 가정하면, max-content는 단어와 공백을 한 줄에 놓는 대략 280px이고 min-content는 가장 긴 단어인 약 120px입니다. 실제 공백 폭과 글꼴 metrics는 엔진마다 다르므로 이 숫자는 설명용 산술입니다. `grid-template-columns:min-content 1fr`는 첫 track을 약 120px로 잡고 남은 폭을 둘째 track에 넘기는 의도이고, `max-content 1fr`는 첫 track이 약 280px을 요구해 둘째 track의 여유를 압박하는 의도입니다.

`width:min-content`와 `grid-template-columns:min-content`는 같은 속성이 아닙니다. 전자는 특정 item의 used width를 제한하고, 후자는 track sizing function을 정합니다. `minmax(min(12rem,100%),1fr)`처럼 viewport와 콘텐츠 하한을 함께 제한하면 긴 제목이 전체 문서 폭을 밀어내는 위험을 줄일 수 있습니다. 그렇지만 `min()`의 100% 기준과 writing mode를 포함한 실제 축을 확인해야 합니다.

## Spanning item 알고리즘

두 track의 현재 base size가 각각 120px과 140px이고 gap이 20px이면 span 폭은 `120+20+140=280px`입니다. 제목의 span 최소 요구가 360px이면 부족량은 80px입니다. 이 80px을 첫 열에만 더해 200px·140px로 만드는 것은 단지 가능한 한 시나리오일 뿐 사양의 일반 공식이 아닙니다. 첫 track이 120px fixed로 고정되어 있거나 둘째 track의 growth limit이 이미 찼다면 다른 경로가 필요합니다. 반대로 두 track의 min/max 함수가 다르면 성장 단계가 달라집니다.

Grid track-sizing은 span 수, track의 min track sizing function, base size와 growth limit, 이미 처리된 item의 기여를 적용해 부족분을 조정합니다. 여러 flexible track을 span하는 경우 item automatic minimum의 적용 조건도 제한되므로 “flexible이면 자동 최소가 0” 또는 “flexible이 있으면 자동 최소가 적용”이라고 단정할 수 없습니다. 실무 trace에는 span 범위, gap, 각 track의 현재 base/limit, item의 min-content 기여를 별도 열로 적어야 합니다.

## Replaced element와 비율

1600px natural width, 16:9 ratio의 이미지를 600px grid와 gap 20px의 두 열에 넣으면 nominal track width는 `(600-20)/2=290px`입니다. `img{width:auto;height:auto}`만 두면 natural size와 size suggestion이 intrinsic 계산에 참여할 수 있습니다. `width:100%;height:auto;max-width:100%`는 used width를 grid area에 맞추고, 높이를 ratio로 계산하는 표시 계약입니다. 16:9라면 설명용 높이는 `290×9/16=163.125px`, 즉 약 163px입니다. 이 계산은 로컬 브라우저에서 측정한 값이 아니라 주어진 ratio에 대한 산술입니다.

`aspect-ratio` 또는 HTML `width`·`height`는 이미지가 도착하기 전 예약할 box를 만들어 layout shift를 줄일 수 있지만, 실제 natural metadata와 CSS min/max 규칙을 무효화하지는 않습니다. `object-fit:contain`은 전체 이미지를 보존하면서 빈 여백을 만들 수 있고, `cover`는 box를 채우면서 가장자리를 자를 수 있습니다. 따라서 “비율 보존”과 “잘림 허용”을 별도 제품 결정으로 기록합니다. 반대 축에 definite size가 있을 때 transferred size suggestion이 최소 계산에 참여할 수 있으므로 replaced element와 일반 div의 규칙을 동일시하지 않습니다.

## 구현·검증 절차

첫째, `getBoundingClientRect().width`가 아니라 padding·border·scrollbar를 제외한 grid content width와 gap을 확인합니다. 둘째, 각 item의 computed `min-width`, `overflow-wrap`, `white-space`, `scrollWidth/clientWidth`를 기록합니다. 셋째, fixture를 일반 문장, 공백 없는 URL, 1600px 이미지, 두 열 span 제목으로 나누고 `1fr`, `minmax(auto,1fr)`, `minmax(0,1fr)`를 한 번에 하나씩 교체합니다. 네째, 320·600·1024px 폭에서 track width, 줄 수, 이미지 height를 비교합니다. 브라우저를 실행하지 않은 이 노트의 수치는 설명용 trace이며 측정 성공으로 포장하지 않습니다.

실패 판정도 층을 나눕니다. track width가 예상보다 크면 auto 최소 또는 spanning contribution을 의심하고, track은 좁지만 `scrollWidth`가 크면 콘텐츠 분할/스크롤 정책을 의심합니다. 이미지가 box 안에 있으나 높이가 갑자기 변하면 intrinsic metadata와 aspect-ratio 예약을 의심합니다. `content-visibility`나 containment를 추가하는 경우 계산되지 않은 subtree의 예상 크기가 intrinsic contribution에 미치는 영향은 별도의 target-browser fixture로 확인해야 합니다.

## 비용과 참고 범위

Intrinsic sizing은 콘텐츠를 읽어 min/max 기여를 산출하므로 큰 표와 긴 문서에서 계산 비용이 커질 수 있습니다. 명시적인 최소 하한은 폭 결정을 예측하기 쉽게 하지만, 너무 작게 만들면 줄바꿈·스크롤·잘림 중 하나를 반드시 선택해야 합니다. `minmax(0,1fr)`를 공통 reset처럼 적용하면 코드·URL의 정보 보존 요구를 놓칠 수 있습니다. 반대로 auto 최소를 모든 카드에 맡기면 한 토큰이 전체 layout을 밀어낼 수 있습니다.

참고 자료는 CSS Grid Layout Module 편집자 초안(https://drafts.csswg.org/css-grid/)의 intrinsic track sizing, `minmax()`, flexible track, spanning item 및 replaced element 관련 본문과 CSS Sizing/Box 모델 문맥입니다. 2026-09-19에 문서 본문을 읽어 주장 범위를 대조했지만, 이 URL의 이후 편집 변경과 특정 브라우저 버전의 결과는 별도 검증 대상입니다. 기존 rendering-layout 노트와의 경계는 렌더링 pipeline이 아니라 그 이전 track 폭 결정과 콘텐츠 하한입니다.

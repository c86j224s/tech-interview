---
id: css-flex-minimum-size
title: CSS Flexbox의 자동 최소 크기와 shrink
topic: 웹
summary: 'Flex item automatic minimum size와 flex-shrink, min-width:0의 차이를 설명합니다.'
questionIds: []
prerequisites:
  - rendering-layout
  - css-cascade
related:
  - css-grid-intrinsic-sizing
  - rendering-layout
reviewedAt: '2026-09-19'
---
# CSS Flexbox의 자동 최소 크기와 shrink

Flexbox에서 `flex-shrink:1`은 음의 free space를 분배할 수 있다는 뜻이지 item을 어떤 폭까지든 강제로 압축한다는 뜻이 아닙니다. Flex line마다 flex base size와 hypothetical main size를 계산하고, basis 합과 container inner main size의 차이를 구한 뒤, shrink factor에 basis를 곱한 scaled factor로 분배합니다. 그 결과가 min/max 경계를 위반하면 일부 item을 freeze하고 남은 item으로 다시 계산합니다. 기본 `min-width:auto`의 automatic minimum이 콘텐츠에서 올라오면 shrink 결과가 그 하한 아래로 내려가지 못해 긴 `pre`가 부모 밖으로 보일 수 있습니다.

## Flex sizing 단계

`flex` shorthand의 초기값은 `0 1 auto`입니다. `flex-basis`는 양의/음의 free space 분배 전 기준이 되고 `flex-shrink`는 음의 공간에서만 쓰입니다. `flex-basis:auto`는 main-size 속성을 참조하고 그것도 auto이면 콘텐츠 기반 기준을 만들 수 있습니다. `flex:1 1 0`은 basis를 0으로 시작한다는 의도를 명확하게 하지만 min-width와 padding, border가 최종 폭을 다시 바꿀 수 있습니다.

진단표에는 선언된 width가 아니라 computed `flex-basis`, inner flex base size, hypothetical main size, used min/max, flex line 소속을 각각 적습니다. 서로 다른 line의 item은 같은 shrink pool에 들어가지 않습니다. box-sizing에 따라 padding과 border가 outer free space에 참여하는 방식도 달라지므로 “width 두 개의 합”만으로 overflow 원인을 결정하지 않습니다.

## 자동 최소 크기 조건

Flexbox Level 1의 automatic minimum size 규칙은 main-axis `min-width:auto` 또는 `min-height:auto`에 대해 computed overflow와 scroll-container 조건을 구분합니다. 현재 CSS Flexbox 본문은 computed overflow가 non-scrollable인 경우 content-based minimum size를 사용할 수 있고, item이 scroll container인 경우 automatic minimum을 0으로 두는 경로를 설명합니다. 여기서 “실제로 내용이 넘쳤다”와 “computed overflow 값이 무엇이다”는 같은 질문이 아닙니다. `overflow:auto`처럼 내용에 따라 scroll container가 되는 속성은 목표 엔진에서 computed overflow, 실제 scroll container 여부, used min-width를 모두 확인해야 합니다.

replaced element인지 여부에 따라 content size suggestion과 transferred size suggestion을 조합하는 규칙도 달라집니다. 긴 `pre`를 만났을 때는 `min-width:auto`가 언제 content-based minimum을 올리는지, 그 후 text 자체가 줄바꿈하는지를 분리합니다. `overflow:hidden`이 특정 엔진에서 automatic minimum 경로에 영향을 줄 수 있어도, 이를 “항상 0”이라고 일반화하면 안 됩니다. 이 노트는 target engine 측정을 하지 않았으므로 해당 값은 사양 조건으로만 서술합니다.

## Shrink 숫자 추적

```diagram
{"title":"Flex shrink freeze 경로","caption":"basis에서 음의 공간을 계산하고 scaled factor와 최소 경계를 적용하는 순서입니다.","rows":[[{"id":"basis","label":"basis","detail":["A 300 · B 200 · C 100"]}],[{"id":"negative","label":"음의 공간","detail":["container 500 · 부족 100"]}],[{"id":"scaled","label":"scaled factor","detail":["shrink × basis"]}],[{"id":"freeze","label":"freeze","detail":["B 최소 180"]}],[{"id":"target","label":"최종 폭","detail":["A 240 · B 180 · C 80"]}]],"edges":[{"from":"basis","to":"negative","label":"합산"},{"from":"negative","to":"scaled","label":"부족 분배"},{"from":"scaled","to":"freeze","label":"min violation"},{"from":"freeze","to":"target","label":"재계산"}]}
```

컨테이너 inner main size를 500px, gap과 margin을 0, base를 A=300, B=200, C=100px로 둡니다. 합은 600px이므로 negative free space는 -100px입니다. shrink가 모두 1이면 scaled factor는 300, 200, 100이고 총 600입니다. 첫 목표는 A=`300-100×300/600=250`, B=`200-100×200/600=166.67`, C=`100-100×100/600=83.33`입니다.

B에 `min-width:180px`가 있으면 166.67px은 min violation이므로 B의 target은 180px로 clamp됩니다. B가 고정되면 다음 라운드에서 남는 main size는 `500-180=320px`이고 A:C의 factor 300:100을 적용합니다. A=240px, C=80px가 되어 최종 합은 `240+180+80=500px`입니다. 이 trace는 브라우저를 실행해 얻은 측정이 아니라 알고리즘을 고정 숫자로 푼 설명용 계산입니다. 실제 outer size에는 padding, border, scrollbar, min/max와 line breaking이 추가됩니다.

## 긴 pre와 이중 overflow

row 폭이 320px, label basis 120px, code basis 200px이라고 하겠습니다. basis 합만 보면 정확히 320px이지만 `.code` 안 `pre`의 공백 없는 줄이 900px이고 code item의 automatic minimum이 그 contribution을 반영하면 hypothetical/target size가 320px 밖으로 올라갈 수 있습니다. 이때 “shrink가 무시됐다”가 아니라 min violation 뒤 경계가 적용된 것입니다.

`.code{min-width:0}`은 item box가 320px 안에서 줄어들 가능성을 열어 줍니다. 하지만 `pre{white-space:pre}`는 긴 줄을 유지하므로 clientWidth=320, scrollWidth=900 같은 별도 content overflow가 남습니다. 코드를 보존하려면 `overflow:auto`를 code 영역에 두고 키보드 가로 이동을 제공하며, 읽기 우선이면 적절한 줄바꿈과 복사 정책을 정합니다. 부모에 `overflow:hidden`만 넣으면 paint clipping이 생길 뿐 item box가 실제로 줄었다고 보장하지 않습니다.

## Sizing과 clipping 경계

부모 `overflow:hidden`은 부모 padding box 밖의 paint를 자르는 계약입니다. 자식이 700px box를 유지한 채 400px 부모에서 잘릴 수 있고, focus ring·dropdown·shadow·선택 영역도 같이 잘릴 수 있습니다. child `min-width:0`은 Flex item의 main-axis minimum sizing function을 바꾸어 400px 안의 실제 box를 선택할 수 있게 합니다. 내부 코드 영역에 `overflow:auto`를 두면 scroll container가 child box를 기준으로 만들어집니다.

세 선언은 목적이 다릅니다. layout 상자를 부모에 맞추려면 item 경계를 먼저 고치고, 긴 내용의 보존은 내부 스크롤 또는 줄바꿈으로 해결하며, 장식 마스크만 부모 clipping에 맡깁니다. `overflow:clip`, `hidden`, `auto`는 scroll container와 keyboard scroll 가능성에서 차이가 있으므로 target browser에서 `getComputedStyle`, clientWidth, scrollWidth, focus 이동을 함께 기록합니다.

## Scaled shrink와 freeze

A=400px, B=100px, shrink가 모두 1이고 부족량이 100px이면 scaled factor는 400:100입니다. A가 80px, B가 20px을 부담해 A=320, B=80px이 됩니다. 이것이 “같은 shrink인데 큰 item이 더 많이 줄어드는” 이유입니다. B에 min-width=90px을 추가하면 B의 80px 목표가 min violation이 되어 90px로 고정되고 A가 남은 부족량을 더 부담합니다. B의 shrink를 2로 바꿔도 90px보다 더 작아지지 않습니다.

반대로 A에 `flex-shrink:0`을 두면 A는 negative free space pool에서 사실상 inflexible 상태가 됩니다. B가 최소에 걸리면 container overflow가 남을 수 있습니다. 따라서 먼저 한 line인지, basis가 content인지, min/max가 무엇인지 확인한 뒤 factor를 조절합니다. factor를 키우는 것은 최소 경계를 무시하는 명령이 아닙니다.

## Wrap과 cross-axis 정렬

`flex-wrap:wrap`은 main-axis 폭이 부족할 때 여러 flex line을 만듭니다. `align-items`는 각 line 내부에서 item을 cross axis로 배치하는 기본값이고 `align-self`가 개별 item에서 이를 덮어씁니다. auto cross-size, 양쪽 margin, min/max 조건을 충족하면 `stretch`가 line의 cross-size에 맞춰 늘릴 수 있습니다. item 높이가 다를 때 `align-items:center`를 쓰면 각 line 안에서만 중앙 정렬됩니다.

`align-content`는 여러 line 묶음을 container의 cross axis 안에서 배치합니다. 높이 300px, 두 line cross-size 합 160px이면 leftover는 140px입니다. `space-between`은 두 line 사이에 140px을 두고, `center`는 위·아래 70px씩 둡니다. `stretch`는 line cross-size를 늘리는 방향이지만 item이 무조건 같은 높이가 되는 것은 아닙니다. single-line flex container에는 line packing을 위한 `align-content` 효과가 없습니다.

## 구현·검증 절차

fixture에는 긴 `pre`, URL, 이미지, nested flex를 넣고 320·500·800px에서 다음 값을 기록합니다.

```js
const el = document.querySelector('.code');
console.table({
  minWidth: getComputedStyle(el).minWidth,
  overflow: getComputedStyle(el).overflow,
  flexBasis: getComputedStyle(el).flexBasis,
  flexShrink: getComputedStyle(el).flexShrink,
  clientWidth: el.clientWidth,
  scrollWidth: el.scrollWidth
});
```

실제 실행하지 않은 값은 측정값으로 부르지 않습니다. `min-width:auto/0`, 부모 clipping, child scroll을 각각 바꿔 box width와 scrollWidth를 비교합니다. box가 안 줄면 automatic minimum/sizing 문제이고, box는 줄었지만 scrollWidth가 크면 content overflow 문제입니다. 높이와 line 간 빈 공간이 다르면 cross-axis alignment 문제입니다. 한 선언으로 세 실패를 모두 해결한다고 문서화하지 않습니다.

## 비용과 참고 범위

content-based minimum은 큰 콘텐츠의 intrinsic size를 읽어야 하므로 unbounded table, `pre`, nested flex에서 계산과 reflow 비용을 키울 수 있습니다. `min-width:0`은 계산 경계를 단순하게 만들지만 정보 보존 정책을 대신하지 않습니다. 가로 스크롤은 코드를 보존하지만 모바일 탐색 비용이 있고, anywhere 줄바꿈은 읽기 폭을 줄이는 대신 줄 수와 높이를 늘립니다. 부모 clipping은 구현이 쉬워도 키보드 focus ring과 팝업을 자를 수 있습니다.

참고 자료는 CSS Flexible Box Layout Module Level 1(https://www.w3.org/TR/css-flexbox-1/)의 automatic minimum size, flex shorthand, flexible lengths, `align-items`, `align-content` 본문입니다. 2026-09-19에 해당 본문을 읽어 조건과 숫자 trace를 대조했습니다. W3C TR 규칙을 특정 브라우저의 모든 버전 결과로 확장하지 않았으며, overflow:auto/hidden/clip과 native scrollbar는 목표 엔진에서 별도 fixture 검증이 필요합니다.

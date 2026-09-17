---
id: rendering-layout
title: 레이아웃 계산과 화면 이동
topic: 웹
summary: DOM 쓰기와 기하 읽기의 교차를 분리하고 containment·content-visibility·이미지 공간 예약이 바꾸는 비용을 설명합니다.
questionIds: [browser-rendering-layout, css-containment-content-visibility, web-layout-shift-reserved-space]
---

# 레이아웃 계산과 화면 이동

## 스타일 변경 직후 기하 읽기와 강제 동기 레이아웃

목록 원소마다 width를 바꾸고 곧바로 `offsetWidth`를 읽는 루프가 있다고 합시다. 브라우저는 보통 변경을 모아 계산하려 하지만, 최신 크기를 반환하려면 앞선 변경을 반영하는 레이아웃을 즉시 수행해야 할 수 있습니다. 이를 수백 번 반복하면 같은 영역을 계속 다시 계산합니다.

**강제 동기 레이아웃**은 변경 뒤 기하 정보가 필요한 순간 계산을 앞당기는 것이고, 이런 읽기·쓰기 교차 반복이 레이아웃 스래싱을 만듭니다. 모든 크기 읽기가 항상 비싼 것은 아니며 무효화된 상태와 호출 순서를 확인해야 합니다.

## 스타일 계산·Layout·Paint·합성 단계

```diagram
{"title":"스타일에서 실제 화면까지","caption":"화살표는 개념적 렌더링 단계입니다. 변경 종류·의존 범위·브라우저 최적화에 따라 일부 단계를 재사용할 수 있으며 모든 변경이 전체 파이프라인을 다시 실행하지는 않습니다.","rows":[[{"id":"style","label":"스타일 계산","detail":["DOM · CSS 규칙"]}],[{"id":"layout","label":"Layout","detail":["상자 위치·크기"]}],[{"id":"paint","label":"Paint","detail":["그릴 명령·픽셀 준비"]}],[{"id":"composite","label":"합성","detail":["레이어 조합·표시"]}]],"edges":[{"from":"style","to":"layout","label":"기하 조건"},{"from":"layout","to":"paint","label":"그릴 영역"},{"from":"paint","to":"composite","label":"화면 조합"}]}
```

DOM 노드가 모두 레이아웃 상자가 되는 것은 아닙니다. `display:none`은 렌더링에서 제외됩니다. 색 변경은 paint만 필요할 수 있고 크기·폰트 변경은 주변 배치까지 바꿀 수 있습니다. transform·opacity는 합성으로 처리될 가능성이 높지만 항상 비용이 없거나 별도 레이어가 보장되는 것은 아닙니다.

## DOM 읽기·쓰기 배치와 의미 보존

```text
# 반복적인 동기 계산을 만들 수 있는 형태
for item in items:
    item.style.width = newWidth
    save(item.offsetWidth)

# 변경 전 크기가 필요한 경우
oldWidths = read_all_current_widths(items)
write_all_new_widths(items)

# 변경 후 크기가 필요한 경우
write_all_new_widths(items)
newWidths = read_all_current_widths(items)
```

변경 전 값을 읽는 것과 변경 후 값을 읽는 것은 다른 결과입니다. 성능 개선이라며 원래 요구한 시점을 바꾸면 안 됩니다. 후자의 경우 첫 기하 읽기에서 계산이 필요할 수 있지만 변경과 읽기를 번갈아 강제하는 횟수를 줄일 수 있습니다.

`scroll`·`resize` 이벤트는 한 프레임에 여러 번 올 수 있으므로, 각 이벤트에서 할 일을 다음 화면 갱신 시점에 맞춰 실행하는 `requestAnimationFrame`(rAF) 콜백으로 모을 수 있습니다. 다만 rAF 안에서 다시 쓰기·읽기를 번갈아 하면 같은 강제 레이아웃을 만들 수 있어, 측정과 변경을 각각 묶는 순서를 지켜야 합니다. 서로 다른 컴포넌트가 각자 측정하고 변경하면 컴포넌트 사이의 실행 순서도 조정해야 합니다.

## Containment·content-visibility의 영향 범위

`contain`은 레이아웃·크기·페인트 등의 영향을 제한하는 계약입니다. 예를 들어 size containment는 자식 내용으로 부모 크기를 결정하는 의미를 바꿀 수 있습니다. 아무 요소에나 붙이면 자동 높이·위치 기준·겹침의 기대가 달라질 수 있습니다.

긴 목록에서 `content-visibility:auto`를 쓰면 현재 화면과 관련성이 낮은 하위 영역의 렌더링 작업을 건너뛰도록 도울 수 있습니다. 그렇다고 DOM·데이터·이벤트·JavaScript 비용까지 모두 없어지는 것은 아닙니다. 브라우저가 아직 계산하지 않은 영역에는 `contain-intrinsic-size`로 예상 크기를 주어 스크롤 자리를 예약할 수 있지만, 그 값이 실제 크기와 다르면 화면에 나타날 때 이동이 남습니다.

| 방법 | 줄이는 비용 | 추가 확인 |
| --- | --- | --- |
| 읽기·쓰기 배치 | 반복 강제 레이아웃 | 측정 시점의 의미 |
| containment | 영향 범위 | 크기·배치·paint 경계 |
| content-visibility | 화면 밖 렌더 작업 | 공간 예약·검색·포커스 |
| 가상 목록 | 실제 DOM 수 | 항목 재사용·접근성·스크롤 복원 |

접근성 트리와 페이지 내 검색·포커스 탐색은 실제 브라우저에서 확인합니다. `auto`와 `hidden`, `display:none`을 같은 숨김으로 취급하지 않습니다.

## 지연 이미지·폰트의 공간 예약과 레이아웃 이동

이미지의 비율·크기를 모르면 처음에 작은 공간을 만들었다가 로딩 뒤 주변 콘텐츠를 밀 수 있습니다. width·height 또는 반응형 aspect-ratio로 자리를 예약하고 실제 부모 폭에 맞춰 표시합니다. 광고·비동기 카드도 같은 문제입니다.

폰트가 바뀌면 글자 폭과 줄바꿈이 달라져 이동할 수 있습니다. 적절한 fallback과 font metric 조정·로딩 정책을 비교합니다. 폰트를 기다리느라 콘텐츠 자체를 오래 숨기면 이동을 줄이는 대신 첫 표시가 나빠질 수 있습니다.

CLS는 예상하지 못한 레이아웃 이동의 사용자 영향을 측정하는 지표이며 모든 위치 변화가 동일하게 집계되는 것은 아닙니다. 단순히 이동 횟수만 세지 말고 브라우저의 layout-shift 근거와 실제 움직인 영역을 확인합니다.

## 사용자 입력 지연과 메모리 비용의 동시 계측

Performance 기록에서 스타일·Layout·Paint·합성과 긴 JavaScript 작업을 분리합니다. 모든 요소에 `will-change`를 붙이면 레이어·GPU 메모리가 늘어 오히려 느려질 수 있습니다. 미리 지정할 대상과 유지 시간을 제한합니다.

대량 목록 변경과 느린 이미지·폰트를 넣고, 확대·모바일·키보드 탐색에서 같은 사용자 흐름을 끝까지 수행합니다. 그 기록에서 평균 프레임만 보지 말고 입력 지연과 메모리도 함께 측정합니다. 화면이 덜 움직였다는 결과와 더 빨리 반응했다는 결과는 다를 수 있으므로, 두 결과를 같은 사용자 흐름에서 함께 기록하고 비교합니다.

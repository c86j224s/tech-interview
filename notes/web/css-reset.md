---
id: css-reset
title: 기본 스타일 정리와 폼 접근성 보존
topic: 웹
summary: reset·normalize의 범위를 구분하고 레이어·상속·native control·포커스·강제 색상에서 유지할 동작을 설명합니다.
questionIds: [css-reset-normalize, form-appearance-accessibility, scoped-reset-typography-layers]
---

# 기본 스타일 정리와 폼 접근성 보존

## 똑같이 보이게 만드는 것과 쓸 수 있게 만드는 것은 다릅니다

브라우저마다 제목 여백과 폼 모양이 달라 디자인을 맞추려고 모든 margin·padding·outline을 지웠다고 합시다. 화면은 단순해졌지만 키보드 사용자는 현재 포커스를 볼 수 없고, 제목과 목록의 시각적 구분도 사라질 수 있습니다.

**Reset**은 선택한 기본 표현을 제거하고 제품이 다시 정하도록 하는 접근이고, **normalize**는 유용한 기본값을 남기면서 차이를 보정하는 접근입니다. 어느 쪽도 접근성을 자동 보장하지 않습니다. 무엇을 제거하고 무엇을 복원할지 범위를 정해야 합니다.

## 페이지 성격에 맞는 소유권을 나눕니다

기사·학습 문서처럼 HTML 기본 표현을 활용하는 화면과, 완전한 디자인 시스템이 폼·타이포그래피를 소유하는 앱은 필요한 초기화 범위가 다릅니다. 지원하지 않는 오래된 브라우저 보정까지 통째로 복사하지 말고 실제 목표 환경의 차이를 확인합니다.

```diagram
{"title":"기본값에서 상태 표현까지의 책임","caption":"화살표는 작성자 스타일의 설계 순서입니다. reset이 의미와 조작을 대체하지 않으며, 각 단계에서 지운 시각적 단서를 다음 단계가 명시적으로 보완해야 합니다.","rows":[[{"id":"reset","label":"작은 reset·보정","detail":["불필요한 기본 차이만 제거"]}],[{"id":"base","label":"문서 기본 표현","detail":["제목 · 목록 · 링크 · 글꼴"]}],[{"id":"components","label":"컴포넌트 스타일","detail":["폼 크기 · 배치 · 테마"]}],[{"id":"states","label":"상태와 접근성","detail":["focus · disabled · 오류"]}]],"edges":[{"from":"reset","to":"base","label":"기본 의미 보완"},{"from":"base","to":"components","label":"범위 확장"},{"from":"components","to":"states","label":"조작 검증"}]}
```

## 레이어와 낮은 명시도로 기본값을 둡니다

```css
@layer reset, base, components;
@layer reset {
  :where(*, *::before, *::after) { box-sizing: border-box; }
  :where(body) { margin: 0; }
}
@layer base {
  :where(button, input, select, textarea) { font: inherit; }
  :where(:focus-visible) { outline: 2px solid currentColor; outline-offset: 3px; }
}
```

이 코드는 완성된 universal reset이 아니라 범위를 작게 정하는 예입니다. box-sizing은 상속되는 속성이 아니므로 필요한 요소와 가상 요소에 직접 적용합니다. font는 폼이 주변 문서 글꼴을 따르게 하지만 색·테두리·상태까지 자동 맞추지는 않습니다.

컴포넌트에 `all:unset`을 넓게 적용하면 링크·버튼의 크기·표시 등 기대값까지 제거할 수 있습니다. 전역 typography를 상속할 항목과 독립적으로 정할 box 속성을 나누고, 중첩 컴포넌트가 서로의 기본값을 지우지 않게 범위와 레이어를 지정합니다.

## appearance를 없애도 control의 책임은 남습니다

실제 `checkbox input`을 유지한 채 CSS `appearance`로 기본 모양을 바꾸는 경우와 `div`를 checkbox처럼 그리는 경우는 결과가 다릅니다. native 요소에는 포커스·키보드·`checked`·`disabled`·폼 제출·라벨 연결이 있지만, `div`에는 이런 의미와 동작이 자동으로 생기지 않습니다. 따라서 시각을 직접 그리더라도 실제 입력이 가진 의미와 각 상태를 사용자에게 드러내야 합니다.

| 상태 | 반드시 확인할 것 |
| --- | --- |
| focus-visible | 테마 배경에서도 현재 위치가 보임 |
| checked·selected | 색뿐 아니라 형태·기호로 구분 가능 |
| disabled | 실제 조작 차단과 상태 전달, 단순 흐린 색만 아님 |
| invalid | 오류 메시지와 필드의 연결 |
| forced colors | 배경 이미지·색이 바뀌어도 경계·선택 상태 유지 |

outline을 지우려면 동등하게 식별 가능한 대체 포커스가 있어야 합니다. 브라우저의 validation이나 select·date picker 같은 기본 동작을 바꿀 때는 의도한 기능을 실제 기기에서 확인해야 합니다. 모든 플랫폼의 모양을 픽셀 단위로 같게 만드는 것보다 조작을 보존하는 것이 우선입니다.

## 목록·숨김·링크의 의미를 검사합니다

불릿을 제거하면 일부 브라우저·보조 기술 조합에서 목록 인식에 영향을 줄 수 있습니다. list-style:none이면 언제나 의미가 사라진다고 단정하지 않지만 실제 접근성 트리와 읽기 순서를 확인해야 합니다. 단순 메뉴 디자인 때문에 문서 전체 목록의 단서를 제거하지 않습니다.

`display:none`은 레이아웃과 접근성 노출에서 제외하는 용도로 쓰일 수 있고, 화면에서만 숨기는 유틸리티는 다른 계약입니다. 보이지 않는 focusable 요소가 키보드에 남거나, 중요한 오류가 스크린 리더에도 숨겨지지 않도록 검사합니다. 링크는 색만으로 구분하기보다 밑줄 등 비색상 단서도 고려합니다.

## 변경 검증은 실제 사용 흐름으로 합니다

제목·문단·목록·폼이 한 페이지에 있는 같은 화면을 reset 전후로 열어, 기본 여백·구분과 폼 상태가 어떻게 달라졌는지 먼저 비교합니다. 그 다음 마우스 없이 입력·선택·제출·오류 수정을 끝까지 수행하고, 확대·작은 화면·다크 모드·강제 색상에서 focus·disabled·invalid 같은 상태가 계속 보이는지 확인합니다. 스크린 리더에서는 이름·역할·상태를 듣고 목록·제목 탐색 순서도 별도로 따라갑니다.

normalize를 채택했다고 이 검사를 생략하지 않습니다. 스타일 제거 목록과 제품이 다시 제공할 기본 표현을 함께 문서화하면, 나중에 컴포넌트를 추가할 때 잃어버린 상태를 반복해서 복구하는 비용을 줄일 수 있습니다.

---
id: accessible-modal-focus-restoration
title: 접근 가능한 모달의 포커스 복원
topic: 웹
summary: '모달의 포커스 진입·트랩, inert 배경, Escape와 호출자 복원을 하나의 계약으로 묶습니다.'
questionIds: []
prerequisites:
  - client-foundations
  - event-delegation
related:
  - css-reset
  - event-delegation
  - view-lifecycle
reviewedAt: '2026-09-19'
---
# 접근 가능한 모달의 포커스 복원

`z-index`를 올리고 어두운 overlay를 그리는 것만으로는 modal dialog가 되지 않습니다. 사용자는 열기 전 호출자에 포커스가 있고, 열리는 순간 dialog 안에서 맥락을 읽거나 안전한 행동을 선택하며, 열린 동안 배경을 Tab·포인터·보조기술 탐색의 대상으로 사용하지 않아야 합니다. 닫힐 때는 호출자가 여전히 유효하면 그 위치로, 행 삭제처럼 호출자가 사라졌다면 현재 작업을 이어갈 수 있는 다른 위치로 이동해야 합니다. Escape도 문서 전역 boolean이 아니라 활성 layer의 소유권으로 한 단계만 닫아야 합니다.

## 상태와 소유권

모달 수명을 `closed → opening → open → closing → closed`로 기록하면 순서가 분명해집니다. `closed`에서는 호출자가 문서의 focus owner입니다. `opening`에서 dialog DOM, accessible name, description, background root, 초기 focus 후보를 준비합니다. `open`에서는 dialog focus scope와 background inert, top-layer Escape handler가 활성입니다. `closing`에서는 확정된 결과로 DOM이 변했는지 확인하고 return target을 다시 계산한 뒤 상호작용을 복구합니다.

최소 record는 `invoker`, `dialog`, `backgroundRoot`, `returnPolicy`, `layerOwner`입니다. `invoker`는 단순 selector가 아니라 열 때의 실제 Element 참조와 필요하면 행 ID/세대를 함께 가져야 합니다. `returnPolicy`는 “항상 invoker”가 아니라 connected·focusable·visible·not disabled·not inert를 통과하면 invoker, 아니면 제품 흐름의 fallback이라는 함수입니다. `layerOwner`는 nested popover/modal stack에서 가장 위 layer 하나만 close transition을 시작하게 합니다.

## 초기 포커스 정책

삭제 확인처럼 되돌리기 어려운 작업은 안전한 취소를 첫 포커스로 두는 것이 실수 비용을 낮춥니다. 긴 설명이나 구조화된 경고는 heading 또는 도입 문단에 `tabindex=-1`을 주고 제목부터 읽게 하는 편이 낫습니다. 단순 알림이나 반복 작업은 가장 가능성 높은 control을 고려할 수 있지만, 제품이 실수 방지보다 처리량을 우선한다는 정책 근거가 필요합니다. 모든 dialog를 첫 번째 버튼이나 삭제 버튼으로 시작하면 내용의 위험도와 맥락을 무시하게 됩니다.

초기 focus는 dialog 안의 keyboard reachable 요소여야 합니다. close button을 항상 제공하고, 첫 후보가 disabled가 되거나 validation 상태로 제거될 때 heading/close button/dialog container 순으로 fallback을 둡니다. `aria-modal=true`와 accessible name은 보조기술에 의미를 전달하지만 실제 Tab containment, Escape, background 차단을 자동으로 구현하지 않습니다.

## inert와 시각적 차단

WHATWG HTML의 inert는 적용 요소와 flat-tree descendants에 대해 포커스, pointer hit testing, selection/editing, 접근성 노출을 억제하는 상호작용 경계를 설명합니다. 이는 `opacity:.4`, `z-index:-1`, overlay 색상과 다릅니다. 시각적으로 뒤에 있어도 배경 버튼이 DOM 순서에 남아 있으면 Tab이 도달할 수 있습니다. `backgroundRoot`는 modal 자체를 포함하지 않도록 분리해야 합니다. modal을 inert 조상 안에 넣으면 focus를 옮기려는 구현과 충돌합니다.

inert가 프로그램이 만든 모든 이벤트가 절대 dispatch되지 않는다는 뜻은 아닙니다. 문서 전역 keydown listener가 삭제나 페이지 이동을 실행할 수 있으므로 이벤트 owner와 도메인 command를 별도 검증해야 합니다. overlay click-to-close를 제공하면 composed path로 content 내부 클릭을 제외하고, 현재 top layer만 close하도록 합니다. pointer 차단과 focus containment는 별도의 검사입니다.

## 포커스 scope와 Tab 순환

```diagram
{"title":"Modal focus 수명","caption":"호출자에서 dialog로 진입하고 layer 소유자에 따라 대체 위치로 복원합니다.","rows":[[{"id":"invoker","label":"호출자","detail":["열기 전 activeElement"]}],[{"id":"dialog","label":"dialog","detail":["이름 · 초기 focus"]}],[{"id":"scope","label":"focus scope","detail":["Tab · Shift+Tab"]}],[{"id":"owner","label":"layer owner","detail":["Escape · close"]}],[{"id":"return","label":"복원 위치","detail":["invoker 또는 fallback"]}]],"edges":[{"from":"invoker","to":"dialog","label":"open"},{"from":"dialog","to":"scope","label":"contain"},{"from":"scope","to":"owner","label":"dismiss"},{"from":"owner","to":"return","label":"restore"}]}
```

dialog 안 focusable 후보가 cancel과 delete 두 개라면 Tab은 `cancel → delete → cancel`, Shift+Tab은 역순이어야 합니다. 후보를 open 시점에 한 번만 저장하면 disabled 전환, validation 메시지, 동적 버튼 추가 뒤 stale record가 됩니다. keydown 때 다시 계산하거나 MutationObserver와 state transition에서 갱신합니다. Shadow DOM에서는 `document.activeElement`가 host로 보일 수 있으므로 관련 shadow root의 activeElement도 확인합니다.

```js
function trapTab(dialog, event) {
  if (event.key !== 'Tab') return;
  const candidates = [...dialog.querySelectorAll(
    'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
  )].filter((el) => el.getClientRects().length > 0 && !el.inert);
  if (!candidates.length) return;
  const first = candidates[0], last = candidates.at(-1);
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
}
```

이 코드는 설명용이며 이 환경에서 실행하지 않았습니다. 실제 구현은 dialog 밖으로 focus가 빠진 경우, shadow boundary, browser-native control, zoom, 모바일 viewport를 포함해 검증해야 합니다. `focus()` 호출 성공 여부는 반환값이 아니라 `document.activeElement` 또는 shadow root activeElement로 확인해야 합니다.

## Escape와 중첩 레이어

활성 stack을 `popover-A → modal-B → tooltip-C`로 두었다고 하겠습니다. Escape가 오면 C가 독립 tooltip이면 C만 닫고 이벤트를 소비합니다. C가 modal 설명의 일부로 분류된 layer라면 B가 소비합니다. B를 닫는 경우에도 A와 배경의 inert 상태를 유지하고 B의 호출자 위치로만 복원해야 합니다. 한 전역 listener에서 모든 `open=false`를 호출하면 한 번의 Escape가 A·B·C를 모두 닫고 focus 복원이 서로 덮어써집니다.

각 layer record에 id, parent, modal 여부, focus scope, onEscape 정책, close transition을 둡니다. `stopPropagation()`만으로는 이미 실행된 다른 listener나 framework effect를 취소하지 못하므로, 실제 close owner를 한 곳에서 기록합니다. overlay 바깥 클릭도 같은 stack 규칙을 쓰고, UI의 `data-id`는 서버 권한을 대체하지 않도록 삭제·결제 명령에서 도메인 검사를 다시 합니다.

## 호출자 삭제와 복원

목록의 5번째 행 삭제 버튼이 dialog를 열고, 확정 시 행 전체가 제거되는 경우를 추적해 보겠습니다. 저장한 `invoker` 참조는 JavaScript 객체로 남아도 `isConnected=false`입니다. `disabled=false`와 visibility만 확인해도 일반 `div`나 현재 focus를 거부하는 control을 통과시킬 수 있으므로 실제 focusability 정책을 별도로 확인해야 합니다. 목표에 `focus()`한 뒤 `document.activeElement===target` 또는 적절한 shadow activeElement인지 확인해야 합니다.

invoker가 실패하면 현재 목록의 이전 행 삭제 버튼, 다음 행의 첫 control, 목록 heading, 빈 목록의 “새 항목 추가”처럼 ongoing task를 이어가는 fallback을 정합니다. 이전/다음 행을 selector로 찾을 때는 삭제 후 DOM 세대와 stable ID를 확인하고, 비동기 서버 응답으로 행이 복원되면 오래된 modal generation이 새 focus를 덮어쓰지 않게 합니다. fallback도 connected·focusable·not disabled·not inert를 통과하는지 닫기 직전에 재검사합니다.

## 닫기 순서와 경쟁 상태

수동 overlay에서는 dialog close와 background inert 해제, fallback 선택, focus를 같은 JavaScript task에서 원자적으로 처리하거나, 목표 focus가 확정될 때까지 배경을 inert로 유지해야 합니다. `dialog close → inert 해제 → fallback 재검증 → focus()`는 가능한 정책이지만 framework effect나 animation 경계를 사이에 넣으면 그 틈에 배경 focus가 허용될 수 있습니다. 따라서 시각적 fade-out 종료와 상호작용 복구를 같은 시점으로 묶지 않습니다.

native `<dialog>`의 `showModal()`·`close()`는 브라우저가 top-layer와 focus를 일부 관리할 수 있으므로 수동 overlay와 동일한 복원 효과라고 가정하지 않습니다. 목표 브라우저에서 close 직후 activeElement, inert 상태, 호출자 제거 상태를 기록합니다. 수동 구현은 자체 state machine이 모든 순서를 소유해야 합니다. 이 노트는 native dialog와 수동 코드의 실행 검증을 수행하지 않았습니다.

## 검증 fixture와 실패 경계

fixture에는 호출자 버튼 세 개, heading·description·cancel·delete, 배경 링크와 input, 중첩 popover를 둡니다. 열기 뒤 activeElement가 정책 대상인지, Tab/Shift+Tab이 dialog 밖으로 빠지지 않는지, inert 전후 배경의 focus·pointer·selection 상태가 다른지 확인합니다. Escape는 최상위 한 layer만 닫히고 A/B 상태가 남는지 확인합니다. 삭제 확정으로 행과 invoker를 제거한 뒤 fallback이 연결된 실제 focusable인지, 비동기 복원 후 이전 modal generation이 잘못 focus를 훔치지 않는지도 기록합니다.

실패는 네 가지로 분류합니다. 첫째, 시각적 겹침만 있고 background interaction이 남는 차단 실패입니다. 둘째, dialog 밖으로 focus가 빠지는 scope 실패입니다. 셋째, 제거된/disabled 호출자로 복원하려는 target 실패입니다. 넷째, layer owner가 여러 번 close를 시작하는 상태 경쟁입니다. `aria-modal` 한 속성이나 overlay 색상 하나로 네 문제를 해결했다고 기록하지 않습니다.

## 비용과 참고 범위

매 keydown마다 전체 dialog subtree를 query하면 큰 dialog에서 비용이 생깁니다. 활성화 시 목록을 만들고 mutation·disabled state에서 갱신하면 비용을 줄일 수 있지만 stale 후보가 남지 않게 해야 합니다. inert는 배경 경계를 명확하게 하지만 focus restoration, accessible name, close transition을 자동으로 보장하지 않습니다. native dialog를 쓰면 브라우저가 제공하는 동작과 앱의 fallback 정책 경계를 문서화해야 합니다.

참고 자료는 WHATWG HTML interaction의 inert 정의(https://html.spec.whatwg.org/multipage/interaction.html#the-inert-attribute)와 WAI-ARIA APG dialog-modal 패턴(https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)입니다. 2026-09-19에 관련 본문과 안내를 읽어 inert의 flat-tree·focus 효과, APG의 초기 focus·containment·Escape·return focus 지침을 대조했습니다. APG는 구현 정책의 참고이며 모든 browser/framework의 자동 동작을 뜻하지 않습니다. native `<dialog>`, Shadow DOM, screen reader, 모바일 동작은 목표 환경에서 별도 검증해야 합니다.

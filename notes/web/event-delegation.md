---
id: event-delegation
title: DOM 이벤트 위임의 대상과 전파 경계
topic: 웹
summary: 내부 span 클릭에서 시작해 target·currentTarget·범위 검사·capture·bubble·Shadow DOM과 키보드 동작을 분리합니다.
questionIds: [dom-event-delegation, capture-versus-bubble-delegation, shadow-dom-composed-path]
---

# DOM 이벤트 위임의 대상과 전파 경계

DOM 이벤트 위임은 여러 자식에 동일한 리스너를 붙이는 대신 공통 조상에서 이벤트 경로를 보고 의미 있는 자식을 찾는 방식입니다. 따라서 핵심은 리스너 수를 줄이는 데 있지 않고, 실제 클릭 대상과 리스너 대상, 소유 범위, 기본 동작, 캡슐화 경계를 정확히 구분하는 데 있습니다.

## event.target과 의도한 버튼의 불일치

목록 항목마다 이벤트 리스너를 붙이는 대신 공통 목록에 하나를 붙일 수 있습니다. 나중에 추가한 버튼의 click도 그 조상으로 올라오므로 별도 등록 없이 처리합니다. 이것이 **이벤트 위임**입니다.

하지만 버튼 안 span을 누르면 `event.target`은 span일 수 있고, `event.currentTarget`은 리스너를 붙인 목록입니다. target이 곧 의도한 작업 버튼이라고 가정하면 내부 마크업이 바뀔 때 동작이 깨집니다.

버튼 내부의 span을 클릭하면 경로는 `span → button → list`가 되지만 target은 span, currentTarget은 list입니다. 위임 코드는 이 경로에서 의미 있는 button을 복원해야 하고, DOM 변경으로 아이콘이 추가되어도 동일 action을 실행해야 합니다. 이 모델을 알면 target을 button으로 캐스팅하는 코드를 피할 수 있습니다.

## closest 대상 탐색과 소유 범위 확인

```js
const list = document.querySelector('#items');
list.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  if (!button || !list.contains(button)) return;
  if (button.closest('[data-list-root]') !== list) return;
  if (button.disabled) return;
  performAction(button.dataset.action, button.dataset.id);
});
```

이 코드는 목록이 존재하고 `data-list-root`를 가진 `Element`이며 DOM 준비 뒤 실행된다는 전제입니다. 클릭한 노드가 `Element`인지 확인한 뒤 가장 가까운 `button[data-action]`을 찾고, 그 버튼이 현재 목록 안에 있으며 가장 가까운 목록 루트도 현재 `list`인지 차례로 확인합니다. `contains`만으로는 바깥에 있는 버튼을 제외할 수 있어도 중첩 위젯을 구분하지 못하므로, 마지막 비교가 하위 목록의 동작을 상위 목록이 다시 처리하지 않게 합니다.

DOM의 data-id는 서버 인가 근거가 아닙니다. 사용자가 바꿀 수 있는 입력이므로 실제 작업 API는 대상과 권한을 다시 검사합니다. UI 위임의 범위 검사가 보안 인가를 대신하지 않습니다.

```diagram
{"title":"대상과 리스너가 붙은 요소는 다릅니다","caption":"화살표는 click의 버블 경로입니다. 리스너의 currentTarget은 목록이고 실제 target은 안쪽 span일 수 있으므로 closest로 버튼을 찾습니다.","rows":[[{"id":"span","label":"span · target"}],[{"id":"button","label":"button[data-action]"}],[{"id":"list","label":"목록 · currentTarget","detail":["위임 리스너 하나"]}]],"edges":[{"from":"span","to":"button","label":"버블"},{"from":"button","to":"list","label":"버블"}]}
```

중첩 목록에서 안쪽 버튼을 누르는 trace에서는 closest가 button을 찾더라도 가장 가까운 `data-list-root`가 바깥 list와 다르므로 바깥 handler가 반환해야 합니다. `data-id`가 올바르게 읽혀도 서버는 권한을 다시 검사해야 하며, 범위 검사는 UI의 dispatch 책임과 보안 인가를 분리합니다.

## 이벤트 전파와 기본 동작의 분리

| API·속성 | 역할 | 바꾸지 않는 것 |
| --- | --- | --- |
| stopPropagation | 이후 경로로 전파 중단 | 같은 요소의 다른 리스너 모두를 자동 중단하지 않음 |
| stopImmediatePropagation | 같은 요소의 뒤 리스너까지 중단 | 이미 실행한 효과 취소 |
| preventDefault | 취소 가능한 기본 동작 취소 | 이벤트 전파 자체 |
| bubbles | 조상 버블 여부 | Shadow 경계 통과 여부와 동일하지 않음 |
| composed | Shadow 경계 통과 가능 여부 | 모든 내부 노드 공개 보장 |

링크 이동을 막으려면 cancelable 여부와 passive 리스너 계약을 확인해야 합니다. 이벤트 전파를 멈췄다고 브라우저 기본 동작이 모두 취소되는 것은 아닙니다. 여러 경로가 같은 작업을 실행하지 않도록 한 사용자 행동의 실행 책임도 정합니다.

링크 click에서 `stopPropagation()`만 호출하면 조상 handler는 멈출 수 있지만 브라우저의 기본 이동은 계속될 수 있습니다. 반대로 `preventDefault()`는 이동을 막아도 다른 조상 listener까지 멈추지 않습니다. 한 사용자 행동이 navigation과 action을 동시에 실행하지 않아야 한다면 cancelable·passive·전파 정책을 함께 설계합니다.

## 비버블 이벤트와 capture 경로

캡처 단계는 조상에서 대상 방향으로, 버블 단계는 대상에서 조상 방향으로 진행합니다. 모든 이벤트가 버블하지는 않습니다. focus를 조상에서 관찰하려면 capture를 사용하거나 버블하는 focusin 같은 대응 이벤트를 검토할 수 있습니다.

capture 리스너는 자식보다 앞에서 관찰할 수 있지만 모든 전파 중단과 캡슐화 경계를 무시하는 만능 방식이 아닙니다. 이벤트별 실제 브라우저 계약과 프레임워크의 위임 구현도 확인해야 합니다. 등록·해제의 함수 정체성 및 옵션을 유지하고, 컴포넌트 종료 때 리스너를 정리합니다.

focus를 조상에서 관찰하려고 bubble listener만 두면 이벤트가 올라오지 않아 handler가 호출되지 않을 수 있습니다. capture를 선택하거나 focusin을 사용하되, 자식의 전파 중단·Shadow 경계·프레임워크 synthetic event가 실제 경로를 어떻게 바꾸는지 브라우저 계약과 함께 확인합니다.

## Shadow DOM 경계와 target 재지정

Shadow DOM처럼 내부 DOM을 캡슐화하는 경계에서는 컴포넌트 내부 버튼을 눌러도 바깥의 `event.target`이 내부 버튼이 아니라 host로 재지정되어 보일 수 있습니다. `composedPath()`로 공개된 전파 경로를 살필 수 있지만, `closed shadow`의 내부가 무조건 노출되는 것은 아닙니다. `bubbles=true`도 이벤트가 반드시 Shadow 경계 밖으로 나간다는 뜻은 아닙니다.

외부 코드가 내부 span·button 구조를 억지로 탐색하기보다 컴포넌트가 `item-activate` 같은 의미 있는 custom event를 필요한 공개 데이터와 함께 내보내는 편이 결합을 줄일 수 있습니다. 그 이벤트가 밖으로 전달되어야 한다면 bubbles·composed를 의도에 맞게 설정합니다. 이벤트 데이터도 검증되지 않은 외부 입력으로 취급합니다.

shadow 내부 button 클릭에서 바깥 target이 host로 보이면 내부 구조를 closest로 찾는 전략이 실패할 수 있습니다. 공개 계약으로 custom event를 내보내고 필요할 때만 bubbles·composed를 켜는 방식이 구조 결합을 줄입니다. closed shadow 내부가 composedPath에 모두 노출된다고 가정하지 않습니다.

## 키보드 활성화와 동적 변경 시험

실제 button·link를 사용하면 키보드 활성화의 기본 의미를 활용할 수 있습니다. div에 click만 붙이면 포커스·Enter·Space·disabled 등이 자동 생기지 않습니다. pointerdown과 click을 둘 다 같은 실행 함수에 연결해 한 번의 조작이 두 번 실행되지 않도록 합니다.

새 항목을 추가·삭제하고 내부 `span` 클릭, 중첩 목록, 비활성 버튼, 자식의 전파 중단, Shadow 경계, 키보드 활성화를 한 흐름에서 차례로 재현합니다. 대상이 삭제된 뒤 비동기 완료가 도착하는 경우에는 원래 DOM 참조와 현재 논리 상태가 여전히 유효한지도 확인합니다. 위임의 장점은 코드가 짧아지는 데 있지 않고, 소유 범위를 명확히 하면서 동적으로 생기는 요소의 등록 비용을 줄이는 데 있습니다.

실습 순서는 새 항목 추가, 내부 span 클릭, 중첩 목록 클릭, disabled 버튼, pointerdown과 click 동시 등록, 키보드 Enter/Space입니다. 기대 결과는 동적 항목도 한 번만 action을 실행하고, 실제 button은 기본 키보드 의미를 얻으며, div에 click만 붙인 요소는 자동으로 같은 접근성 동작을 얻지 않는 것입니다.

---
id: css-reset-normalize
title: "같은 폼과 목록이 브라우저마다 다르게 보입니다. 기본 스타일을 초기화하는 reset과 차이를 보정하는 normalize 중 무엇을 선택하고, 접근성은 어떻게 확인하나요?"
answerMinutes: 5
followups: [{"id":"css-cascade-specificity","prompt":"reset과 컴포넌트 스타일이 동시에 적용될 때 기본 선언을 이기는 cascade layer와 specificity를 어떤 순서로 관리할까요?"},{"id":"browser-rendering-layout","prompt":"전역 reset으로 많은 요소의 스타일이 바뀔 때 실제 layout·paint 범위와 성능 영향을 어떻게 확인하나요?"},{"id":"ssr-csr-hydration","prompt":"서버와 클라이언트가 서로 다른 기본 class나 스타일을 사용하면 시각 차이와 hydration 경고를 어떻게 분리해 진단할까요?"}]
difficulty: 하
category: 웹
tags: ["CSS","reset","normalize","접근성","기본 스타일"]
related: ["css-cascade-specificity"]
---

# 같은 폼과 목록이 브라우저마다 다르게 보입니다. 기본 스타일을 초기화하는 reset과 차이를 보정하는 normalize 중 무엇을 선택하고, 접근성은 어떻게 확인하나요?

## 구두 답변

reset과 normalize는 브라우저 기본 스타일 차이를 다루지만 목표가 다릅니다. reset은 여백·제목 크기·목록 표시 같은 기본 선언을 넓게 제거해 디자인 시스템이 처음부터 값을 정하게 하고, normalize는 유용한 기본 의미와 구조를 보존하면서 브라우저 간 차이를 보정합니다. 어느 쪽이 항상 더 현대적이거나 빠른 것은 아니며, 화면의 기본 HTML 의존도와 다시 지정할 스타일·접근성 검증 비용으로 선택하겠습니다.

### 제거 범위와 보존 범위를 정합니다

강한 reset을 적용하면 `h1`, `p`, `ul`의 시각적 구분과 여백을 직접 설계해야 합니다. 모든 컴포넌트가 자체 typography·spacing·form style을 갖는 제품이라면 작은 범위의 reset이 예측 가능할 수 있지만, 콘텐츠 중심 페이지에서는 브라우저 기본 heading·list·form 의미를 보존하는 normalize가 시작점이 되기 쉽습니다. 최신 브라우저만 지원한다면 오래된 브라우저용 규칙을 통째로 복사하지 않고 실제 차이를 확인해 필요한 선언만 남기겠습니다.

reset은 시각적 속성을 지우는 도구일 뿐 의미론적 HTML을 대신하지 않습니다. `outline: none`을 넣어 포커스를 없애는 것이 reset의 필수 동작은 아니며, 대체 focus-visible 스타일 없이 제거하면 키보드 사용자가 현재 위치를 잃습니다. 목록의 불릿을 없애면 시각적 단서가 줄고 일부 브라우저·보조 기술에서는 목록 인식에도 영향을 줄 수 있으므로 실제 접근성 트리를 확인해야 합니다. `button`, `input`, `select`의 기본 조작 가능성을 꾸미는 과정에서도 disabled·focus·고대비 상태를 보존합니다.

### 접근성과 유지보수까지 검증합니다

선택 후에는 heading 계층, 목록·링크의 구분, 키보드 tab 순서와 focus 표시, 기본 컨트롤의 이름·상태·조작을 확인합니다. CSS로 숨긴 요소가 시각적으로만 사라지는지 `display: none`인지, 접근성 트리와 상호작용에 어떤 결과를 주는지도 구분해야 합니다. normalize를 쓴다고 접근성 검증이 자동으로 끝나는 것은 아니고, reset을 쓴다고 모든 스타일을 직접 재현해야 하는 것도 아닙니다.

폼은 브라우저별 기본 appearance 차이가 큰 영역입니다. 디자인 일관성을 위해 appearance를 바꾸더라도 키보드 조작, native validation, select·date control의 역할, 고대비·강제 색상 환경을 잃지 않는지 우선 확인하겠습니다. 전역 reset이 컴포넌트 내부 스타일과 충돌하면 범위를 제한하거나 layer 순서를 정하고, 특정 컴포넌트만 필요한 보정은 전역에 퍼뜨리지 않습니다.

검증은 여러 브라우저와 viewport에서 같은 폼·목록을 비교하고, 키보드 전용 탐색, 스크린 리더의 heading/list 탐색, `prefers-reduced-motion`, 고대비·강제 색상, zoom 환경을 포함합니다. 결과가 픽셀 단위로 같아지는 것만 목표로 삼지 않고 기본 의미와 조작 가능성을 보존하면서 필요한 시각적 차이를 통제하는지가 기준입니다.

결국 콘텐츠 기본값을 활용할지 디자인 시스템이 전체를 소유할지 먼저 결정하고, 그 범위에 맞는 작은 reset 또는 normalize를 선택하겠습니다. 나중에 빠진 포커스와 폼 상태를 발견하는 것보다 처음부터 제거 목록과 접근성 계약을 함께 검토하는 편이 비용이 낮습니다.

특히 `ul, ol { list-style: none; }` 같은 넓은 reset은 시각적 불릿만 없애는 데서 끝나지 않습니다. Safari 등 일부 환경과 보조 기술 조합에서는 목록이 접근성 트리에서 목록으로 인식되는 방식에 영향을 줄 수 있으므로, 탐색 메뉴처럼 정말 목록 semantics를 제거하려는지와 단순히 불릿만 숨기려는지를 분리하겠습니다. 필요하면 list role·표시 방식·항목 수 안내가 의도와 맞는지 실제 VoiceOver와 키보드로 확인합니다. CSS가 요소를 꾸몄다고 의미가 자동 보장되거나, 반대로 `list-style: none` 하나만으로 의미가 항상 사라진다고 단정하지 않고 브라우저·스크린 리더 조합의 결과를 검증하겠습니다.

## 득점 포인트

- reset의 제거와 normalize의 보정·기본 의미 보존을 구분한다.
- heading·list·link·focus·form control의 접근성 손실을 구체적으로 설명한다.
- 화면 유형과 디자인 시스템 범위를 선택 기준으로 삼는다.
- 키보드·스크린 리더·강제 색상·reduced motion 검증을 제시한다.

## 감점 포인트

- reset과 normalize를 모든 기본 스타일 삭제로 동일시한다.
- 대체 focus 스타일 없이 outline을 제거한다.
- normalize가 접근성 검증을 자동으로 보장한다고 말한다.
- 폼 기본 기능과 고대비 환경을 시각적 일관성 때문에 희생한다.

## 더 파고들 거리

- form control의 appearance를 바꿀 때 반드시 보존해야 할 브라우저 기능은 무엇인가요?
- 컴포넌트 범위 reset과 전역 typography가 충돌하면 layer·상속을 어떻게 정할까요?
- prefers-reduced-motion과 강제 색상 환경에서 reset 결과를 어떤 시나리오로 검증할까요?

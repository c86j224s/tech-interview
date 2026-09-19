---
id: modal-inert-background
title: z-index만 올린 모달에서 키보드 사용자가 배경을 조작할 수 있는 이유는 무엇인가요?
difficulty: 중하
category: 웹
tags:
  - modal
  - focus
  - inert
  - accessibility
related:
  - css-reset-normalize
---
# z-index만 올린 모달에서 키보드 사용자가 배경을 조작할 수 있는 이유는 무엇인가요?

## 구두 답변

`z-index`는 주로 paint 순서와 겹침을 바꾸며 배경 요소의 focusability나 이벤트 소유권을 없애지 않습니다. 그래서 dialog가 앞에 보여도 Tab이 뒤의 링크·input·button으로 이동하거나 pointer가 overlay 밖 배경에 도달할 수 있습니다. modal을 열 때 backgroundRoot와 modal layer를 분리하고, backgroundRoot를 inert 처리하며, 실제 focus를 dialog 안으로 옮겨야 합니다.

HTML inert는 적용 subtree를 일반적으로 focus와 accessibility API에서 제외하고 pointer hit testing과 selection/editing을 억제하는 경계를 제공합니다. opacity와 어두운 overlay는 이 계약을 제공하지 않습니다. 열기는 accessible name과 초기 focus 후보를 준비한 뒤 배경 inert, dialog focus 순서로 구현하고, 닫기는 dialog close, inert 해제, fallback 검증, focus 순서로 일관되게 처리합니다. inert가 programmatic event를 모두 제거하는 것은 아니므로 문서 전역 keydown과 앱 command owner도 확인합니다.

배경을 inert로 만드는 범위도 중요합니다. modal과 overlay를 포함한 최상위 wrapper 전체를 inert로 만들면 dialog까지 focus를 잃을 수 있으므로 backgroundRoot와 dialogRoot를 형제 경계로 나누는 편이 안전합니다. 열기 순서를 기록할 때는 dialog를 준비하고 이름을 연결한 뒤 backgroundRoot를 inert로 설정하고 dialog의 첫 후보에 focus합니다. 닫기에서는 dialog의 close transition이 끝날 때까지 배경을 활성화하지 않는 정책이 필요합니다. native dialog의 top-layer 동작과 수동 구현은 같은 결과라고 가정하지 않고 target browser에서 activeElement를 비교합니다.

## 득점 포인트

- z-index의 paint 책임과 inert의 interaction 책임을 구분합니다.
- Tab, pointer hit testing, accessibility tree를 각각 검증합니다.
- backgroundRoot와 modal을 조상 관계에서 분리합니다.
- aria-modal만으로 배경 차단이 구현되지 않는다고 설명합니다.

## 감점 포인트

- 높은 z-index가 키보드 focus를 독점한다고 합니다.
- overlay opacity가 배경 링크를 비활성화한다고 합니다.
- aria-modal만 추가하면 browser가 모든 Tab을 막는다고 단정합니다.
- modal을 inert 조상에 넣고도 focus가 안전하다고 가정합니다.

## 더 파고들 거리

- background가 inert여도 document keydown이 실행될 때 layer owner와 domain command를 어디에서 제한하나요?
- native `<dialog>`와 수동 overlay를 같은 fixture에서 어떤 activeElement·inert 상태로 비교하나요?

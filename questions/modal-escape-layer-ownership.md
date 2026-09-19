---
id: modal-escape-layer-ownership
title: 중첩 popover 안 모달에서 Escape 한 번이 모든 레이어를 닫지 않게 하려면 무엇을 소유하나요?
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
# 중첩 popover 안 모달에서 Escape 한 번이 모든 레이어를 닫지 않게 하려면 무엇을 소유하나요?

## 구두 답변

Escape는 전역 `closeEverything()`이 아니라 활성 layer stack의 최상위 layer가 먼저 소유해야 합니다. `popover-A → modal-B → tooltip-C` 상태에서 C가 독립 tooltip이면 C만 닫고 이벤트를 소비합니다. C가 B의 설명 일부로 분류되면 B가 owner가 됩니다. B를 닫아도 A와 background inert는 유지하고, B가 열리기 전 자신의 호출자에만 focus를 복원합니다. 한 번의 Escape가 여러 `open=false`를 호출하면 close와 focus restoration이 서로 덮어써집니다.

각 record에 id, parent, modal 여부, focus scope, onEscape 정책, return target, close generation을 둡니다. keydown은 최상위 active record를 읽고 handler가 `preventDefault`와 소비 여부를 결정합니다. `stopPropagation()`만으로는 이미 실행된 document/framework listener를 되돌리지 못하므로 실제 transition owner와 중복 호출을 log로 검증합니다. overlay 바깥 클릭도 composedPath로 content 밖인지 판단하되, `data-id`는 서버 인가 근거가 아닙니다.

layer stack에는 시각적 z-index만 저장하지 말고 focus return target과 inert 범위도 함께 저장해야 합니다. C를 닫을 때 B의 focus scope와 배경 inert를 건드리지 않아야 하며, B를 닫을 때만 A 또는 B의 invoker로 돌아갑니다. keydown handler가 소비 여부를 반환하고 한 곳에서 transition을 시작하면 document listener와 component listener가 중복으로 닫는 문제를 찾기 쉽습니다. Shadow DOM에서는 composedPath를 기준으로 현재 layer를 찾고, 삭제나 결제 같은 실제 효과는 UI layer id가 아니라 domain 권한 검사를 다시 거칩니다.

## 득점 포인트

- stack 최상위 owner와 한 단계 close를 구체 상태로 설명합니다.
- C만 닫고 B/A를 유지하는 결과를 말합니다.
- layer별 focus restoration과 inert 수명을 연결합니다.
- document listener·framework listener·Shadow DOM 경계를 검증합니다.

## 감점 포인트

- document keydown에서 모든 modal/popover를 닫습니다.
- stopPropagation만으로 다른 listener의 상태 변경도 취소된다고 합니다.
- 최상위 layer를 닫으며 모든 background inert를 즉시 해제합니다.
- overlay data-id를 권한 확인으로 사용합니다.

## 더 파고들 거리

- 중첩 modal에서 각 호출자와 return target을 세대별 record로 저장해야 하는 이유는 무엇인가요?
- Shadow DOM의 composed Escape를 어느 경계에서 공개 custom event로 바꾸면 owner가 하나로 유지되나요?

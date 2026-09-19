---
id: modal-initial-focus-decision
title: 삭제 확인 모달의 첫 포커스를 제목·취소·삭제 중 어디에 둘지 어떤 기준으로 정하나요?
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
# 삭제 확인 모달의 첫 포커스를 제목·취소·삭제 중 어디에 둘지 어떤 기준으로 정하나요?

## 구두 답변

첫 focus는 DOM의 첫 control이 아니라 위험도, 설명 길이, 사용자가 이어갈 가능성이 높은 행동을 기준으로 정합니다. 되돌릴 수 없는 삭제라면 취소를 먼저 두어 실수 비용을 낮추는 정책이 자연스럽습니다. 긴 경고나 구조화된 설명이면 `heading` 또는 도입 문단에 `tabindex=-1`을 주고 제목에 focus해 맥락을 먼저 읽게 할 수 있습니다. 단순 알림이나 반복 삭제처럼 제품이 처리량을 우선한다면 확정 control을 선택할 수도 있지만, 그 이유와 undo 가능성을 정책으로 남겨야 합니다.

예를 들어 제목·설명·취소·삭제 순서의 dialog에서 영구 삭제라면 취소에 focus하고, 휴지통으로 이동해 쉽게 복원되는 작업이라면 삭제를 기본으로 둘 여지가 있습니다. 첫 후보가 disabled가 되거나 validation으로 제거되면 heading, close button, dialog container처럼 실제 focusable한 fallback을 재선택합니다. `aria-modal=true`와 accessible name은 의미를 제공하지만 Tab containment, background inert, Escape를 대신하지 않으므로 열기 전 호출자 저장과 닫기 후 복원까지 함께 검사합니다.

초기 포커스 선택은 안내 문장의 길이뿐 아니라 사용자가 첫 Tab을 눌렀을 때의 순서도 포함합니다. heading에 `tabindex=-1`을 주면 읽기 시작점을 만들 수 있지만 일반적인 Tab 순서에는 들어가지 않게 설계할 수 있습니다. 취소 버튼을 먼저 두는 경우에도 삭제 버튼의 accessible name이 대상과 위험을 분명히 말해야 하며, close button이 dialog 바깥으로 포커스를 보내서는 안 됩니다. 실제 검증에서는 키보드만으로 열기·취소·확정·Escape를 수행하고 activeElement와 스크린 리더의 이름/설명 순서를 기록합니다.

## 득점 포인트

- 되돌릴 수 없음·설명 길이·다음 행동을 구체 정책으로 연결합니다.
- heading tabindex=-1과 취소/삭제 control의 역할을 구분합니다.
- 초기 focus 후보가 사라질 때 fallback을 재선택합니다.
- ARIA 속성과 실제 키보드 상호작용을 분리합니다.

## 감점 포인트

- 모든 삭제 dialog가 삭제 버튼으로 시작해야 한다고 합니다.
- 시각적 overlay가 focus 이동과 배경 차단을 자동으로 만든다고 합니다.
- aria-modal만으로 Tab trap과 Escape가 생긴다고 설명합니다.
- disabled 후보를 그대로 focus하려고 합니다.

## 더 파고들 거리

- 긴 설명을 heading focus로 읽게 할지 aria-describedby로 묶을지 실제 screen reader에서 어떤 순서를 비교하나요?
- 초기 버튼이 동적으로 disabled가 될 때 modal generation 안에서 후보를 언제 다시 계산하나요?

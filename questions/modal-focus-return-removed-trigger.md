---
id: modal-focus-return-removed-trigger
title: 모달을 연 버튼이 닫기 전에 삭제되면 포커스를 어디에 복원해야 하나요?
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
# 모달을 연 버튼이 닫기 전에 삭제되면 포커스를 어디에 복원해야 하나요?

## 구두 답변

호출자 참조를 저장했다고 무조건 그 요소에 focus하지 않습니다. 닫는 순간 connected이고, 실제 focusability 정책을 통과하며, disabled·inert가 아니고 현재 focus를 받을 수 있는지 확인합니다. 목록 5번째 행의 삭제 버튼이 dialog를 열고 삭제 확정으로 행 전체가 사라졌다면 invoker는 `isConnected=false`입니다. 이때 이전 행, 다음 행, 목록 heading, 빈 목록의 “새 항목 추가”처럼 사용자가 같은 작업을 이어갈 수 있는 fallback을 정책으로 선택합니다.

연결 여부·disabled·visibility만 통과한 일반 div는 focusable하지 않을 수 있으므로 후보의 tabindex/컨트롤 상태를 별도로 확인하고, `focus()` 뒤 `document.activeElement===candidate` 또는 shadow root의 activeElement인지 검증합니다. 실패하면 연결된 다음 후보로 내려갑니다. dialog close 뒤 background inert를 해제하고 fallback을 재검증한 후 focus하되, framework task나 animation 사이에 배경이 잠깐 활성화되지 않도록 한 task에서 처리하거나 목표가 확정될 때까지 inert를 유지합니다. native dialog와 수동 overlay의 close 동작은 별도로 검증합니다.

fallback은 DOM 순서만으로 고르지 말고 작업 의미를 따라야 합니다. 다섯 번째 행을 삭제한 뒤 여섯 번째 행이 남아 있으면 그 행의 첫 control로 이동하는 편이 연속 탐색에 맞지만, 마지막 행을 삭제했다면 이전 행이나 목록 heading이 더 자연스러울 수 있습니다. 후보를 선택한 뒤 `focus()`를 호출하고 activeElement가 바뀌지 않으면 다음 후보로 내려갑니다. 서버가 삭제를 거부해 행을 복원하는 경우에는 modal close generation을 함께 검사해 늦게 도착한 복원 effect가 사용자의 새 focus를 덮어쓰지 않게 합니다.

## 득점 포인트

- JS 참조 생존과 실제 focusability를 구분합니다.
- 행 삭제 후 이전/다음 행·heading·추가 버튼의 선택을 설명합니다.
- focus() 후 activeElement로 성공을 확인합니다.
- inert 해제와 fallback focus 사이의 task 경쟁을 다룹니다.

## 감점 포인트

- 제거된 Element에 focus하면 브라우저가 자동 fallback한다고 합니다.
- connected와 visible이면 어떤 요소든 focusable하다고 단정합니다.
- 항상 body나 문서 첫 요소로 복원합니다.
- animation 종료까지 무조건 기다리는 것이 유일하게 안전하다고 합니다.

## 더 파고들 거리

- 서버 응답으로 행이 복원될 때 이전 modal generation의 focus가 새 UI를 덮어쓰지 않게 하려면 어떤 세대 ID를 저장하나요?
- 호출자는 연결됐지만 disabled가 된 경우 후보 순서를 어떻게 선택하나요?

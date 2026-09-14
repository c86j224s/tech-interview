---
id: "capture-versus-bubble-delegation"
title: "부모에서 이벤트를 위임했지만 일부 이벤트는 받지 못합니다. capture와 bubble 위임을 어떤 조건으로 선택하나요?"
difficulty: "중하"
category: "웹"
tags: ["DOM","이벤트","버블링","이벤트 위임","JavaScript","심화 질문"]
related: ["dom-event-delegation"]
promotedFrom: {"id":"dom-event-delegation","prompt":"캡처 위임이 버블 위임보다 필요한 이벤트는 어떤 경우일까요?"}
---

# 부모에서 이벤트를 위임했지만 일부 이벤트는 받지 못합니다. capture와 bubble 위임을 어떤 조건으로 선택하나요?

## 구두 답변

모든 이벤트가 bubble하는 것은 아니므로 이벤트별 전파 계약을 확인합니다. 예를 들어 focus 계열에서는 capture나 bubble하는 대응 이벤트를 선택할 수 있습니다.

capture는 자식보다 먼저 관찰할 수 있지만 stopPropagation·Shadow DOM 경계·기본 동작을 고려합니다. 위임 루트 안의 실제 대상인지 검사하고 키보드 활성화도 지원합니다. 이벤트를 받았다는 사실이 상태 변경을 두 번 실행할 이유가 되지 않게 공통 동작으로 연결합니다.

## 득점 포인트

- 모든 이벤트가 bubble하는 것은 아니므로 이벤트별 전파 계약을 확인합니다. 예를 들어 focus 계열에서는 capture나 bubble하는 대응 이벤트를 선택할 수 있습니다.
- 이벤트를 받았다는 사실이 상태 변경을 두 번 실행할 이유가 되지 않게 공통 동작으로 연결합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 모든 이벤트가 bubble하는 것은 아니므로 이벤트별 전파 계약을 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: 동적으로 추가되는 목록 항목의 클릭을 한 곳에서 처리하려면 이벤트 위임을 어떻게 적용하나요?](/tech-interview/questions/dom-event-delegation/)

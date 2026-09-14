---
id: "js-event-listener-cleanup"
title: "SPA 화면을 오갈수록 이벤트가 여러 번 실행되고 메모리가 늘어납니다. listener와 closure 수명은 어떻게 관리하나요?"
answerMinutes: 5
followups: [{"id": "dom-event-delegation", "prompt": "동적 항목의 이벤트를 한 루트에서 처리하되 대상 범위와 중복 처리는 어떻게 검증하나요?"}, {"id": "js-closure-loop", "prompt": "callback이 등록 시점 값과 이후 가변 바인딩 중 무엇을 읽는지 어떻게 구분하나요?"}, {"id": "js-abortcontroller-lifetime", "prompt": "클라이언트 취소 뒤 늦은 결과와 서버의 이미 완료된 변경을 어떻게 따로 처리하나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript", "언어·런타임"]
related: ["dom-event-delegation", "js-closure-loop", "js-abortcontroller-lifetime"]
---

# SPA 화면을 오갈수록 이벤트가 여러 번 실행되고 메모리가 늘어납니다. listener와 closure 수명은 어떻게 관리하나요?

## 구두 답변

화면이 사라져도 전역 event target·timer·구독이 callback을 참조하면 관련 객체가 살아 있을 수 있습니다. 등록과 해제를 같은 소유 수명에 연결하고 중복 등록과 늦은 callback을 구분해야 합니다.

### 동작 원리와 전제

removeEventListener에는 대응하는 함수 참조와 capture 조건이 필요합니다. 같은 모양의 새 화살표 함수를 넘겨도 기존 등록을 제거하지 못할 수 있습니다. AbortSignal이나 구독 해제 핸들을 활용할 수 있지만 지원 계약을 확인합니다.

### 선택과 실패 처리

한 번만 실행할 이벤트는 once를 사용할 수 있고 동적 목록은 위임으로 등록 수를 줄일 수 있습니다. 그러나 위임도 루트 listener의 수명과 대상 범위 검사가 필요합니다. DOM에서 노드를 지웠다고 모든 외부 참조가 사라지지는 않습니다.

### 구체적인 사례와 검증

전역 window에 resize listener를 등록한 화면이 해제될 때 callback을 제거하지 않으면 closure가 화면 상태를 붙잡을 수 있습니다. 같은 컴포넌트가 다시 만들어지면 새 listener도 추가되어 한 이벤트에 여러 번 실행됩니다. 등록 시 받은 해제 함수나 controller를 소유 객체가 보관하고 종료 시 한 번만 정리합니다. DOM 노드에만 붙은 listener와 외부 root가 붙잡은 callback의 수명은 다를 수 있으므로 참조 경로를 실제로 확인합니다. 모든 listener가 항상 누수라는 설명도 피하고 반복 화면 전환 뒤 살아 있는 객체와 callback 횟수의 추세를 비교하겠습니다.

반복 mount·unmount·탐색·timer·fetch 완료를 시험해 callback 횟수와 heap 참조 경로를 봅니다. 늦은 결과는 현재 화면 세대와 비교해 적용합니다. 메모리 증가가 정상 캐시인지 누수인지 시간을 두고 구분하며 전체 페이지 새로고침으로만 해결하지 않습니다.

## 득점 포인트

- 핵심 구분: 화면이 사라져도 전역 event target·timer·구독이 callback을 참조하면 관련 객체가 살아 있을 수 있습니다.
- 선택 조건: 한 번만 실행할 이벤트는 once를 사용할 수 있고 동적 목록은 위임으로 등록 수를 줄일 수 있습니다.
- 검증 기준: 반복 mount·unmount·탐색·timer·fetch 완료를 시험해 callback 횟수와 heap 참조 경로를 봅니다.

## 감점 포인트

- DOM에서 화면을 지우면 전역 listener와 timer 참조도 모두 사라진다고 한다.

## 더 파고들 거리

- 동적 항목의 이벤트를 한 루트에서 처리하되 대상 범위와 중복 처리는 어떻게 검증하나요?
- callback이 등록 시점 값과 이후 가변 바인딩 중 무엇을 읽는지 어떻게 구분하나요?
- 클라이언트 취소 뒤 늦은 결과와 서버의 이미 완료된 변경을 어떻게 따로 처리하나요?

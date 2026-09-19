---
id: touch-action-passive-scroll
title: 스크롤 지연을 줄이려고 모든 touch listener를 passive로 바꾸기 전에 어떤 동작 계약을 확인해야 하나요?
difficulty: 중하
category: 웹
tags:
  - passive
  - preventDefault
  - scroll
  - DOM event
related:
  - capture-versus-bubble-delegation
---
# 스크롤 지연을 줄이려고 모든 touch listener를 passive로 바꾸기 전에 어떤 동작 계약을 확인해야 하나요?

## 구두 답변

먼저 각 touch listener가 입력을 관찰만 하는지, 문서의 스크롤·확대·드래그를 실제로 취소해야 하는지 구분해야 합니다. analytics나 좌표 기록만 하는 listener는 passive가 맞을 가능성이 크지만, 지도 핀치 확대나 canvas drag처럼 컴포넌트가 gesture를 소유하는 listener까지 passive로 바꾸면 `preventDefault()`가 작동하지 않아 문서 스크롤과 컴포넌트 조작이 동시에 발생할 수 있습니다.

제스처 계약을 수치로 확인합니다. 가로 carousel에서 손가락 이동 `dx=80, dy=12`이면 component가 가로 drag를 소유하고, `dx=10, dy=80`이면 문서 세로 scroll을 허용한다고 정합니다. CSS `touch-action`이 허용 방향을 선언하고 JavaScript의 방향 판정이 같은 규칙을 사용해야 합니다. CSS가 동작을 선언했다고 모든 listener의 cancelable이 자동으로 바뀌는 것은 아닙니다. 런타임 취소가 꼭 필요한 event만 non-passive로 남기고 handler를 짧게 유지합니다.

검증에서는 실제 기기에서 `cancelable`, `defaultPrevented`, scroll 위치, pointer/touch 이동, handler 시간을 기록하고 중첩 스크롤·키보드·접근성 조작도 확인합니다. 모든 listener를 non-passive로 두면 스크롤 시작이 메인 스레드와 긴 handler를 기다리는 비용이 생깁니다. 반대로 모두 passive면 gesture owner가 기능을 잃습니다. 선택 결과는 “빠르게”가 아니라 어느 주체가 어느 기본 동작을 소유하는지로 결정합니다.

## 득점 포인트

- 관찰용 listener, 기본 동작 취소 listener, gesture owner를 분리합니다.
- dx/dy 입력과 touch-action·JavaScript 방향 판정의 계약을 연결합니다.
- 실제 기기에서 스크롤과 접근성 대체 입력을 함께 검증합니다.

## 감점 포인트

- 지연을 줄이려면 모든 touch listener를 passive로 바꿔야 한다고 합니다.
- touch-action만 설정하면 모든 preventDefault가 성공한다고 말합니다.
- 한 기기의 touch trace만 보고 중첩 스크롤과 키보드 동작을 생략합니다.

## 더 파고들 거리

- 조상과 자식이 모두 gesture를 주장하는 중첩 스크롤에서 owner를 어떤 상태로 선택할까요?
- 취소 권한은 유지하면서 긴 gesture 계산을 어떻게 worker·rAF·사전 계산으로 분리할까요?

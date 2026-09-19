---
id: intersectionobserver-threshold-crossing
title: >-
  IntersectionObserver threshold가 [0,0.5,1]일 때 ratio가 0.2에서 0.7로 바뀌면 알림은 무엇으로
  결정되나요?
difficulty: 중하
category: 웹
tags:
  - IntersectionObserver
  - ResizeObserver
  - delivery
  - layout feedback
related:
  - browser-rendering-layout
---
# IntersectionObserver threshold가 [0,0.5,1]일 때 ratio가 0.2에서 0.7로 바뀌면 알림은 무엇으로 결정되나요?

## 구두 답변

알림은 ratio의 절대 숫자보다 이전 상태와 현재 상태 사이에서 등록한 threshold index가 바뀌었는지로 결정됩니다. `[0, 0.5, 1]`에서 이전 ratio 0.2는 0.5 아래이고 새 ratio 0.7은 0.5 이상이므로 0.5를 아래에서 위로 넘었습니다. 그 대상의 entry가 callback queue에 들어갈 수 있지만, 0.2와 0.7 사이의 0.3·0.4·0.6을 별도 callback으로 모두 보고한다는 뜻은 아닙니다.

양의 면적을 가진 대상에서 ratio는 교차 면적과 대상 bounding box 면적의 비율로 이해합니다. root, rootMargin, clipping이 계산을 바꾸고, zero-area target은 특수 규칙이 있어 ratio만 단순 나눗셈으로 읽으면 안 됩니다. callback에서는 현재 `entry.intersectionRatio`, `isIntersecting`, `time`, `target`을 함께 기록합니다. 0.2→0.7 구간에서 여러 threshold를 통과했더라도 entry의 현재 ratio는 0.7이며, 애플리케이션이 어떤 경계를 처리했는지는 등록한 threshold와 자체 상태로 결정합니다.

무한 스크롤 sentinel에서는 callback을 scroll 이벤트처럼 매번 실행된다고 가정하면 중복 fetch가 생깁니다. 처리한 cursor, loading 상태, 요청 세대를 기록하고, 새 카드 삽입으로 sentinel이 다시 교차하는 경우도 같은 cursor인지 검사합니다. observer 전달은 비동기이므로 callback 때 DOM이 이미 바뀌었는지와 요청 owner가 아직 살아 있는지도 확인해야 합니다.

## 득점 포인트

- 0.2→0.7에서 0.5 crossing만 경계가 된다는 수치를 설명합니다.
- ratio의 면적 전제, zero-area 예외, isIntersecting과 root margin을 구분합니다.
- sentinel 재교차를 cursor·세대·loading 상태로 제어합니다.

## 감점 포인트

- ratio가 0.2에서 0.7이면 0.1 단위 알림이 모두 온다고 합니다.
- isIntersecting=true이면 0.5 threshold도 반드시 넘었다고 단정합니다.
- callback을 동기 scroll handler처럼 보고 현재 화면과 entry 시간을 구분하지 않습니다.

## 더 파고들 거리

- 한 계산 사이에 ratio가 0.2→0.7→0.3으로 바뀌면 entry의 현재값과 실제 화면을 어떻게 비교할까요?
- rootMargin과 transform이 crossing을 바꾸는 재현에서 어떤 기하 값을 고정해야 할까요?

---
id: observer-disconnect-lifetime
title: 화면이 제거됐는데 ResizeObserver callback이 계속 오면 어떤 수명 경계를 확인하나요?
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
# 화면이 제거됐는데 ResizeObserver callback이 계속 오면 어떤 수명 경계를 확인하나요?

## 구두 답변

DOM에서 노드를 제거한 것과 ResizeObserver 등록을 해제한 것은 별개의 경계입니다. 먼저 callback이 어느 observer instance와 component owner에 속하는지, target이 `unobserve()`됐는지, owner 전체를 소유한 observer라면 `disconnect()`됐는지 확인합니다. 이미 queue에 들어간 entry가 전달되는 시점과 framework unmount 순서는 엔진·wrapper에 따라 확인해야 하므로 “노드가 사라졌으니 callback은 절대 없다”고 단정하지 않습니다.

세대 trace를 둡니다. 화면 세대 3이 target card를 관찰하다 unmount되고, 같은 DOM 역할이 세대 4에서 재사용됐다고 합시다. 세대 3 종료 시 `unobserve(card)`와 abort를 실행하고 `mounted=false`를 기록합니다. 이후 instance 3의 entry가 도착해도 callback 첫 줄에서 instance/generation을 확인해 버립니다. 세대 4 observer의 entry만 현재 state를 바꿉니다. shared observer에 `disconnect()`를 호출하면 다른 화면 target까지 끊으므로 target별 routing이 필요합니다.

계속 로그가 찍힌다고 곧 메모리 누수는 아닙니다. queued delivery 하나, 다른 observer instance의 재등록, callback write가 만드는 새 resize, cleanup 누락을 `observerId`, generation, target id, inline/block size, write 종류로 분리합니다. callback이 fetch를 시작한다면 observer 해제와 network abort도 같은 owner 종료에서 처리합니다. 수명 검증은 DOM 제거 전후와 observer 해제 전후를 각각 기록하는 작은 harness로 수행합니다.

## 득점 포인트

- DOM 제거, unobserve/disconnect, queued entry를 독립 경계로 구분합니다.
- 세대 3 callback이 세대 4 state를 덮지 못하는 검사 순서를 설명합니다.
- 로그 지속과 메모리 누수를 instance·재등록·feedback·cleanup으로 나눕니다.

## 감점 포인트

- DOM에서 제거하면 모든 observer callback이 즉시 사라진다고 합니다.
- shared observer 문제마다 global disconnect를 호출해 다른 화면 관찰을 끊습니다.
- callback 로그가 하나 남은 것만으로 브라우저 버그나 누수라고 결론 냅니다.

## 더 파고들 거리

- queued entry와 unobserve 호출 순서를 고정하는 테스트 harness에는 어떤 로그가 필요할까요?
- observer callback이 시작한 fetch를 화면 종료와 함께 취소하되 결과를 기록하려면 어떻게 할까요?

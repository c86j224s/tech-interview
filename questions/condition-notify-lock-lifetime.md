---
id: "condition-notify-lock-lifetime"
title: "조건 변수의 notify를 락 밖으로 옮깁니다. 깨움 경합과 조건 변수 객체 수명은 어떻게 보호하나요?"
difficulty: "중하"
category: "동시성"
tags: ["조건 변수","뮤텍스","허위 깨움","심화 질문"]
related: ["condition-variable-predicate","mutex-vs-serial-execution"]
promotedFrom: {"id":"condition-variable-predicate","prompt":"생산자가 `notify_one`을 락 안과 밖에서 호출하면 정확성과 깨운 스레드의 경합은 어떻게 달라질까요? 조건 변수 객체의 수명은 누가 보장해야 할까요?"}
---

# 조건 변수의 notify를 락 밖으로 옮깁니다. 깨움 경합과 조건 변수 객체 수명은 어떻게 보호하나요?

## 구두 답변

predicate 변경은 같은 mutex로 보호하고 알림은 그 상태 변경 이후 수행합니다. 락 밖 notify는 깨어난 스레드가 즉시 같은 락을 기다리는 경합을 줄일 수 있지만 항상 더 빠르다는 보장은 없습니다.

락을 푼 직후 마지막 소유자가 조건 변수를 파괴하면 notify가 죽은 객체를 접근할 수 있어 notifier 수명까지 보장해야 합니다. 대기자는 while로 predicate를 재확인합니다. 알림 위치·spurious wakeup·종료·객체 파괴를 함께 시험하고 신호 자체를 상태로 사용하지 않습니다.

## 득점 포인트

- predicate 변경은 같은 mutex로 보호하고 알림은 그 상태 변경 이후 수행합니다. 락 밖 notify는 깨어난 스레드가 즉시 같은 락을 기다리는 경합을 줄일 수 있지만 항상 더 빠르다는 보장은 없습니다.
- 알림 위치·spurious wakeup·종료·객체 파괴를 함께 시험하고 신호 자체를 상태로 사용하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: predicate 변경은 같은 mutex로 보호하고 알림은 그 상태 변경 이후 수행합니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 스레드가 작업 큐를 공유합니다. 빈 큐에서 조건 변수로 기다리던 스레드가 알림을 받고 깨어났는데, 왜 큐가 다시 비어 있을 수 있고 어떻게 처리해야 하나요?](/tech-interview/questions/condition-variable-predicate/)

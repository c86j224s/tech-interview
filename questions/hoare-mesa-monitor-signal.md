---
id: "hoare-mesa-monitor-signal"
title: "조건을 알린 뒤 실행권이 즉시 대기자에게 넘어가는 모니터와 나중에 경쟁하는 모니터는 무엇이 다른가요?"
difficulty: "중하"
category: "동시성"
tags: ["모니터","조건 변수","상호 배제","심화 질문"]
related: ["monitor-synchronization","condition-variable-predicate"]
promotedFrom: {"id":"monitor-synchronization","prompt":"Hoare식과 Mesa식 모니터의 signal 후 실행 순서를 비교해 보세요."}
---

# 조건을 알린 뒤 실행권이 즉시 대기자에게 넘어가는 모니터와 나중에 경쟁하는 모니터는 무엇이 다른가요?

## 구두 답변

Hoare식은 signal 후 대기자에게 실행권을 넘기는 의미를, Mesa식은 깨어난 대기자가 나중에 락을 다시 경쟁하는 의미를 구분합니다. 실제 언어·라이브러리의 규칙을 확인해야 합니다.

Mesa식에서는 다른 작업이 predicate를 바꿀 수 있어 while 재검사가 필요합니다. 알림은 조건 자체가 아니며 spurious wakeup·종료·객체 수명을 함께 시험합니다.

## 득점 포인트

- Hoare식은 signal 후 대기자에게 실행권을 넘기는 의미를, Mesa식은 깨어난 대기자가 나중에 락을 다시 경쟁하는 의미를 구분합니다. 실제 언어·라이브러리의 규칙을 확인해야 합니다.
- 알림은 조건 자체가 아니며 spurious wakeup·종료·객체 수명을 함께 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Hoare식은 signal 후 대기자에게 실행권을 넘기는 의미를, Mesa식은 깨어난 대기자가 나중에 락을 다시 경쟁하는 의미를 구분합니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 스레드가 공유 큐에 넣고 꺼내며 큐가 비었을 때 기다립니다. 모니터는 공유 상태·상호 배제·조건 대기를 어떻게 묶어 관리하나요?](/tech-interview/questions/monitor-synchronization/)

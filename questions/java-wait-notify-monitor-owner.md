---
id: "java-wait-notify-monitor-owner"
title: "Java wait·notify를 호출할 때 어떤 객체의 monitor를 소유해야 하며 wait는 어떤 락을 풀어 주나요?"
difficulty: "중하"
category: "동시성"
tags: ["모니터","조건 변수","상호 배제","심화 질문"]
related: ["monitor-synchronization","condition-variable-predicate"]
promotedFrom: {"id":"monitor-synchronization","prompt":"Java wait/notify에서 모니터 소유 조건은 무엇인가요?"}
---

# Java wait·notify를 호출할 때 어떤 객체의 monitor를 소유해야 하며 wait는 어떤 락을 풀어 주나요?

## 구두 답변

wait·notify는 해당 객체의 monitor를 소유한 상태에서 호출해야 합니다. wait는 그 monitor를 놓고 대기한 뒤 다시 획득해 반환하지만 보유한 다른 객체의 락까지 모두 풀지는 않습니다.

predicate를 while로 재검사하고 notify 하나가 어떤 대기자를 깨우는지 의존하지 않습니다. interrupt·timeout·spurious wakeup·종료를 처리합니다. 다른 락을 잡은 채 wait해 생기는 cycle도 조사합니다.

## 득점 포인트

- wait·notify는 해당 객체의 monitor를 소유한 상태에서 호출해야 합니다. wait는 그 monitor를 놓고 대기한 뒤 다시 획득해 반환하지만 보유한 다른 객체의 락까지 모두 풀지는 않습니다.
- 다른 락을 잡은 채 wait해 생기는 cycle도 조사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: wait·notify는 해당 객체의 monitor를 소유한 상태에서 호출해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 스레드가 공유 큐에 넣고 꺼내며 큐가 비었을 때 기다립니다. 모니터는 공유 상태·상호 배제·조건 대기를 어떻게 묶어 관리하나요?](/tech-interview/questions/monitor-synchronization/)

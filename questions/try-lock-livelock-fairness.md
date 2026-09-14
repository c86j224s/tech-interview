---
id: "try-lock-livelock-fairness"
title: "두 작업이 try-lock 실패 때 서로 양보하며 계속 재시도합니다. deadlock 없이도 진행하지 못하는 이유와 대책은 무엇인가요?"
difficulty: "중하"
category: "동시성"
tags: ["교착 상태","뮤텍스","상호 배제","잠금 순서","대기 그래프","심화 질문"]
related: ["deadlock-prevention","mutex-vs-serial-execution","transaction-and-lost-update"]
promotedFrom: {"id":"deadlock-prevention","prompt":"try-lock과 재시도를 반복하는 구조에서 라이브락과 기아를 줄이려면 어떤 공정성 규칙이 필요할까요?"}
---

# 두 작업이 try-lock 실패 때 서로 양보하며 계속 재시도합니다. deadlock 없이도 진행하지 못하는 이유와 대책은 무엇인가요?

## 구두 답변

서로 락을 놓고 같은 간격에 다시 경쟁하면 상태는 계속 바뀌지만 실제 작업은 진행되지 않는 livelock이 생길 수 있습니다. 획득 순서 고정·무작위 backoff·공정 큐·시도 상한을 검토합니다.

지터는 충돌 확률을 줄이지만 개별 진행의 절대 보증이 아닙니다. deadline과 최소 진행 budget을 두고 긴 작업을 분리합니다. 테스트에서 성공 횟수·최대 대기·재시도 수를 보고 deadlock이 없다는 사실만으로 정상이라고 판단하지 않습니다.

## 득점 포인트

- 서로 락을 놓고 같은 간격에 다시 경쟁하면 상태는 계속 바뀌지만 실제 작업은 진행되지 않는 livelock이 생길 수 있습니다. 획득 순서 고정·무작위 backoff·공정 큐·시도 상한을 검토합니다.
- 테스트에서 성공 횟수·최대 대기·재시도 수를 보고 deadlock이 없다는 사실만으로 정상이라고 판단하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 서로 락을 놓고 같은 간격에 다시 경쟁하면 상태는 계속 바뀌지만 실제 작업은 진행되지 않는 livelock이 생길 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 두 스레드가 락 A와 B를 반대 순서로 잡다가 서로 멈췄습니다. 왜 스스로 풀리지 않으며 어떻게 예방하나요?](/tech-interview/questions/deadlock-prevention/)

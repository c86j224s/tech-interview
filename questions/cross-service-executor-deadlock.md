---
id: "cross-service-executor-deadlock"
title: "RPC 응답을 기다리는 worker가 상대의 callback 실행에 필요합니다. 여러 서비스·실행기에 걸친 순환 대기는 어떻게 찾나요?"
difficulty: "중하"
category: "동시성"
tags: ["교착 상태","뮤텍스","상호 배제","잠금 순서","대기 그래프","심화 질문"]
related: ["deadlock-prevention","mutex-vs-serial-execution","transaction-and-lost-update"]
promotedFrom: {"id":"deadlock-prevention","prompt":"RPC와 실행기까지 걸친 순환 대기를 로컬 덤프와 분산 추적으로 어떻게 연결할까요?"}
---

# RPC 응답을 기다리는 worker가 상대의 callback 실행에 필요합니다. 여러 서비스·실행기에 걸친 순환 대기는 어떻게 찾나요?

## 구두 답변

local thread dump에 worker가 RPC를 기다리는 모습만 있어도 상대 서비스가 그 worker의 callback을 기다리면 분산 cycle이 될 수 있습니다. 요청·작업 ID와 executor 큐·락 소유를 연결해 대기 그래프를 만듭니다.

공유 executor의 모든 worker가 자식 작업을 기다리면 자식이 실행될 자리가 없어질 수 있습니다. 비동기 연결·별도 실행기·동기 대기 제거와 bounded queue를 검토합니다. timeout만 늘리거나 worker만 늘려 근본 cycle을 숨기지 않습니다.

## 득점 포인트

- local thread dump에 worker가 RPC를 기다리는 모습만 있어도 상대 서비스가 그 worker의 callback을 기다리면 분산 cycle이 될 수 있습니다. 요청·작업 ID와 executor 큐·락 소유를 연결해 대기 그래프를 만듭니다.
- timeout만 늘리거나 worker만 늘려 근본 cycle을 숨기지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: local thread dump에 worker가 RPC를 기다리는 모습만 있어도 상대 서비스가 그 worker의 callback을 기다리면 분산 cycle이 될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 두 스레드가 락 A와 B를 반대 순서로 잡다가 서로 멈췄습니다. 왜 스스로 풀리지 않으며 어떻게 예방하나요?](/tech-interview/questions/deadlock-prevention/)

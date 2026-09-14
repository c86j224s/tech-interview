---
id: "wait-free-lock-free-progress"
title: "lock-free가 각 스레드의 완료 시간을 보장하나요? wait-free와 전체 진행·개별 기아를 어떻게 구분하나요?"
difficulty: "중하"
category: "동시성"
tags: ["락 프리","ABA","메모리 회수","심화 질문"]
related: ["lock-free-aba-reclamation","atomics-memory-order"]
promotedFrom: {"id":"lock-free-aba-reclamation","prompt":"wait-free와 lock-free의 보장을 실제 API 계약으로 어떻게 구분할까요?"}
---

# lock-free가 각 스레드의 완료 시간을 보장하나요? wait-free와 전체 진행·개별 기아를 어떻게 구분하나요?

## 구두 답변

lock-free는 전체 시스템의 어떤 연산이 계속 진행하는 성질이지 모든 스레드가 제한된 단계 안에 끝나는 보장은 아닙니다. wait-free는 개별 연산의 제한된 진행을 더 강하게 요구합니다.

재시도 CAS 루프의 기아·reclamation·할당기의 blocking을 포함한 실제 API 범위를 봅니다. 알고리즘 핵심이 lock-free여도 전체 함수의 모든 의존성이 그런 것은 아닙니다. 최악 지연·throughput·공정성을 따로 측정합니다.

## 득점 포인트

- lock-free는 전체 시스템의 어떤 연산이 계속 진행하는 성질이지 모든 스레드가 제한된 단계 안에 끝나는 보장은 아닙니다. wait-free는 개별 연산의 제한된 진행을 더 강하게 요구합니다.
- 최악 지연·throughput·공정성을 따로 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: lock-free는 전체 시스템의 어떤 연산이 계속 진행하는 성질이지 모든 스레드가 제한된 단계 안에 끝나는 보장은 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 다른 스레드가 읽고 있을 수 있는 락 프리 스택의 노드를 제거했습니다. 왜 그 메모리를 바로 해제하면 안 되나요?](/tech-interview/questions/lock-free-aba-reclamation/)

---
id: "optimistic-retry-hotkey-abort"
title: "낙관적 갱신 충돌이 계속 발생합니다. 재시도 중단과 키별 직렬화 전환을 어떤 지표로 판단하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["트랜잭션","격리 수준","갱신 손실","낙관적 동시성 제어","비관적 동시성 제어","MVCC","심화 질문"]
related: ["transaction-and-lost-update","mutex-vs-serial-execution","deadlock-prevention"]
promotedFrom: {"id":"transaction-and-lost-update","prompt":"낙관적 동시성 제어의 재시도를 언제 포기할지, 반복되는 충돌을 어떤 지표로 판단할까요?"}
---

# 낙관적 갱신 충돌이 계속 발생합니다. 재시도 중단과 키별 직렬화 전환을 어떤 지표로 판단하나요?

## 구두 답변

충돌률·시도 수·최대 대기·원본 부하를 보고 재시도 예산을 제한합니다. 같은 hotkey에서 계속 충돌하면 backoff만 늘리기보다 단일 owner·짧은 transaction·예약 모델을 검토합니다.

새 시도는 최신 상태를 다시 읽고 계산해야 합니다. 사용자 의도와 논리 ID를 유지하며 외부 효과를 중복하지 않습니다. 기아·deadline·정상 거절을 별도로 기록합니다.

## 득점 포인트

- 충돌률·시도 수·최대 대기·원본 부하를 보고 재시도 예산을 제한합니다. 같은 hotkey에서 계속 충돌하면 backoff만 늘리기보다 단일 owner·짧은 transaction·예약 모델을 검토합니다.
- 기아·deadline·정상 거절을 별도로 기록합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 충돌률·시도 수·최대 대기·원본 부하를 보고 재시도 예산을 제한합니다.

## 더 파고들 거리

- [기본 상황과 비교: 두 요청이 같은 재고를 읽고 각각 차감한 값을 저장합니다. 각 요청을 트랜잭션으로 묶어도 갱신이 유실될 수 있으며 어떻게 막나요?](/tech-interview/questions/transaction-and-lost-update/)

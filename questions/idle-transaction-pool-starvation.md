---
id: "idle-transaction-pool-starvation"
title: "쿼리를 하지 않는 transaction이 연결과 잠금을 잡고 있습니다. idle 상태와 idle in transaction을 어떻게 구분하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["연결 풀","트랜잭션","타임아웃","심화 질문"]
related: ["db-pool-long-transactions","bounded-queue-backpressure"]
promotedFrom: {"id":"db-pool-long-transactions","prompt":"유휴 트랜잭션 제한과 풀 고갈을 같은 장애 흐름으로 재현해 보세요."}
---

# 쿼리를 하지 않는 transaction이 연결과 잠금을 잡고 있습니다. idle 상태와 idle in transaction을 어떻게 구분하나요?

## 구두 답변

idle 연결은 대기 중이어도 열린 transaction이 없을 수 있고 idle in transaction은 snapshot·잠금·자원을 유지할 수 있습니다. 엔진의 session·transaction view로 마지막 질의와 시작·종료를 확인합니다.

외부 API·사용자 입력을 transaction 안에서 기다리는 경로를 줄입니다. pool timeout과 transaction timeout·정리 실패를 나눕니다. 취소·예외·응답 중단에서 rollback과 release가 실제 수행되는지 테스트하고 pool을 키워 증상을 숨기지 않습니다.

## 득점 포인트

- idle 연결은 대기 중이어도 열린 transaction이 없을 수 있고 idle in transaction은 snapshot·잠금·자원을 유지할 수 있습니다. 엔진의 session·transaction view로 마지막 질의와 시작·종료를 확인합니다.
- 취소·예외·응답 중단에서 rollback과 release가 실제 수행되는지 테스트하고 pool을 키워 증상을 숨기지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: idle 연결은 대기 중이어도 열린 transaction이 없을 수 있고 idle in transaction은 snapshot·잠금·자원을 유지할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: DB 연결 풀 대기는 늘고 쿼리는 짧을 때, 풀을 키우기 전에 어떤 연결 보유 경로와 트랜잭션을 확인하나요?](/tech-interview/questions/db-pool-long-transactions/)

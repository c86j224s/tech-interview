---
id: "redis-multi-queue-runtime-errors"
title: "Redis MULTI의 큐잉 오류와 EXEC 중 실행 오류는 어떤 차이가 있으며 앞선 변경은 rollback되나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Redis","파이프라이닝","트랜잭션","Lua","심화 질문"]
related: ["redis-pipeline-transaction-lua","transaction-and-lost-update","redis-cluster-hash-tags"]
promotedFrom: {"id":"redis-pipeline-transaction-lua","prompt":"MULTI 큐잉 오류와 EXEC 실행 오류를 구분해 보세요."}
---

# Redis MULTI의 큐잉 오류와 EXEC 중 실행 오류는 어떤 차이가 있으며 앞선 변경은 rollback되나요?

## 구두 답변

MULTI 큐잉 단계의 문법·인자 오류와 EXEC 실행 중 타입 오류는 처리 단계가 다릅니다. 실행 중 한 명령이 실패했다고 앞서 실행된 쓰기가 일반 DB transaction처럼 자동 rollback되는 것은 아닙니다.

EXEC의 결과 배열을 항목별로 검사합니다. 원자 비간섭성과 rollback을 구분하고, 조건 판단은 WATCH 재시도·짧은 Lua 등으로 표현합니다. 오류·응답 유실·클러스터 슬롯을 함께 시험합니다.

## 득점 포인트

- MULTI 큐잉 단계의 문법·인자 오류와 EXEC 실행 중 타입 오류는 처리 단계가 다릅니다. 실행 중 한 명령이 실패했다고 앞서 실행된 쓰기가 일반 DB transaction처럼 자동 rollback되는 것은 아닙니다.
- 오류·응답 유실·클러스터 슬롯을 함께 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: MULTI 큐잉 단계의 문법·인자 오류와 EXEC 실행 중 타입 오류는 처리 단계가 다릅니다.

## 더 파고들 거리

- [기본 상황과 비교: Redis에 여러 명령을 보내는 왕복 비용을 줄이면서 조회 결과에 따른 갱신도 안전하게 처리하려 합니다. 파이프라이닝·MULTI/EXEC·Lua 중 무엇을 선택하나요?](/tech-interview/questions/redis-pipeline-transaction-lua/)

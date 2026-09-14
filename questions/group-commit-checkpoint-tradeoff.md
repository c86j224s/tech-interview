---
id: "group-commit-checkpoint-tradeoff"
title: "여러 commit을 한 번의 flush로 묶고 checkpoint 주기를 바꿉니다. 대기·로그·복구 시간은 어떻게 달라지나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["WAL","내구성","커밋","심화 질문"]
related: ["db-wal-durability","request-timeout-idempotency"]
promotedFrom: {"id":"db-wal-durability","prompt":"group commit과 체크포인트 빈도의 비용을 비교해 보세요."}
---

# 여러 commit을 한 번의 flush로 묶고 checkpoint 주기를 바꿉니다. 대기·로그·복구 시간은 어떻게 달라지나요?

## 구두 답변

group commit은 여러 transaction 로그 flush를 묶어 디스크 왕복을 나누지만 각 요청이 묶임을 기다릴 수 있습니다. checkpoint는 더티 페이지·복구 로그 범위의 비용을 바꾸며 commit의 원자성과 별도입니다.

flush 횟수만 줄이고 지연·유실 설정을 숨기지 않습니다. checkpoint를 자주 하면 정상 I/O가 늘고 드물면 복구 작업이 커질 수 있습니다. 같은 쓰기량에서 commit latency·로그·디스크·강제 재시작 복구 시간을 비교합니다.

## 득점 포인트

- group commit은 여러 transaction 로그 flush를 묶어 디스크 왕복을 나누지만 각 요청이 묶임을 기다릴 수 있습니다. checkpoint는 더티 페이지·복구 로그 범위의 비용을 바꾸며 commit의 원자성과 별도입니다.
- 같은 쓰기량에서 commit latency·로그·디스크·강제 재시작 복구 시간을 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: group commit은 여러 transaction 로그 flush를 묶어 디스크 왕복을 나누지만 각 요청이 묶임을 기다릴 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: DB가 커밋 성공을 응답한 직후 서버 전원이 꺼졌습니다. 데이터 페이지가 아직 디스크에 쓰이지 않았어도 복구할 수 있는 이유와 필요한 설정은 무엇인가요?](/tech-interview/questions/db-wal-durability/)

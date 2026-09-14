---
id: "database-log-lock-pressure-priority"
title: "대량 갱신에서 로그 압력과 잠금 대기가 함께 늘어납니다. 어느 병목을 먼저 줄였는지 어떻게 검증하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["잠금","락 에스컬레이션","트랜잭션","심화 질문"]
related: ["db-lock-escalation","deadlock-prevention","composite-index-column-order"]
promotedFrom: {"id":"db-lock-escalation","prompt":"로그 압력과 잠금 압력이 동시에 커질 때 우선순위를 정해 보세요."}
---

# 대량 갱신에서 로그 압력과 잠금 대기가 함께 늘어납니다. 어느 병목을 먼저 줄였는지 어떻게 검증하나요?

## 구두 답변

로그 flush 대기·디스크 공간·replica lag와 lock wait·보유 transaction을 각각 관측합니다. 배치 크기를 줄여 둘 다 개선될 수 있지만 원인이 같은 것이라고 단정하지 않습니다.

동일 데이터·동시성에서 인덱스·transaction 범위·batch 하나씩 바꾸고 생성 로그·읽기량·p99를 비교합니다. lock 힌트나 durability 약화로 숫자만 낮추지 않습니다. 부분 commit의 원자성·재시작 계약과 정상 사용자 영향을 함께 검증합니다.

## 득점 포인트

- 로그 flush 대기·디스크 공간·replica lag와 lock wait·보유 transaction을 각각 관측합니다. 배치 크기를 줄여 둘 다 개선될 수 있지만 원인이 같은 것이라고 단정하지 않습니다.
- 부분 commit의 원자성·재시작 계약과 정상 사용자 영향을 함께 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 로그 flush 대기·디스크 공간·replica lag와 lock wait·보유 transaction을 각각 관측합니다.

## 더 파고들 거리

- [기본 상황과 비교: UPDATE로 바뀐 행은 몇 개뿐인데 다른 요청이 오래 기다립니다. 실제 잠금 범위와 보유 시간을 어떻게 확인하나요?](/tech-interview/questions/db-lock-escalation/)

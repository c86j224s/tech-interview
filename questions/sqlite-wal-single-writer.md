---
id: sqlite-wal-single-writer
title: SQLite WAL에서 여러 reader가 동시에 읽어도 writer가 하나로 제한되는 이유를 어떻게 설명하나요?
difficulty: 하
category: 데이터베이스
tags:
  - SQLite
  - WAL
  - single writer
  - concurrency
related:
  - db-wal-durability
---
# SQLite WAL에서 여러 reader가 동시에 읽어도 writer가 하나로 제한되는 이유를 어떻게 설명하나요?

## 구두 답변

WAL은 reader가 database 파일과 자신이 정한 end mark 이전의 WAL frame을 조합해 snapshot을 읽도록 하므로 reader와 writer가 겹칠 수 있게 합니다. 그러나 WAL에 frame을 append하는 순서와 write transaction 잠금은 하나의 writer가 조정합니다. 따라서 reader 동시성 증가를 writer 병렬화로 해석하면 안 됩니다.

A와 B가 frame 100을 end mark로 읽는 동안 W1이 `BEGIN IMMEDIATE`를 얻어 101~110을 append한다고 하겠습니다. A·B는 여전히 100 기준 snapshot을 보고, 새 reader C는 더 뒤 frame을 볼 수 있습니다. 이때 W2가 다른 테이블에 쓰려고 해도 W1이 writer 경계를 보유하면 W2는 대기하거나 설정에 따라 BUSY를 받습니다. “서로 다른 테이블”이라는 논리적 분리가 append 순서 잠금을 없애지는 않습니다. 연결 수를 늘리기보다 write transaction 수명, commit 빈도, busy deadline과 checkpoint 경합을 측정합니다. transaction을 잘게 나누면 lock 보유는 줄지만 중간 commit과 부분 성공 의미가 생깁니다.

여기서 내구성 판단과 동시성 판단도 나눕니다. W1이 commit했다는 사실은 해당 transaction의 durability 설정과 flush 경계를 확인하는 문제이고, W2가 기다리는 이유는 WAL writer lock과 append 순서의 문제입니다. 서로 다른 connection이 같은 파일을 쓰므로 connection pool을 크게 만드는 것만으로 throughput이 선형 증가하지 않습니다. 실제 개선은 write batch를 줄이고 transaction 경계를 짧게 하되, 중간 commit으로 생기는 부분 성공을 애플리케이션이 처리할 때만 선택합니다.

## 득점 포인트

- end mark snapshot과 WAL append writer를 서로 다른 역할로 설명합니다.
- W1의 101~110 append 중 W2가 즉시 병렬 commit하지 못하는 중간 상태를 제시합니다.
- connection 수 증가가 단일 writer 한계를 없애지 않는다는 결론을 transaction 수명과 연결합니다.

## 감점 포인트

- WAL에서는 reader와 writer가 모두 무제한 병렬이라고 말합니다.
- 다른 테이블이면 W2가 항상 동시에 commit할 수 있다고 가정합니다.
- busy timeout만 늘리면 writer 수가 늘어난다고 설명합니다.

## 더 파고들 거리

- 오래 열린 reader가 writer append가 아니라 checkpoint 진행과 WAL 축소에 미치는 영향을 구분해 보세요.
- SQLite의 단일 writer와 일반 DB의 group commit 내구 보장을 같은 계약으로 합치지 않는 이유를 설명해 보세요.

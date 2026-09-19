---
id: sqlite-wal-busy-retry
title: SQLite WAL에서도 SQLITE_BUSY가 발생할 수 있는 상황과 busy timeout을 무조건 늘리면 안 되는 이유는 무엇인가요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQLite
  - SQLITE_BUSY
  - WAL
  - timeout
related:
  - db-query-cancellation-state
---
# SQLite WAL에서도 SQLITE_BUSY가 발생할 수 있는 상황과 busy timeout을 무조건 늘리면 안 되는 이유는 무엇인가요?

## 구두 답변

WAL은 reader와 writer의 겹침을 늘리지만 모든 잠금 경계를 없애지는 않습니다. 실제 `SQLITE_BUSY`는 두 writer가 write transaction을 경쟁하거나, VFS·shared-memory·파일 잠금 또는 recovery 조건에서 잠금을 얻지 못할 때 반환될 수 있습니다. 반면 오래 열린 reader 때문에 checkpoint가 end mark에서 멈추는 것은 checkpoint가 partial로 끝나는 진행 경계이지, 그 사실만으로 BUSY라고 부르면 안 됩니다. 반환 코드와 checkpoint result를 분리해서 기록해야 원인이 섞이지 않습니다.

W1이 5ms 동안 writer lock을 잡고 W2가 기다리는 경우에는 요청 deadline 안의 bounded retry가 유효할 수 있습니다. 그러나 reader A의 10분 cursor 때문에 checkpoint가 남은 frame을 가지고 돌아오는 상황에서 timeout을 늘려도 A의 수명은 변하지 않습니다. 무한 재시도는 connection과 worker를 붙잡아 tail latency를 키우므로, 오류 코드·transaction 종류·시작 시각·checkpoint caller·WAL frame·대기 시간·남은 deadline을 로그로 남기고, 짧은 lock 경합만 backoff합니다. 상태가 깨진 connection이나 schema 오류는 재시도보다 rollback/폐기를 판단합니다.

retry 정책은 오류 종류와 deadline을 입력으로 받는 작은 상태 기계로 두는 편이 안전합니다. `BUSY`가 발생하면 남은 deadline이 20ms이고 최근 writer가 5ms 내 종료되는 패턴이면 짧은 backoff를 한 번 더 시도할 수 있습니다. 반면 connection이 transaction 중간 오류 상태이거나 deadline이 끝났으면 재시도하지 않고 rollback 또는 폐기합니다. checkpoint의 remaining frame은 reader 수명 단축 작업으로 해결해야 하며 timeout 값만 바꾸는 처방으로 기록하지 않습니다.

## 득점 포인트

- 실제 BUSY 반환과 checkpoint partial progress를 분리합니다.
- 5ms writer 경합과 10분 reader 사례를 대비시켜 timeout의 한계를 계산합니다.
- deadline·bounded retry·connection 상태를 함께 판단합니다.

## 감점 포인트

- WAL에서는 BUSY가 절대 없다고 말합니다.
- 모든 BUSY를 무한 재시도하거나 네트워크 transient error처럼 취급합니다.
- reader가 checkpoint를 지연시킨다는 사실만으로 BUSY 반환을 확정합니다.

## 더 파고들 거리

- busy handler가 재시도하는 동안 connection pool 점유 시간과 요청 p99를 어떤 지표로 측정할지 정리해 보세요.
- deadline 초과, rollback 실패, connection 폐기 조건을 상태 기계로 표현해 보세요.

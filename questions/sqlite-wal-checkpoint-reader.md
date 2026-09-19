---
id: sqlite-wal-checkpoint-reader
title: 오래 열린 SQLite WAL reader가 checkpoint와 WAL 파일 축소를 어떻게 지연시킬 수 있나요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQLite
  - WAL
  - checkpoint
  - reader
related:
  - old-transaction-version-retention
---
# 오래 열린 SQLite WAL reader가 checkpoint와 WAL 파일 축소를 어떻게 지연시킬 수 있나요?

## 구두 답변

reader는 시작할 때 end mark를 고르고 그 뒤 frame을 보지 않습니다. A가 100을 기준으로 열린 동안 writer가 101부터 1,100까지 append하면 A는 계속 100 이전 snapshot을 요구할 수 있습니다. checkpoint는 frame을 database 파일로 복사하더라도 A가 안전하게 읽어야 하는 경계를 넘어서 truncate할 수 없으므로 요청한 전부를 처리하지 못하거나 WAL 파일을 줄이지 못합니다. 이것은 우선 checkpoint progress/remaining frames 문제이며, 호출이 partial로 끝났다고 해서 반드시 `SQLITE_BUSY`가 반환된 것은 아닙니다.

운영 trace에는 `reader A start=100 → WAL end=1100 → checkpoint request=1100 → copied=100, remaining=1000`처럼 처리량과 잔여량을 남깁니다. A가 cursor를 닫거나 transaction을 끝낸 뒤 다시 checkpoint하면 더 멀리 진행할 수 있지만 다른 reader·writer가 경쟁하면 결과는 다시 partial일 수 있습니다. 그래서 “checkpoint 성공”과 “WAL 파일 0”을 같은 지표로 쓰지 않고 mode/result, oldest reader 수명, frame 수, 파일 크기를 함께 봅니다. 화면 cursor나 스트리밍 응답이 connection을 오래 붙잡는다면 결과를 짧게 추출해 reader lifetime을 줄이는 방향이 우선입니다.

이 현상은 writer가 계속 막힌다는 뜻과도 다릅니다. WAL은 reader가 오래 살아 있는 동안에도 새 writer가 frame을 append할 수 있지만, database 파일로 안전하게 복사하고 재사용할 수 있는 경계가 reader snapshot에 의해 제한됩니다. 따라서 해결책은 checkpoint 호출 빈도를 무작정 높이는 것이 아니라 cursor를 페이지 단위로 오래 유지하지 않게 하고, transaction을 짧게 끝내며, 남은 frame이 특정 connection 수명과 함께 줄어드는지 확인하는 것입니다.

## 득점 포인트

- end mark 100과 WAL end 1,100의 상태를 숫자로 추적합니다.
- checkpoint가 복사할 수 있는 경계와 실제 BUSY 반환을 별개로 설명합니다.
- cursor·transaction 수명과 WAL 크기, checkpoint result를 함께 관측합니다.

## 감점 포인트

- checkpoint를 호출하면 WAL이 항상 0이 된다고 말합니다.
- 오래 열린 reader가 writer의 모든 append를 항상 막는다고 단정합니다.
- partial progress를 BUSY 반환으로 자동 번역합니다.

## 더 파고들 거리

- 자동 checkpoint threshold와 reader lifetime을 p95/p99 write latency와 어떤 대시보드로 연결할지 설계해 보세요.
- snapshot을 강제 종료하지 않고 결과를 먼저 materialize하는 구조가 어떤 의미 변경을 만드는지 검토해 보세요.

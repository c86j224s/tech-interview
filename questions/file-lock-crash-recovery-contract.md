---
id: "file-lock-crash-recovery-contract"
title: "파일 잠금으로 여러 writer를 직렬화했습니다. 부분 쓰기와 프로세스 중단 복구에는 어떤 기록이 더 필요한가요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["DBMS","파일 시스템","트랜잭션","무결성 제약","심화 질문"]
related: ["dbms-vs-files"]
promotedFrom: {"id":"dbms-vs-files","prompt":"파일 잠금·로그·복구를 DBMS 트랜잭션과 비교해 보세요."}
---

# 파일 잠금으로 여러 writer를 직렬화했습니다. 부분 쓰기와 프로세스 중단 복구에는 어떤 기록이 더 필요한가요?

## 구두 답변

락은 동시 writer를 통제할 수 있지만 쓰기 도중 중단된 파일을 복원하는 정보는 따로 필요합니다. 임시 파일·버전·checksum·WAL 또는 manifest로 완성 상태와 부분 상태를 구분합니다.

락 소유자가 죽어 락이 풀려도 데이터가 일관된 것은 아닙니다. 모든 프로세스가 같은 잠금 규칙을 지키는지와 fsync·rename의 내구성을 확인합니다. 여러 파일 변경은 개별 교체만으로 하나의 transaction이 되지 않습니다.

## 득점 포인트

- 락은 동시 writer를 통제할 수 있지만 쓰기 도중 중단된 파일을 복원하는 정보는 따로 필요합니다. 임시 파일·버전·checksum·WAL 또는 manifest로 완성 상태와 부분 상태를 구분합니다.
- 여러 파일 변경은 개별 교체만으로 하나의 transaction이 되지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 락은 동시 writer를 통제할 수 있지만 쓰기 도중 중단된 파일을 복원하는 정보는 따로 필요합니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 프로세스가 같은 파일에 주문을 저장할 때 생기는 문제를 DBMS는 어떤 책임으로 해결하나요?](/tech-interview/questions/dbms-vs-files/)

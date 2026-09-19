---
id: join-hash-memory-spill
title: 두 큰 입력의 등가 조인에서 hash join의 build side와 memory spill을 어떻게 판단하나요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQL
  - hash join
  - memory
  - spill
related:
  - query-memory-grant-over-under
---
# 두 큰 입력의 등가 조인에서 hash join의 build side와 memory spill을 어떻게 판단하나요?

## 구두 답변
등가 조인에서는 먼저 실제로 더 작고 좁은 입력을 build로 만들 수 있는지 확인합니다. 예상 build가 1만 행이고 평균 payload가 200바이트면 payload만 `10,000×200=2,000,000`바이트, 약 1.9MiB입니다. 하지만 해시 버킷, 튜플 헤더, 조인에 필요한 추가 컬럼이 있어 실제 Hash 메모리는 2MB로 확정되지 않습니다. 다른 입력은 probe로 읽으며 버킷 후보를 다시 키 비교합니다.

예상 1만 행이 실제 1천만 행이면 build 자료구조가 메모리 예산을 넘을 수 있습니다. partition을 나누어 임시 공간에 쓰고 같은 partition끼리 재처리하는 spill이 발생할 수 있으므로 hash join이라는 이름만으로 디스크 I/O가 없다고 말하지 않습니다. PostgreSQL 18 기준으로는 `EXPLAIN (ANALYZE, BUFFERS)`에서 estimated/actual rows와 Hash 노드의 `Batches`, `Memory Usage`를 대조합니다. Batches가 1보다 크면 디스크 사용이 있다는 신호지만, 해당 요약이 디스크 바이트를 항상 보여준다고 확대하지 않습니다. `grant`, `temp read/write`는 엔진별 관찰 계약이므로 SQL Server 등으로 일반화하지 않습니다.

원인은 통계가 실제 build 폭을 과소평가했는지, 넓은 projection이 행 폭을 키웠는지, 키 편중으로 partition 하나가 커졌는지 나눠 봅니다. 메모리 설정을 무조건 올리면 동시 쿼리의 대기와 OOM이 커질 수 있으므로 필요한 컬럼, 통계, 동시성, p99를 함께 비교합니다.

## 득점 포인트
- 1만×200바이트의 payload와 실제 hash 구조 메모리를 구분합니다.
- PostgreSQL에서 Batches와 Memory Usage를 확인하고 Batches>1의 의미를 정확히 말합니다.
- 통계 오류·행 폭·키 편중·동시성 비용을 메모리 증설과 분리합니다.

## 감점 포인트
- hash join은 입력을 한 번만 읽으므로 spill이 없다고 단정합니다.
- 원시 payload 합계를 실제 hash table 사용량으로 확정합니다.
- grant와 temp 필드를 모든 데이터베이스에 동일한 관찰 항목으로 옮깁니다.

## 더 파고들 거리
- 키 편중으로 한 partition만 커질 때 전체 행 수와 partition별 상태를 어떻게 관찰할지 살펴보세요.
- 통계 갱신, projection 축소, 메모리 조정의 실험 순서를 workload 동시성과 함께 설계해 보세요.

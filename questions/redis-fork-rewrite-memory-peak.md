---
id: "redis-fork-rewrite-memory-peak"
title: "Redis AOF rewrite 중 쓰기가 많습니다. copy-on-write·버퍼·디스크의 최대 비용을 어떤 부하로 재현하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Redis","RDB","AOF","지속성","심화 질문"]
related: ["redis-rdb-aof","db-wal-durability"]
promotedFrom: {"id":"redis-rdb-aof","prompt":"rewrite 중 쓰기 버퍼와 메모리 피크를 재현해 보세요."}
---

# Redis AOF rewrite 중 쓰기가 많습니다. copy-on-write·버퍼·디스크의 최대 비용을 어떤 부하로 재현하나요?

## 구두 답변

fork 시점의 페이지를 자식이 유지하는 동안 부모 쓰기가 COW 복사를 늘릴 수 있습니다. rewrite 파일·증분 기록·replication·client buffer와 디스크 I/O도 메모리·지연에 영향을 줍니다.

최대 쓰기율과 긴 rewrite·디스크 부족·중단을 시험합니다. fork와 별도 background 작업의 동시 실행 제약은 버전별 확인합니다. 평균 heap만으로 OOM 여유를 계산하지 않습니다.

## 득점 포인트

- fork 시점의 페이지를 자식이 유지하는 동안 부모 쓰기가 COW 복사를 늘릴 수 있습니다. rewrite 파일·증분 기록·replication·client buffer와 디스크 I/O도 메모리·지연에 영향을 줍니다.
- 평균 heap만으로 OOM 여유를 계산하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: fork 시점의 페이지를 자식이 유지하는 동안 부모 쓰기가 COW 복사를 늘릴 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Redis 재시작 때 최근 쓰기가 일부 사라져 지속성 설정을 바꾸려 합니다. RDB와 AOF는 유실 범위·복구 시간·디스크 비용을 어떻게 바꾸나요?](/tech-interview/questions/redis-rdb-aof/)

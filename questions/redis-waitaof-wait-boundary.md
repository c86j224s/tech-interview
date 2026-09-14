---
id: "redis-waitaof-wait-boundary"
title: "Redis WAIT와 WAITAOF는 어떤 복제·디스크 확인을 각각 제공하며 승격·외부 효과에는 어떤 한계가 남나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Redis","WAIT","복제","내구성","심화 질문"]
related: ["redis-wait-durability","redis-sentinel-cluster","redis-rdb-aof"]
promotedFrom: {"id":"redis-wait-durability","prompt":"WAITAOF와 WAIT가 확인하는 내구 지점을 비교해 보세요."}
---

# Redis WAIT와 WAITAOF는 어떤 복제·디스크 확인을 각각 제공하며 승격·외부 효과에는 어떤 한계가 남나요?

## 구두 답변

WAIT는 같은 연결의 이전 쓰기가 replica에 복제됐다는 확인 수와 관련되고 WAITAOF는 지원 버전·설정에서 AOF 내구 확인을 더 다룹니다. 실제 반환 수와 timeout을 검사해야 합니다.

어느 확인도 모든 장애 도메인 손실·승격 선택·외부 효과 exactly-once를 자동 보장하지 않습니다. 원래 쓰기는 timeout으로 rollback되지 않습니다. 확인 노드 손실·다른 replica 승격·재시도 원장을 대조합니다.

## 득점 포인트

- WAIT는 같은 연결의 이전 쓰기가 replica에 복제됐다는 확인 수와 관련되고 WAITAOF는 지원 버전·설정에서 AOF 내구 확인을 더 다룹니다. 실제 반환 수와 timeout을 검사해야 합니다.
- 확인 노드 손실·다른 replica 승격·재시도 원장을 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: WAIT는 같은 연결의 이전 쓰기가 replica에 복제됐다는 확인 수와 관련되고 WAITAOF는 지원 버전·설정에서 AOF 내구 확인을 더 다룹니다.

## 더 파고들 거리

- [기본 상황과 비교: Redis WAIT가 복제 확인을 반환한 뒤에도 장애 전환에서 쓰기 보존을 단정할 수 없는 이유는 무엇인가요?](/tech-interview/questions/redis-wait-durability/)

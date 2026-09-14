---
id: "redis-sentinel-quorum-majority"
title: "Sentinel의 장애 판단 quorum과 failover 승인에 필요한 다수 조건은 어떻게 다른가요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Redis","Sentinel","Cluster","심화 질문"]
related: ["redis-sentinel-cluster","hash-sharding-and-resharding"]
promotedFrom: {"id":"redis-sentinel-cluster","prompt":"Sentinel quorum과 승격 조건을 실제 장애로 확인해 보세요."}
---

# Sentinel의 장애 판단 quorum과 failover 승인에 필요한 다수 조건은 어떻게 다른가요?

## 구두 답변

Sentinel quorum은 객관적 장애 판단에 필요한 관찰 조건이고 failover를 수행할 leader 선출에는 Sentinel 다수의 승인 조건이 별도로 필요합니다. 설정 quorum만 만족하면 항상 승격된다고 하지 않습니다.

Sentinel 노드 분할·primary 장애·후보 replica 상태를 시험합니다. 이 합의가 비동기 복제의 누락 쓰기를 복원하지는 않습니다. client 주소 재발견·old 연결·멱등 재시도도 검증합니다.

## 득점 포인트

- Sentinel quorum은 객관적 장애 판단에 필요한 관찰 조건이고 failover를 수행할 leader 선출에는 Sentinel 다수의 승인 조건이 별도로 필요합니다. 설정 quorum만 만족하면 항상 승격된다고 하지 않습니다.
- client 주소 재발견·old 연결·멱등 재시도도 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Sentinel quorum은 객관적 장애 판단에 필요한 관찰 조건이고 failover를 수행할 leader 선출에는 Sentinel 다수의 승인 조건이 별도로 필요합니다.

## 더 파고들 거리

- [기본 상황과 비교: Redis 주 노드 장애에 자동 대응하고 데이터가 커지면 여러 노드로 나누려 합니다. Sentinel과 Cluster는 각각 무엇을 해결하며 클라이언트는 무엇을 지원해야 하나요?](/tech-interview/questions/redis-sentinel-cluster/)

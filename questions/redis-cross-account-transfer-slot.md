---
id: "redis-cross-account-transfer-slot"
title: "서로 다른 계정 키가 다른 Redis 슬롯에 있습니다. 이체를 단일 슬롯으로 묶을지 별도 조정할지 어떻게 비교하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Redis","Cluster","hash tag","심화 질문"]
related: ["redis-cluster-hash-tags","redis-pipeline-transaction-lua"]
promotedFrom: {"id":"redis-cluster-hash-tags","prompt":"서로 다른 계정 이체를 단일 슬롯 모델로 바꿀지 비교해 보세요."}
---

# 서로 다른 계정 키가 다른 Redis 슬롯에 있습니다. 이체를 단일 슬롯으로 묶을지 별도 조정할지 어떻게 비교하나요?

## 구두 답변

같은 슬롯은 Redis의 짧은 다중 키 원자 연산을 가능하게 하지만 모든 계정을 한 tag에 묶으면 분산 이점을 잃습니다. 계정 간 강한 이체가 필요하면 데이터 배치·권위 DB·예약 보상 모델을 비교합니다.

다른 슬롯의 두 명령은 한 Lua로 자동 원자화되지 않습니다. 응답 유실·한쪽 성공·승격·재시도에서 원장을 대조합니다. Redis 원자성도 외부 DB·메시지까지 묶지 않습니다.

## 득점 포인트

- 같은 슬롯은 Redis의 짧은 다중 키 원자 연산을 가능하게 하지만 모든 계정을 한 tag에 묶으면 분산 이점을 잃습니다. 계정 간 강한 이체가 필요하면 데이터 배치·권위 DB·예약 보상 모델을 비교합니다.
- Redis 원자성도 외부 DB·메시지까지 묶지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 같은 슬롯은 Redis의 짧은 다중 키 원자 연산을 가능하게 하지만 모든 계정을 한 tag에 묶으면 분산 이점을 잃습니다.

## 더 파고들 거리

- [기본 상황과 비교: Redis Cluster에서 hash tag로 관련 키를 같은 슬롯에 배치할 때 원자성·분산·재시도에 어떤 제약이 생기나요?](/tech-interview/questions/redis-cluster-hash-tags/)

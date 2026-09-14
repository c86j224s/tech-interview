---
id: "redis-hash-field-expiry-layout"
title: "Redis hash를 여러 키로 나눌지 필드 만료 기능을 쓸지 결정합니다. 버전·원자성·메타데이터 비용은 어떻게 비교하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Redis","자료형","메모리","심화 질문"]
related: ["redis-data-types-encoding","lru-cache-policy"]
promotedFrom: {"id":"redis-data-types-encoding","prompt":"해시를 여러 키로 쪼갤 때 TTL·원자성 비용을 비교해 보세요."}
---

# Redis hash를 여러 키로 나눌지 필드 만료 기능을 쓸지 결정합니다. 버전·원자성·메타데이터 비용은 어떻게 비교하나요?

## 구두 답변

지원 Redis 버전의 hash-field expiry 기능과 제한을 확인하고, 별도 키 분리는 독립 만료·갱신 대신 키 메타데이터·왕복·슬롯 비용을 만듭니다. 기능이 모든 버전에 있다고도 없다고도 단정하지 않습니다.

논리 자료형과 물리 encoding 임계값을 구분합니다. 필드 삭제·만료·원자 갱신·큰 값에서 실제 메모리와 p99를 비교하고 권위 데이터를 eviction 가능한 cache처럼 취급하지 않습니다.

## 득점 포인트

- 지원 Redis 버전의 hash-field expiry 기능과 제한을 확인하고, 별도 키 분리는 독립 만료·갱신 대신 키 메타데이터·왕복·슬롯 비용을 만듭니다. 기능이 모든 버전에 있다고도 없다고도 단정하지 않습니다.
- 필드 삭제·만료·원자 갱신·큰 값에서 실제 메모리와 p99를 비교하고 권위 데이터를 eviction 가능한 cache처럼 취급하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 지원 Redis 버전의 hash-field expiry 기능과 제한을 확인하고, 별도 키 분리는 독립 만료·갱신 대신 키 메타데이터·왕복·슬롯 비용을 만듭니다.

## 더 파고들 거리

- [기본 상황과 비교: Redis에 사용자별 속성 목록을 저장하려 합니다. 문자열·해시·집합 중 필요한 연산에 맞는 자료형을 고르고 실제 메모리와 갱신 비용은 어떻게 확인하나요?](/tech-interview/questions/redis-data-types-encoding/)

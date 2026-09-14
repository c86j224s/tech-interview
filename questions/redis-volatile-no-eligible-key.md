---
id: "redis-volatile-no-eligible-key"
title: "volatile eviction 정책인데 TTL이 있는 키가 부족합니다. 메모리 압박에서 새 쓰기는 어떻게 동작하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Redis","TTL","eviction","심화 질문"]
related: ["redis-expiry-eviction","lru-cache-policy"]
promotedFrom: {"id":"redis-expiry-eviction","prompt":"volatile 정책에서 TTL 키 부족 시 쓰기 결과를 확인해 보세요."}
---

# volatile eviction 정책인데 TTL이 있는 키가 부족합니다. 메모리 압박에서 새 쓰기는 어떻게 동작하나요?

## 구두 답변

volatile 정책은 TTL이 설정된 키 중에서 제거 대상을 찾습니다. 제거 가능한 키가 충분하지 않으면 메모리를 늘리는 새 쓰기가 실패할 수 있어 allkeys 정책과 같은 동작으로 보지 않습니다.

used_memory·RSS·evicted·expired·OOM 오류를 나눠 관찰합니다. maxmemory는 전체 프로세스 RSS의 절대 상한이 아닙니다. cache·권위 데이터 분리와 원본 재생성·쓰기 실패 계약을 검증합니다.

## 득점 포인트

- volatile 정책은 TTL이 설정된 키 중에서 제거 대상을 찾습니다. 제거 가능한 키가 충분하지 않으면 메모리를 늘리는 새 쓰기가 실패할 수 있어 allkeys 정책과 같은 동작으로 보지 않습니다.
- cache·권위 데이터 분리와 원본 재생성·쓰기 실패 계약을 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: volatile 정책은 TTL이 설정된 키 중에서 제거 대상을 찾습니다.

## 더 파고들 거리

- [기본 상황과 비교: Redis 키가 설정한 TTL보다 일찍 사라졌습니다. 만료와 maxmemory eviction의 차이를 어떻게 확인하고 어떤 데이터를 제거해도 되는지 정책을 정하나요?](/tech-interview/questions/redis-expiry-eviction/)

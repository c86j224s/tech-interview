---
id: "cache-expiry-eviction-priority"
title: "TTL 만료와 메모리 eviction이 함께 일어납니다. 재생성 비용과 신선도를 기준으로 어떤 항목을 먼저 제거하나요?"
difficulty: "중하"
category: "자료구조"
tags: ["LRU","캐시","교체 정책","심화 질문"]
related: ["lru-cache-policy","cache-stampede-singleflight"]
promotedFrom: {"id":"lru-cache-policy","prompt":"TTL 만료와 용량 eviction이 겹칠 때 데이터 종류별 제거 우선순위를 설계해 보세요."}
---

# TTL 만료와 메모리 eviction이 함께 일어납니다. 재생성 비용과 신선도를 기준으로 어떤 항목을 먼저 제거하나요?

## 구두 답변

시간상 만료된 값은 더 이상 신선한 결과로 반환할 수 없고, eviction은 아직 유효한 값도 용량 때문에 제거하는 정책입니다. 부재 이유와 원본 재생성 비용을 구분합니다.

권위 데이터는 cache처럼 지워도 되는지 먼저 확인합니다. 바이트 크기·접근 빈도·stale 허용을 정책에 반영하고 만료 집중의 원본 폭주를 제한합니다. TTL이 남았다는 사실은 eviction되지 않을 보장이 아닙니다.

## 득점 포인트

- 시간상 만료된 값은 더 이상 신선한 결과로 반환할 수 없고, eviction은 아직 유효한 값도 용량 때문에 제거하는 정책입니다. 부재 이유와 원본 재생성 비용을 구분합니다.
- TTL이 남았다는 사실은 eviction되지 않을 보장이 아닙니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 시간상 만료된 값은 더 이상 신선한 결과로 반환할 수 없고, eviction은 아직 유효한 값도 용량 때문에 제거하는 정책입니다.

## 더 파고들 거리

- [기본 상황과 비교: LRU 캐시에 대량 순차 조회가 들어온 뒤 자주 쓰던 항목까지 사라집니다. 왜 이런 일이 생기며 항목 크기와 접근 패턴을 반영해 정책을 어떻게 조정하나요?](/tech-interview/questions/lru-cache-policy/)

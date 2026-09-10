---
id: redis-expiry-eviction
title: "Redis 키가 설정한 TTL보다 일찍 사라졌습니다. 만료와 maxmemory eviction의 차이를 어떻게 확인하고 어떤 데이터를 제거해도 되는지 정책을 정하나요?"
answerMinutes: 5
followups: [{"id":"redis-data-types-encoding","prompt":"자료형·원소 크기·큰 키가 만료·eviction과 lazy freeing 비용에 어떤 영향을 주나요?"},{"id":"redis-rdb-aof","prompt":"만료·eviction 상태가 RDB와 AOF 재시작 후 어떻게 보존되거나 재생되는지 무엇을 검증하나요?"},{"id":"lru-cache-policy","prompt":"allkeys·volatile 정책에서 LRU 근사와 실제 접근 빈도가 제거 결과를 어떻게 바꾸나요?"}]
difficulty: 하
category: 데이터베이스
tags: ["Redis","TTL","eviction"]
related: ["lru-cache-policy"]
---

# Redis 키가 설정한 TTL보다 일찍 사라졌습니다. 만료와 maxmemory eviction의 차이를 어떻게 확인하고 어떤 데이터를 제거해도 되는지 정책을 정하나요?

## 구두 답변

TTL 만료는 키에 설정된 시간이 지나 수명이 끝나는 시간 조건이고, eviction은 `maxmemory`에 도달해 정책에 따라 아직 TTL이 남은 키도 제거하는 용량 조건입니다. 따라서 TTL보다 일찍 사라졌다면 eviction, 명시적 DEL, 애플리케이션 오류, 장애 복구·복제 상태를 함께 확인해야 합니다. TTL 시각이 지났다고 모든 키가 그 즉시 삭제되는 것도 아닙니다. Redis는 접근 시 만료를 판단하고 주기적으로 만료 키를 정리하는 방식을 사용합니다.

### 제거 대상과 새 쓰기 거절을 구분합니다

`maxmemory-policy`는 모든 키를 대상으로 할지, TTL이 있는 키만 대상으로 할지, 메모리가 부족할 때 쓰기를 거절할지를 정합니다. `volatile-*` 정책에서 제거할 TTL 키가 부족하면 새 쓰기가 실패할 수 있고, allkeys 정책은 TTL 없는 키도 제거 대상이 될 수 있습니다. 캐시처럼 원본에서 재생성 가능한 데이터와 계정 잔액·세션의 권위 상태를 같은 인스턴스에 두면 eviction이 원본 손실로 이어질 수 있으므로 데이터 분리나 인스턴스 분리를 먼저 검토하겠습니다.

`maxmemory`가 호스트 RSS의 절대 상한은 아닙니다. Redis 객체 외에 복제 backlog, client output buffer, AOF/RDB fork의 copy-on-write, allocator fragmentation이 메모리를 사용합니다. 큰 키를 삭제할 때 해제 작업이 주 실행 경로를 오래 차지할 수 있고 lazy freeing을 켜면 명령 지연은 줄어도 실제 RSS 하락과 백그라운드 작업이 뒤로 밀릴 수 있습니다. 정책 이름만 바꿔 해결됐다고 보지 않겠습니다.

### 수명은 데이터 보존 보장이 아닙니다

캐시는 TTL 만료를 놓쳐도 원본에서 다시 만들 수 있어야 합니다. TTL을 작업 스케줄러나 결제 만료의 유일한 트리거로 쓰면 주기적 정리 지연, 키 손실·eviction, 장애 복구 뒤 이벤트 유실 때문에 업무 규칙이 실행되지 않을 수 있습니다. 중요한 만료 작업은 DB의 상태·예약 시각과 durable queue를 권위로 두고 Redis TTL은 빠른 힌트나 캐시로 제한하겠습니다.

운영에서는 `expired_keys`와 `evicted_keys`, OOM/거절된 쓰기, `used_memory`, RSS, fragmentation, lazyfree 대기, eviction latency를 분리해서 봅니다. 만료 집중과 메모리 압력을 따로 주입하고, TTL이 남은 키가 eviction되는지와 원본 복구가 가능한지 확인합니다. Redis 버전·정책·클라이언트의 TTL 단위와 active expiry 동작도 검증하겠습니다. 결론은 TTL의 수명 상한과 eviction의 손실 정책을 동일시하지 않고, 제거되어도 되는 데이터의 의미를 먼저 정하는 것입니다.

만료와 eviction을 확인할 때 애플리케이션에서 `GET`이 nil이 된 것만으로 원인을 구분할 수 없습니다. Redis 지표·slow log·명령 감사와 키 이벤트 알림의 한계를 함께 보고, 이벤트 알림을 업무 트리거의 유일한 근거로 두지 않겠습니다. eviction 대상이 되는 큰 키는 제거 순간 CPU를 사용해 다른 요청의 p99를 높일 수 있으므로, 큰 값 분할·비동기 삭제·데이터 분리를 정책으로 검토합니다. 원본이 손실된 경우를 가정한 복구 시험도 포함하겠습니다.

## 득점 포인트

- TTL과 eviction을 시간·용량 조건으로 구분한다.
- maxmemory 정책·쓰기 거절·원본 데이터 분리를 설명한다.
- RSS·버퍼·lazy freeing과 실제 손실 가능성을 지표로 본다.

## 감점 포인트

- TTL 전에는 키가 반드시 남는다고 말한다.
- expired와 evicted 지표를 같은 현상으로 본다.
- maxmemory가 프로세스 전체 RSS의 절대 상한이라고 한다.

## 더 파고들 거리

- volatile 정책에서 TTL 키 부족 시 쓰기 결과를 확인해 보세요.
- lazy freeing의 명령 지연과 RSS 하락 시점을 측정해 보세요.
- 중요한 만료 작업을 durable 상태·큐와 분리해 보세요.

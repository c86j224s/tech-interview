---
id: redis-loss-policy
title: Redis 만료·Eviction·메모리 상한의 손실 정책
topic: 데이터베이스
summary: TTL 시간과 용량 제거를 나누고 volatile 후보 부족·noeviction·RSS·lazy free·키 알림·권위 데이터와 캐시 분리를 설명합니다.
questionIds: [redis-expiry-eviction, redis-volatile-no-eligible-key]
---

# Redis 만료·Eviction·메모리 상한의 손실 정책

## TTL과 메모리 eviction에 따른 키 부재 원인

1시간 TTL의 캐시가 10분 만에 없어졌다면 시간 만료 외에 maxmemory eviction·명시 DEL·덮어쓰기·장애 복구를 조사해야 합니다. TTL은 그때까지 반드시 키가 살아 있다는 최소 보관 보장이 아닙니다. Redis의 만료는 접근 시 판정과 주기적 정리 등이 결합되어 물리 삭제가 만료 시각과 정확히 일치하지 않을 수도 있습니다.

GET의 nil 하나로 원인을 구분할 수 없습니다. expired_keys·evicted_keys·쓰기 오류·애플리케이션 변경·복제/재시작 이력을 함께 봅니다.

## 제거 후보와 거절 정책의 구분

| 정책 계열 | 제거 후보 | 한계 |
| --- | --- | --- |
| allkeys 계열 | TTL 없는 key도 포함 가능 | 권위 데이터 손실 가능 |
| volatile 계열 | 만료가 설정된 eligible key | 후보가 부족하면 메모리 증가 쓰기 거절 가능 |
| noeviction | 메모리 확보를 위한 key 제거 안 함 | 상한에서 관련 쓰기 오류 처리 필요 |

volatile 정책인데 대부분 TTL이 없는 큰 key라면 작은 TTL key를 다 지워도 필요한 공간을 확보하지 못해 쓰기가 거절될 수 있습니다. 따라서 이를 allkeys처럼 어떤 key든 지우는 정책으로 이해하면 안 됩니다. 메모리 압박을 재현할 때는 실행 중인 Redis 버전에서 쓰기 명령별 오류와 기존 key의 `GET` 결과를 따로 기록해, 명령·버전별로 쓰기 실패가 읽기까지 같은 방식으로 막는지 확인합니다.

LRU는 최근 사용 시점이 오래된 키를, LFU는 접근 빈도를 근사한 값이 낮은 키를 우선 보는 방식이며, random·TTL 기준의 선택과 샘플링 구현은 서로 다릅니다. 따라서 정책 이름만 보고 전체 키를 정확히 정렬한 LRU나 정확한 누적 사용 횟수에 따른 LFU를 가정하지 말고, 실제 제거 결과를 정책별로 따로 봐야 합니다. 제거되어도 다시 만들 수 있는 캐시와 잔액·멱등 레코드·세션 권위 상태를 같은 손실 정책에 둘지는 먼저 나눠 판단해야 합니다.

```diagram
{"title":"키 부재는 여러 다른 원인에서 올 수 있습니다","caption":"화살표는 key가 없어지는 원인입니다. TTL 설정만 보고 보존을 약속하지 말고 정책·명령·장애 상태를 함께 관찰합니다.","rows":[[{"id":"ttl","label":"시간 만료"},{"id":"memory","label":"용량 eviction"}],[{"id":"missing","label":"GET에서 key 부재"}],[{"id":"recover","label":"원본 재생성 또는 권위 복구"}]],"edges":[{"from":"ttl","to":"missing","label":"만료 정책"},{"from":"memory","to":"missing","label":"TTL 전에도 가능"},{"from":"missing","to":"recover","label":"데이터 종류별 처리"}]}
```

## Maxmemory와 프로세스 RSS 상한의 차이

복제·AOF·client output buffer·allocator fragmentation·fork copy-on-write·자식 프로세스가 추가 메모리를 쓸 수 있습니다. 이 가운데 `maxmemory` 계산에 포함되지 않거나 수명이 다른 영역이 있으므로, `RSS`(운영체제가 프로세스에 실제로 잡아 둔 상주 메모리)와 실제 `INFO`·OS 지표를 함께 확인하고 노드·container 여유를 둬야 합니다.

큰 key 삭제의 해제 CPU가 주 실행을 오래 막을 수 있습니다. UNLINK·lazy freeing 등은 실제 메모리 반환을 뒤로 미루어 즉시 응답 지연을 줄일 수 있지만 lazyfree backlog·peak memory는 남습니다. RSS가 바로 줄지 않았다고 삭제가 실패했다고 단정하지 않습니다.

## TTL 알림과 내구성 있는 Scheduler의 역할 분리

키가 만료되면 반드시 보상을 회수하거나 주문을 취소해야 하는 기능은 durable 상태·예약 시각·재처리 경로가 필요합니다. keyspace notification은 설정·연결·Pub/Sub 유실·실제 만료 처리 시점의 영향을 받아 내구 완료 보장이 아닙니다. eviction이나 명시 삭제로 키가 먼저 사라질 수도 있습니다.

원본 DB의 만료 상태를 권위로 두고 Redis TTL은 cache·빠른 힌트로 사용할 수 있습니다. 멱등 기록에 TTL을 두면 그 기간 뒤 재전달의 중복 방지 보장도 끝날 수 있으므로 원장과 보관 정책을 연결합니다.

## 시간 압력과 메모리 압력의 분리 시험

테스트 인스턴스에서 충분한 메모리의 TTL 만료, TTL이 남은 key의 eviction, volatile 후보 부족, noeviction 쓰기 오류를 분리합니다. key 부재 후 정상 원본 재생성·동시 miss의 진입 상한·권위 상태 복구를 확인합니다.

used_memory·RSS·expired·evicted·OOM 오류·lazyfree·p99를 같이 기록하고 rewrite 중 peak도 별도 봅니다. 현재 작업에서는 Redis eviction 부하를 실행하지 않았습니다. 본문은 손실·재생성·메모리의 계약 설명입니다.

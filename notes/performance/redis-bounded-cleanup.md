---
id: redis-bounded-cleanup
title: Redis Big Key 탐색과 재시작 가능한 정리
topic: 성능
summary: SCAN의 cursor·COUNT·중복·변경 중 보장을 구분하고 big key의 전송/삭제 비용·조건부 삭제·UNLINK·작업 예산을 설명합니다.
questionIds: [redis-bigkey-scan, redis-scan-cleanup-idempotency]
---

# Redis Big Key 탐색과 재시작 가능한 정리

## Key 수와 하나의 Key가 소비하는 비용은 다릅니다

key 100만 개와 field 100만 개를 가진 hash 하나는 다른 문제입니다. big key는 메모리뿐 아니라 전체 조회의 응답 bytes·serialize·network·replica 적용·삭제 시간에 영향을 줍니다. hot key는 접근 빈도 문제이므로 작은 값도 hot할 수 있고 큰 값이 반드시 hot한 것은 아닙니다.

운영 탐색은 느린 명령·명령별 지연·응답 크기·memory usage 표본·자료형별 cardinality로 시작합니다. 전체 값을 가져오는 HGETALL 같은 명령으로 크기를 조사하다 서버와 client를 압박하지 않도록 합니다. MEMORY USAGE의 샘플링 비용·오차도 자료형·옵션에 따라 확인합니다.

## SCAN은 Snapshot이나 페이지 번호가 아닙니다

SCAN cursor는 불투명한 순회 상태입니다. `0`에서 시작해 반환 cursor가 `0`이 될 때 한 순회를 마칩니다. 중간 결과가 비어도 cursor가 0이 아니면 끝이 아닙니다. COUNT는 작업량 힌트이지 결과 수·실행 시간·응답 bytes의 엄격한 상한이 아닙니다. 작은 내부 인코딩의 collection은 한 번에 많이 나올 수도 있습니다.

전체 순회 내내 존재한 원소는 반환된다는 보장이 있지만 중복이 가능하고 순회 도중 추가·삭제된 항목은 반환 여부를 일반적으로 보장하지 않습니다. cursor를 정렬 offset처럼 산술 조작하거나 재시작 후 snapshot 위치로 간주하지 않습니다. cluster는 대상 primary·topology 변화·resharding 범위를 별도로 다룹니다.

| 조건 | 처리 원칙 |
| --- | --- |
| 빈 batch·cursor 비0 | 계속 순회 |
| 중복 key | 재실행해도 안전한 동작 |
| 중단·topology 변화 | 순회 세대 기록·안전한 재시작 |
| 발견 후 값 변경 | 현재 version·owner 조건 재검사 |
| 큰 batch | client bytes·시간 예산도 별도 제한 |

## 발견 시점의 조건으로 나중에 무조건 삭제하지 않습니다

정리 A가 `job:7`의 오래된 version 3을 발견한 뒤 B가 version 4로 갱신하면 A의 늦은 DEL이 새 상태를 지울 수 있습니다. GET 후 DEL도 그 사이 갱신이 끼는 경쟁이 있습니다. 같은 key의 현재 version·owner·업무 만료 조건을 Lua/Function 등 원자적 실행 안에서 확인한 뒤 삭제합니다. Redis Cluster에서는 스크립트가 접근하는 key들의 slot 제약도 맞춥니다.

```diagram
{"title":"발견은 후보 선정이고 삭제는 현재 상태로 결정합니다","caption":"화살표는 정리 흐름입니다. SCAN 시점의 조건을 신뢰하지 않고 원자적 조건 검사를 통과한 현재 데이터만 제거합니다.","rows":[[{"id":"scan","label":"SCAN · 정리 후보"}],[{"id":"check","label":"현재 version·owner·만료 검사"}],[{"id":"delete","label":"일치할 때만 삭제"},{"id":"skip","label":"새 버전이면 건너뜀"}]],"edges":[{"from":"scan","to":"check","label":"중복 가능 후보"},{"from":"check","to":"delete","label":"조건 일치"},{"from":"check","to":"skip","label":"조건 변경"}]}
```

개념적인 원자 구간은 `if current.version == observedVersion and current.expiresAt <= cutoff then UNLINK(key)`입니다. 실제 자료형·누락 필드·version 재사용 방지·기준 시각을 정의해야 합니다. 외부 DB의 최신 권한 상태까지 Redis 스크립트가 원자 확인해 주지는 않습니다.

## UNLINK도 무료 작업은 아닙니다

UNLINK는 keyspace에서 제거하고 적절한 해제를 background로 넘겨 긴 동기 해제 부담을 줄일 수 있습니다. 호출·전파·background 해제 CPU·메모리 잔존은 남습니다. lazyfree pending·RSS·replication 지연을 관찰하고 한 번에 너무 많은 key를 넘기지 않습니다. 삭제 응답이 곧 allocator의 OS 메모리 반환 완료라는 뜻은 아닙니다.

큰 collection을 쪼개면 개별 비용을 줄일 수 있지만 만료·일관성·조회 fan-out·key 관리 비용이 늘어납니다. 목적에 맞는 chunking과 크기 상한을 데이터 생성 시점부터 적용합니다.

## 반복 정리는 횟수보다 최종 상태로 확인합니다

순회 세대·대상 topology·후보/삭제/변경 건너뜀/오류 수·bytes·pause를 기록합니다. 중단 시 cursor만 믿지 말고 안전하게 다시 훑어도 새 데이터를 지우지 않는 조건을 유지합니다. commands/s·pipeline 크기·최대 작업 시간·지연 임계로 throttle하고 운영 peak에서는 중단할 수 있게 합니다.

중복 반환·빈 batch·삭제 직전 갱신·재시작·resharding·lazyfree backlog를 시험합니다. 이 노트는 정리 계약이며 실제 운영 Redis에 탐색이나 삭제를 실행한 결과는 아닙니다.

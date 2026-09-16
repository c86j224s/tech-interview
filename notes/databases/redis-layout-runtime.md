---
id: redis-layout-runtime
title: Redis 자료형·Encoding·명령 실행의 비용
topic: 데이터베이스
summary: JSON 문자열·hash·set의 연산 단위와 encoding 전환·필드 TTL·큰 키·주 실행 경로·I/O thread·보조 작업을 설명합니다.
questionIds: [redis-data-types-encoding, redis-hash-field-expiry-layout, redis-thread-model]
---

# Redis 자료형·Encoding·명령 실행의 비용

## 작은 필드 하나를 바꾸려 전체 JSON을 보낼 수 있습니다

프로필을 JSON 문자열 한 개로 저장하면 전체를 읽기는 쉽지만 필드 하나를 바꿀 때도 문서 전체를 읽고 직렬화해 다시 써야 할 수 있습니다. 예를 들어 두 요청이 같은 문서를 읽은 뒤 한 요청은 이름만, 다른 요청은 알림 설정만 바꾸어 각각 전체 JSON을 저장하면 나중 저장이 앞선 필드 변경을 덮을 수 있습니다. 필드별 갱신이 필요하면 hash, 존재 여부만 필요하면 set, 점수와 순위가 필요하면 sorted set처럼 업무 연산 단위에 맞는 자료형을 선택합니다.

| 표현 | 자연스러운 연산 | 비용·한계 |
| --- | --- | --- |
| String JSON | 전체 문서 read/write | 부분 변경·직렬화·큰 응답 |
| Hash | 필드별 읽기·변경 | 큰 전체 조회·encoding 전환 |
| Set | 존재·중복 없는 집합 | 순서·중복 횟수 별도 |
| Sorted set | score·순위·범위 | 동점·double 정밀도·유지 비용 |
| 여러 독립 key | 개별 TTL·접근 | key 메타데이터·왕복·slot 분산 |

압축 문자열은 메모리·전송을 줄일 수 있지만 CPU·부분 갱신·복구의 다른 비용을 만듭니다. 순서·중복·필드 관계·원자 단위를 먼저 정하지 않고 모든 값을 한 형식으로 넣지 않습니다.

## 논리 자료형과 물리 Encoding은 다릅니다

작은 hash·set은 조밀한 내부 표현을 쓰다가 원소 수·값 길이·설정 임계값을 넘어 다른 구조로 바뀔 수 있습니다. 자료형 이름이 같아도 원소당 메모리와 갱신 p99가 달라지는 이유입니다. 정확한 encoding·threshold는 Redis 버전에서 MEMORY USAGE·OBJECT ENCODING·INFO 등의 지원 도구와 설정으로 확인합니다.

작은 샘플 평균만 보지 말고 최대 필드 길이·원소 수·threshold 직전과 직후·삭제 재삽입을 검사합니다. 메모리 사용은 key·allocator·TTL 메타데이터·복제·출력 buffer까지 포함해 봅니다. 큰 컬렉션 전체를 반환하면 내부 탐색뿐 아니라 전송·client 메모리가 비용입니다.

```diagram
{"title":"자료형 선택은 실행과 전송 비용으로 이어집니다","caption":"화살표는 비용의 연결입니다. 물리 encoding과 명령 범위가 달라지면 메모리·주 실행 시간·응답 바이트가 함께 변합니다.","rows":[[{"id":"need","label":"필드 갱신·집합·정렬 요구"}],[{"id":"type","label":"논리 자료형·키 배치"}],[{"id":"encoding","label":"크기별 실제 encoding"}],[{"id":"cost","label":"명령 CPU·메모리·전송·복제"}]],"edges":[{"from":"need","to":"type","label":"연산 단위"},{"from":"type","to":"encoding","label":"버전·임계값"},{"from":"encoding","to":"cost","label":"실제 부하"}]}
```

## 필드 만료와 여러 키 분리를 버전별로 비교합니다

지원 Redis 버전에는 hash field expiration이 있으므로 “hash에는 필드 TTL이 없다”를 모든 버전의 규칙으로 말하지 않습니다. 서버 명령·client 지원·필드 갱신 시 TTL 유지 또는 제거·parent key TTL과의 관계·반환값을 확인합니다.

여러 key로 나누면 독립 TTL은 직접적이지만 key metadata·왕복·SCAN·Cluster 슬롯·다중 키 원자성 비용이 늘어납니다. hash 안에 두면 한 key 단위 관리가 쉬워도 모든 필드를 자주 읽으면 큰 응답이 됩니다. 원본인지 캐시인지에 따라 손실·재생성 정책을 먼저 정합니다. 필드 TTL은 중요한 업무 만료를 반드시 실행하는 durable scheduler가 아닙니다.

## Redis의 모든 작업이 OS Thread 하나에만 있는 것은 아닙니다

일반 Redis의 주 명령 실행 경로는 명령을 직렬 처리하지만 네트워크 I/O thread·lazy freeing·AOF fsync 등 보조 thread가 존재할 수 있습니다. fork 기반 RDB·AOF rewrite는 별도 자식 프로세스 경로로 동작할 수 있습니다. 버전·설정·모듈의 실제 역할을 확인하고 thread 개수만으로 자료구조 명령이 여러 코어에서 병렬 실행된다고 말하지 않습니다.

긴 Lua·큰 키 삭제·거대한 컬렉션 명령은 다른 client의 짧은 GET까지 지연시킬 수 있습니다. I/O thread를 늘려 네트워크 처리를 줄여도 주 실행의 긴 연산 자체가 사라지는 것은 아닙니다. client connection을 늘리는 것으로 단일 hot key의 실행 병목을 해결할 수도 없습니다.

## 큰 작업을 나누면 원자성과 수명도 바뀝니다

SCAN 계열로 작은 단위 조회를 할 수 있지만 전체가 고정 snapshot이 아니며 중복·변경 중 관찰 계약이 있습니다. 큰 key를 쪼개면 명령 시간을 줄일 수 있어도 다중 key 일관성·slot·메타데이터 비용이 생깁니다. lazy free는 즉시 명령 지연을 줄이는 대신 실제 해제·RSS 변화가 뒤로 밀릴 수 있습니다.

slowlog의 실행 시간과 client가 관찰한 네트워크·queue 대기는 다릅니다. 명령별 호출 수×비용·코어 CPU·latency event·출력 buffer·fork COW·디스크를 같은 시간축으로 봅니다. 주 실행 CPU가 낮아도 client pool이나 네트워크 대기로 느릴 수 있습니다.

## 실제 크기와 배경 작업을 포함해 비교합니다

독립 Redis 테스트 인스턴스에서 작은·큰 필드·encoding 전환·부분 만료·큰 응답·짧은 GET 혼합을 시험합니다. rewrite 중 최대 쓰기율에서 메모리·p99·복제 backlog도 확인합니다. 현재 작업에서는 Redis 서버를 실행하지 않았습니다. 본문은 연산·표현·실행 비용의 설명이며 특정 최신 버전의 성능 수치가 아닙니다.

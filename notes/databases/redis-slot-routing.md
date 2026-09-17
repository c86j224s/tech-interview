---
id: redis-slot-routing
title: Redis Cluster 슬롯·Hash Tag·장애 라우팅
topic: 데이터베이스
summary: Sentinel과 Cluster를 구분하고 hash tag 파싱·최소 원자 단위·hot slot·MOVED/ASK·계정 간 이체·응답 유실을 설명합니다.
questionIds: [redis-sentinel-cluster, redis-cluster-hash-tags, redis-cross-account-transfer-slot]
---

# Redis Cluster 슬롯·Hash Tag·장애 라우팅

## 장애 전환과 키 공간 분산의 요구 분리

Sentinel은 한 데이터셋의 primary·replica를 감시하고 장애 판단·승격·새 primary 발견을 돕습니다. 키를 여러 primary에 나누는 샤딩은 하지 않습니다. Cluster는 키를 16,384 hash slot으로 나누어 여러 primary에 배치하고 replica·승격·client routing을 함께 다룹니다.

한 노드의 메모리·처리량 안에서 failover가 필요한 경우와 여러 노드로 데이터를 분산해야 하는 경우의 선택을 나눕니다. 어느 구성이든 비동기 복제의 보존·지속성·응답 유실·중복 재시도는 별도 계약입니다.

## Hash Tag와 동일 슬롯 배치 단위

일반 키는 CRC16 결과를 슬롯 수로 나눈 나머지로 슬롯을 정하고, hash tag 규칙에 맞는 중괄호 부분이 있으면 그 부분만 해시합니다. 첫 `{` 뒤 첫 `}` 사이가 비어 있지 않을 때만 그 부분을 쓰고, 빈 tag이면 전체 키를 해시하는 규칙을 확인해야 합니다. 키 생성 코드가 만든 실제 키를 cluster-aware client와 서버의 slot 조회 결과로 대조하면 `{acct:42}:balance`와 `{acct:42}:ledger`가 같은 슬롯인지 확인할 수 있습니다.

| 키 예 | 함께 묶을 내용 | 영향 |
| --- | --- | --- |
| `{acct:42}:balance` | 계정 42 잔액 | 같은 tag와 같은 slot |
| `{acct:42}:ledger` | 계정 42 원장 | 다중 key 원자 실행 후보 |
| `{acct:43}:balance` | 다른 계정 | 별도 slot일 수 있음 |
| `{all}:...` | 모든 계정 | 한 slot hotspot·분산 이점 상실 |

같은 슬롯은 일반적인 다중 key 명령·transaction·Lua 실행의 배치 조건입니다. 실제 명령 지원·이동 중 제약은 Redis 버전과 client를 확인합니다. tag 자체가 락·rollback·외부 DB transaction을 만드는 것은 아닙니다.

```diagram
{"title":"한 계정의 원자 단위와 여러 계정 분산을 나눕니다","caption":"화살표는 같은 tag에 따른 슬롯 배치입니다. 서로 다른 계정 간 이체는 이 단일 슬롯 원자 경계 밖일 수 있습니다.","rows":[[{"id":"balance","label":"{acct:42}:balance"},{"id":"ledger","label":"{acct:42}:ledger"}],[{"id":"slot","label":"계정 42의 같은 슬롯"}],[{"id":"operation","label":"짧은 원자 명령·Lua"}]],"edges":[{"from":"balance","to":"slot","label":"tag acct:42"},{"from":"ledger","to":"slot","label":"같은 tag"},{"from":"slot","to":"operation","label":"같은 처리 경계"}]}
```

## 계정 간 이체와 배치·원장 설계

계정 A와 B가 다른 슬롯이면 한 Lua로 두 잔액을 전역 원자 변경할 수 없습니다. 두 키를 한 tag에 넣으면 원자 범위를 넓힐 수 있지만, 그만큼 여러 노드로 분산하는 이점은 잃습니다. 실제 거래 단위별로 두 계정을 함께 배치할 수 있는지와 분산 요구를 비교한 뒤, 권위 DB에서 이체하고 Redis를 projection으로 둘지 또는 예약·보상 상태 머신을 사용할지 요구에 맞춰 선택합니다.

두 슬롯에 차례로 차감·증가하는 코드는 첫 번째 명령 뒤 두 번째 명령 전에 중단되면 한쪽 잔액만 바뀐 상태를 남깁니다. 따라서 계정별 멱등 key와 전역 논리 이체 상태를 저장하고 재처리해야 하며, 보상 작업 자체도 실패할 수 있으므로 이를 일반적인 단일 DB transaction과 같다고 부르면 안 됩니다. 원자 Lua를 사용해도 런타임 오류 때 일반 rollback이나 승격 뒤 보존까지 자동으로 얻는 것은 아닙니다.

## MOVED와 ASK의 라우팅 의미

MOVED는 슬롯의 소유 위치가 다른 곳임을 알려 slot cache를 갱신하게 할 수 있습니다. ASK는 이동 중 임시 목적지에서 해당 요청을 처리하도록 유도하며 ASKING 등 프로토콜 절차가 필요합니다. ASK 하나를 영구 slot 소유 이전으로 캐시하면 잘못될 수 있습니다. 검증된 cluster client를 사용하고 재연결·다중 key·pipeline의 실제 처리 방식을 확인합니다.

Sentinel client는 새 primary 주소를 다시 발견하고 오래된 연결을 처리하는 다른 경로입니다. 어떤 방식이든 timeout은 명령 미실행의 증명이 아닙니다. 동일 요청 key·fingerprint·결과를 확인하고 증분 명령을 무조건 반복하지 않습니다. 복제 승격에서 dedupe 기록까지 잃는 한계는 권위 원장·대사와 연결합니다.

## 키 이름 규칙과 데이터 이전

tag 오타·빈 중괄호·사용자 입력 삽입으로 의도하지 않은 슬롯·키 충돌이 생길 수 있습니다. 허용 형식·길이·인코딩을 정하고 논리 key 생성 함수를 중앙화합니다. tag를 바꾸면 기존 데이터 위치가 달라질 수 있어 새 key·이전 key·동시 쓰기·전환 장벽을 관리해야 합니다.

hot slot은 CPU·메모리·네트워크·긴 script가 한 노드에 몰리는 문제입니다. 전체 cluster 평균보다 slot·primary별 분포와 p99·이체 비율을 봅니다. client 수 증가만으로 hot slot 실행 비용이 줄지는 않습니다.

## 이동·승격·재시도 분리 시험

테스트 cluster에서 같은 tag·다른 tag의 key slot, MOVED·ASK, migration 중 pipeline·명령 오류, 응답 유실을 확인합니다. Sentinel은 별도 감시 quorum·다수 승인·승격 후보·주소 발견을 시험합니다. 현재 작업에서는 Redis Cluster·Sentinel을 실행하지 않았으며 본문은 배치·라우팅·원자 범위의 설명입니다.

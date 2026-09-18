---
id: shard-placement
title: 해시 배치·가상 노드·Rendezvous와 안전한 이동
topic: 분산 시스템
summary: 키 수·바이트·hot key를 나누고 ring·HRW 이동 성질·가중 배치·snapshot/log 장벽·라우팅 세대·escrow 의미를 설명합니다.
questionIds: [hash-sharding-and-resharding, consistent-hash-virtual-nodes, rendezvous-hashing, hot-key-semantic-sharding, shard-snapshot-log-handoff-point]
---

# 해시 배치·가상 노드·Rendezvous와 안전한 이동

샤드 배치의 기본 모델은 키를 노드에 배정하는 함수와 데이터·쓰기 권위를 실제로 옮기는 절차를 분리하는 것입니다. ring이나 Rendezvous가 이동할 키 집합을 계산해 줄 수는 있지만 snapshot·증분 로그·handoff barrier가 완료되기 전에는 새 노드가 최신 데이터를 가진 권위라고 볼 수 없습니다.

## 키 수와 요청 비용 분포

각 shard에 계정 100만 개씩 있어도 한 인기 계정이 대부분의 쓰기를 만들면 CPU·lock은 한 shard에 몰립니다. 값 크기·요청률·연산 비용·상위 key 비중을 각각 봅니다. 많은 키가 몰린 hot shard와 한 key 자체가 뜨거운 hot key는 해법이 다릅니다.

`hash(key) mod N`에서 N이 바뀌면 많은 key의 목적지가 바뀔 수 있습니다. consistent hashing·논리 bucket·rendezvous는 이동 범위를 줄일 수 있지만 실제 데이터 복사와 쓰기 권위 전환을 없애지는 않습니다.

배치 선택 전에 workload를 키 수, 값 바이트, 요청률, 연산 비용, hot key 비중으로 분해합니다. 키 개수가 균등해도 바이트나 lock 경합이 균등하지 않을 수 있으며, 한 hot key를 여러 shard에 나누는 순간에는 단순 배치 알고리즘이 아니라 잔액·중복 제거·순서 같은 도메인 불변식을 먼저 정해야 합니다.

## Ring 가상 노드와 범위 분산

물리 노드 하나를 ring 한 위치에만 두면 우연히 긴 해시 구간을 맡을 수 있습니다. 여러 가상 위치로 나누면 작은 범위들이 평균화되어 키 분포를 개선하고 이동 단위를 줄일 수 있습니다. 용량이 큰 노드에 더 많은 범위를 줄 수도 있습니다.

가상 노드 수를 늘려도 한 key의 요청이 여러 권위 노드로 자동 분할되는 것은 아닙니다. metadata·rebalance 관리·복제 위치·데이터 이동 비용도 늘 수 있습니다. 균등 해시의 통계적 기대와 실제 workload 바이트·CPU 분포를 구분합니다.

## Rendezvous의 Key·Node 점수와 최대값 선택

안정된 인코딩으로 H(key,nodeID)를 계산하고 가장 큰 점수의 노드를 선택합니다. 같은 점수는 안정 node ID 등 결정적 tie-breaker로 정합니다. 단순 구현의 조회 비용은 후보 N개에 O(N)이며 노드가 많으면 논리 bucket·캐시·계층화 비용을 비교합니다.

| 변경 | 유지되는 배정 | 움직이는 배정 |
| --- | --- | --- |
| node D 추가 | D보다 기존 최고 점수가 큰 key | D가 새 최고인 key |
| node B 제거 | 원래 다른 node를 선택한 key | B를 선택했던 key가 다음 후보로 |
| node ID 변경 | 다른 모든 입력이 같은 범위 | 사실상 제거+추가 영향 |

균일한 무가중 hash에서는 노드 수가 `N`일 때 한 key가 각 노드에 갈 기대 비율을 `1/N`으로 볼 수 있지만, 실제 값 크기·요청률과 용량 가중치는 별도로 측정해야 합니다. 가중치가 있으면 단순히 점수에 가중치를 곱한 결과를 원하는 배치 비율로 해석하지 말고, 사용하는 weighted HRW 구현의 점수 계산과 tie-break 규칙으로 샘플 key를 배치해 비율과 이동량을 확인합니다. 여러 상위 후보를 replica로 고르는 단계는 복제 commit이나 읽기 일관성을 결정하지 않습니다.

```diagram
{"title":"배치 선택과 데이터 권위 전환은 다른 단계입니다","caption":"화살표는 증설의 순서입니다. 해시 알고리즘이 새 목적지를 정해도 그 목적지에 최신 데이터와 쓰기 권한이 준비되어야 합니다.","rows":[[{"id":"placement","label":"새 노드 집합·배치 계산"}],[{"id":"copy","label":"snapshot·변경 로그 이동"}],[{"id":"barrier","label":"최종 적용 장벽 검증"}],[{"id":"owner","label":"라우팅·쓰기 세대 전환"}]],"edges":[{"from":"placement","to":"copy","label":"이동 범위 선택"},{"from":"copy","to":"barrier","label":"동시 쓰기·삭제 포함"},{"from":"barrier","to":"owner","label":"현재 권위 게시"}]}
```

## Snapshot·증분 로그의 공통 기준점

일관된 source snapshot과 그 이후 변경을 재생할 위치를 함께 확보합니다. snapshot 복사 동안 write·delete·재삽입이 생겨도 로그가 보존되어 대상에 이어져야 합니다. 증분 version=12를 먼저 적용했는데 늦은 snapshot version=10이 덮지 않도록 적용 순서 또는 원자 version 조건을 둡니다.

handoff 직전에는 건수만 세지 말고 값·삭제 기록·참조·원본 version·논리 효과를 source와 target에서 대조해, target이 최종 barrier까지 실제로 적용했는지 확인합니다. 그 확인이 끝난 뒤에만 writer와 router generation을 새 값으로 전환하고, 옛 router cache·진행 중 transaction·재시도는 이전 generation을 들고 남을 수 있습니다.

옛 shard와 저장소가 그 generation을 비교해 쓰기를 거절하거나 정해진 경로로 안내해야 하며, 라우터에서만 token을 검사하고 저장소가 무조건 쓰면 오래된 쓰기를 막지 못합니다.

## Hot Key 분할과 데이터 의미 조건

독립 통계는 부분 counter·중복 제거·병합으로 나눌 수 있지만 잔액 10을 두 shard가 각각 보고 8씩 차감하면 전역 하한을 깨뜨립니다. 권리를 미리 나눈 escrow·예약 또는 단일 권위 직렬화가 필요할 수 있습니다. 읽기 cache·replica로 hot read를 분산하는 것과 조건부 write 원자성은 다릅니다.

복사·재구축 트래픽이 정상 사용자 I/O를 침범하지 않게 속도·동시성·메모리 상한을 둡니다. key 직렬화·Unicode·숫자 표현·hash·node ID·membership version이 모든 client에서 같아야 배정이 일치합니다. 언어의 프로세스별 임의 hash를 영구 라우팅 함수로 쓰지 않습니다.

## Rollback과 새 쓰기 이후 역전환 프로토콜

대상에서 새 정상 변경을 받은 뒤 옛 원본으로 즉시 돌아가면 그 변경을 잃습니다. 역동기화·새 barrier·현재 권위 전환 또는 전진 복구를 정합니다. 원본 삭제는 옛 독자·backfill·복구 보관·개인정보 정책을 확인한 뒤 수행합니다.

시험은 node 추가·삭제의 이동 집합, hot key·값 편중, snapshot 중 변경·삭제, 옛 routing·pause worker·rollback을 포함합니다. 본문은 배치와 이동 설계이며 실제 sharded DB를 이전한 결과는 아닙니다.

실패 진단은 (1) 같은 입력이 모든 client에서 같은 목적지를 계산하는지, (2) target이 snapshot 이후 log와 delete를 모두 적용했는지, (3) barrier 이후 늦은 이전 generation write를 거절하는지, (4) 역전환 때 새 변경을 보존하는지 순서대로 확인합니다. 예상 결과는 node 추가 시 일부 key만 이동하고, handoff 중 변경은 최종 barrier에 포함되며, rollback은 옛 원본을 덮어써서 새 변경을 잃지 않는 것입니다.

---
id: object-erasure-repair-tradeoffs
title: Object storage Erasure Coding 복구 비용
topic: 저장소
summary: >-
  k 데이터 조각과 m parity 조각의 저장 절감·장애 허용·부분 읽기·degraded read와 repair traffic의
  trade-off를 계산합니다.
questionIds: []
prerequisites:
  - object-publication
  - consensus-quorum
related:
  - volume-recovery
  - shard-placement
reviewedAt: '2026-09-19'
---
# Object storage Erasure Coding 복구 비용

Erasure coding은 한 객체를 `k`개의 data shard와 `m`개의 parity shard로 인코딩해 충분한 조각이 남으면 원본을 복구하는 방식입니다. 이 장에서 “임의의 `k`개가 남으면 복구”라고 계산하는 부분은 MDS/RS 계열 또는 해당 Ceph plugin/profile이 그 성질을 보장한다는 명시적 전제 아래의 모델입니다. 모든 erasure code가 같은 복구 집합을 제공한다고 일반화하지 않습니다. 복제처럼 객체 전체를 여러 번 보관하는 대신 parity를 추가하므로 저장 overhead를 낮출 수 있지만, 장애 중 읽기와 복구에는 계산·네트워크·쓰기 비용이 생깁니다. 더 중요한 전제는 shard가 실제로 독립적인 failure domain에 배치되어야 한다는 것입니다. 수학적으로 `m`개 손실을 견딜 수 있어도 그 shard들이 한 rack에 몰리면 rack 하나의 장애로 복구 불능이 될 수 있습니다.

## k+m 구조와 저장 overhead

각 stripe의 원본 데이터를 `k`등분하고 parity를 `m`개 만들면 전체 저장량은 원본 대비 `(k+m)/k`입니다. 예를 들어 `k=6, m=3`이면 9개 shard를 저장하고 6개만 남아도 복구할 수 있으므로 최대 3 shard 손실을 수학적으로 허용합니다. overhead는 `9/6=1.5`, 즉 원본보다 50% 많습니다. 3복제라면 같은 데이터를 3개 보관해 200% 추가 공간을 쓰는 모델이므로, erasure coding은 저장 효율을 얻는 대신 복구 경로가 복잡해집니다.

이 계산은 한 stripe가 같은 크기의 shard로 분할되고 coding profile이 정상 동작한다는 전제입니다. 작은 객체의 padding, metadata, checksum, coding plugin, alignment, failure domain별 배치 제약은 실제 overhead를 바꿀 수 있습니다. Ceph 문서는 profile의 `k/m`과 overhead, degraded read와 recovery 고려사항을 설명하지만 특정 Ceph release와 모든 profile의 기본값을 이 장에 일반화하지 않습니다.

## 복구 방정식과 손실 수

`k=6, m=3`의 MDS/RS 프로파일에서 data shard D2와 parity shard P1이 사라졌다고 하겠습니다. 남은 7개 중 profile이 허용하는 6개를 읽어 coding matrix를 역연산하면 사라진 조각을 재생성할 수 있습니다. 3개가 모두 사라져도 남은 6개가 정확히 남아 있다면 이 수학 모델의 복구 경계 안입니다. 다른 plugin이나 release에서는 필요한 조각 집합과 overwrite/recovery 조건을 문서로 고정해야 합니다. 그러나 4개가 사라지면 남은 조각이 5개뿐이어서 그 stripe 전체를 복구할 수 없습니다.

복구 가능 여부와 서비스 품질은 분리해야 합니다. 하나의 data shard만 없어도 요청된 범위의 바이트를 읽으려면 여러 shard를 조합해야 할 수 있고, 전체 object를 복구하려면 모든 stripe를 순회해야 합니다. read가 성공하더라도 missing shard를 그대로 두면 다음 장애 때 여유가 줄어듭니다. degraded read는 availability를 잠시 유지하고 repair는 다음 장애 위험을 낮추는 서로 다른 예산입니다.

```diagram
{"title":"degraded read와 background repair의 분리","caption":"빠른 응답은 남은 shard로 즉시 재구성할 수 있지만, 복구된 바이트를 새 shard로 쓰는 작업은 별도의 repair 단계입니다. 읽기 성공이 repair 완료를 뜻하지 않습니다.","rows":[[{"id":"healthy","label":"정상 shard 집합","detail":["k data + m parity"]}],[{"id":"missing","label":"shard 손실","detail":["data 또는 parity"]}],[{"id":"read","label":"degraded read","detail":["여러 shard 읽기·decode"]}],[{"id":"repair","label":"background repair","detail":["새 shard 기록·검증"]}],[{"id":"normal","label":"정상 read path","detail":["다음 장애 여유 회복"]}]],"edges":[{"from":"healthy","to":"missing","label":"device·node failure"},{"from":"missing","to":"read","label":"요청 즉시 재구성"},{"from":"missing","to":"repair","label":"복구 작업 예약"},{"from":"repair","to":"normal","label":"checksum·배치 검증"}]}
```

## degraded read의 latency 경로

`k=4, m=2`에서 data shard 하나가 없어졌다고 하겠습니다. 원본 일부를 읽으려면 남은 data·parity 중 적어도 4개를 읽어 missing data를 재구성해야 합니다. 정상 경로가 필요한 1~2개 shard만 읽던 것이라면 degraded 경로는 fan-in, 네트워크 왕복, decode CPU, 느린 shard의 tail latency를 추가합니다. 요청이 객체 전체가 아닌 작은 range 하나만 요구해도 coding layout과 stripe 경계 때문에 여러 shard를 건드릴 수 있습니다.

부분 읽기에서는 “몇 개 shard를 읽었는가”만으로 충분하지 않습니다. range가 stripe 하나에 걸리는지, shard가 서로 다른 host·zone에 있는지, 네트워크가 병렬화되는지, backend queue가 공유되는지 봅니다. 한 shard가 느릴 때 모든 읽기가 그 shard를 기다리는 구조라면 p99가 장애 상태에서 크게 악화될 수 있습니다. caching이나 작은 object 예외가 있으면 실제 경로를 별도로 측정합니다.

repair traffic은 degraded read마다 필요한 read traffic과 다릅니다. background repair가 object를 처음부터 다시 읽어 missing shard를 만들면 `k`개 이상의 shard를 읽고, 새 조각을 기록하며, checksum과 durable commit을 확인할 수 있습니다. 동시에 너무 많은 object를 repair하면 정상 read와 backend I/O를 경쟁하므로 repair concurrency와 bandwidth cap을 둡니다.

## failure domain과 placement

`k=6,m=3`인 9개 shard를 3개 rack에 배치하는 예를 보겠습니다. Rack A에 6개, Rack B에 2개, Rack C에 1개가 있으면 Rack A 장애 뒤 남은 shard는 3개뿐입니다. 수학적 `m=3`을 계산했지만 6개가 필요하므로 복구할 수 없습니다. 반대로 각 rack에 3개씩 놓으면 rack 하나 장애 뒤 6개가 남아 수학적 경계 안에 들어옵니다. 다만 같은 rack 안의 device 장애, zone 장애, power domain 장애는 다시 다른 모델입니다.

placement는 단순한 노드 수가 아니라 failure domain의 상관을 모델링합니다. 같은 chassis, top-of-rack switch, zone, maintenance batch가 동시에 실패할 수 있으면 서로 다른 노드라는 사실만으로 독립성을 증명하지 못합니다. coding profile과 placement rule이 충돌해 원하는 분산이 실제로 유지되는지, rebalance 뒤 shard가 한 domain에 몰리지 않는지 점검합니다.

## 저장 효율과 복구 시간의 trade-off

k를 키우면 같은 m에 대한 overhead `m/k`가 낮아지지만, 작은 범위 읽기와 복구 때 더 많은 shard 조정이 필요할 수 있습니다. m을 키우면 허용 손실 수가 늘지만 저장량·쓰기·repair 계산이 증가합니다. 큰 k와 m이 항상 throughput을 높이지 않으며, object size보다 shard 크기가 너무 작으면 metadata와 network request가 상대적으로 커질 수 있습니다.

복구 시간을 계산할 때는 단일 object의 decode 시간뿐 아니라 장애가 난 동안 생성되는 새 write를 포함해야 합니다. 백그라운드 repair가 write rate보다 느리면 degraded object 수가 쌓이고, 두 번째 장애가 복구 전에 발생할 위험이 올라갑니다. “repair queue가 비어 있다”와 “모든 shard가 검증된 정상 상태”도 구분합니다. 복구 완료 표시는 새 shard durable write, checksum, placement, 원본 version을 확인한 뒤에만 만듭니다.

## 구현 선택과 복구 우선순위

object 크기와 접근 패턴이 제각각이면 작은 object를 별도 복제하고 큰 object에 coding을 적용하는 정책을 검토할 수 있지만, profile별 보존·복구·비용 계약이 복잡해집니다. 읽기가 매우 빈번한 hot object는 degraded state에서 계속 decode하는 것보다 빠른 복구나 임시 replica가 더 나을 수 있습니다. 반대로 저접근 아카이브는 저장 overhead 절감이 repair latency보다 중요할 수 있습니다.

우선순위는 데이터 중요도, 다음 장애까지 남은 여유, 최근 access, repair cost, failure domain의 위험을 함께 봅니다. repair를 실패한 장비 하나에만 의존하지 않고 placement를 다시 계산합니다. 외부 metadata DB에 “정상”이라고 써 둔 것만으로 실제 shard의 checksum이나 version이 일치한다고 보지 않습니다.

## 실패 경계와 운영 검증

검증 시나리오는 `k=6,m=3`의 device 1·3·4개 손실, rack 하나 손실, degraded range read, repair 중 추가 장애, slow shard와 queue 포화입니다. 각 경우 응답 가능성, read latency, repair backlog, 남은 유효 shard 수를 별도로 기록합니다. 실제 Ceph cluster를 이 문서에서 실행하지 않았으므로 예시 계산은 설명용이며 특정 plugin의 결과를 성공으로 주장하지 않습니다.

검증에는 object checksum, shard version, placement domain, read-after-repair byte equality를 포함합니다. 손실 직후 old shard가 늦게 돌아오면 새 repair 결과와 충돌할 수 있으므로 generation/fencing 규칙도 필요합니다. 복구된 조각을 기록했다고 원래 metadata pointer가 자동으로 새 조각을 선택하는 것도 아닙니다.

## 참고자료와 근거 범위

Ceph의 Erasure Code 문서는 profile의 data/coding chunk, overhead, degraded read와 recovery 조건이 plugin/profile 및 release에 따라 달라질 수 있음을 설명하는 주요 근거입니다. 정확한 “임의의 k개” 복구 주장은 대상 profile의 coding contract를 확인한 뒤에만 사용합니다. 참고 URL: https://docs.ceph.com/en/latest/rados/operations/erasure-code/. 이 장의 `(k+m)/k`와 rack-loss 계산은 MDS/RS형 profile을 가정한 설명용 산술이며 실제 cluster 실행 결과가 아닙니다.

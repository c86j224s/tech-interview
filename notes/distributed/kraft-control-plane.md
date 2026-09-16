---
id: kraft-control-plane
title: KRaft Metadata 합의와 사용자 Partition 복제
topic: 분산 시스템
summary: controller quorum·broker ISR의 다른 권위를 나누고 control plane 손실·combined 자원 경합·metadata churn·ID와 로그 복구를 설명합니다.
questionIds: [kafka-kraft-role, kraft-combined-resource-contention, kraft-metadata-change-load, kraft-quorum-broker-recovery-order]
---

# KRaft Metadata 합의와 사용자 Partition 복제

## Controller 로그에는 모든 사용자 메시지가 들어가지 않습니다

KRaft controller quorum은 topic·partition 구성·broker 등록·leader 배치 같은 metadata를 Raft 계열 로그로 관리합니다. broker는 할당된 사용자 partition의 실제 records를 저장·복제합니다. metadata 로그와 사용자 데이터 로그는 다른 상태와 참여 집합을 가집니다.

controller 수를 늘린다고 주문 topic의 replication factor가 늘어나지 않습니다. controller metadata commit이 consumer의 DB 반영을 확인하는 것도 아닙니다.

| 계층 | 권위 상태 | 주요 관측 |
| --- | --- | --- |
| KRaft controller quorum | metadata·등록·배치 | term·quorum lag·commit·controller 지연 |
| 사용자 partition | record·leader epoch·ISR·HW | produce ACK·ISR·replica lag·leader 전환 |
| consumer group | assignment·offset | rebalance·committed·poll |
| 외부 앱 | 처리 원장·업무 효과 | inbox·outbox·version·사용자 결과 |

## 과반 손실과 Data Leader 손실의 영향을 나눕니다

controller quorum이 동작하지 않거나 과반을 구성할 수 없어도 이미 leader·metadata·연결을 가진 broker의 기존 데이터 요청은 한동안 처리될 수 있습니다. 그러나 topic 변경·broker 등록·새 leader 선택 같은 제어 작업은 막힐 수 있습니다.

그 상태에서 data leader까지 장애 나면 controller가 새 leader를 정하지 못해, 이전에는 살아 있던 데이터 경로도 더 큰 가용성 문제로 이어질 수 있습니다. 따라서 control plane 손실을 모든 요청의 즉시 중단이나 데이터 경로와 영원히 무관한 사건으로 단정하지 않습니다.

data leader 장애에서는 RF(replication factor, 복제본 수)와 ISR(in-sync replicas, 동기화된 복제본 집합)을 먼저 봅니다. producer의 acks와 min ISR는 쓰기를 어느 복제 확인 상태에서 받아들일지에 영향을 주고, eligible leader와 unclean policy는 장애 시 leader 후보로 허용되는 복제본 범위에 관여하므로 ISR 밖 복제본 허용 여부와 의미를 Kafka 버전·설정별로 확인합니다.

그래서 KRaft controller 과반과 사용자 partition ISR은 이름이 비슷해도 서로 다른 권위와 숫자 규칙이며, 실제 Kafka 버전의 ELR 등 leader 선택 정책도 따로 확인해야 합니다.

```diagram
{"title":"Metadata 결정과 사용자 Record 복제는 다른 경로입니다","caption":"화살표는 제어와 데이터 흐름입니다. controller가 배치를 정해도 사용자 record는 broker partition에 저장되며 각 확인 범위가 다릅니다.","rows":[[{"id":"controller","label":"KRaft controller quorum","detail":["metadata 합의"]}],[{"id":"broker","label":"broker·partition leader","detail":["사용자 record append"]}],[{"id":"replica","label":"partition replicas","detail":["ISR·복제 진행"]}]],"edges":[{"from":"controller","to":"broker","label":"등록·할당·leader 제어"},{"from":"broker","to":"replica","label":"사용자 데이터 복제"}]}
```

## Combined Mode는 운영을 단순화하며 자원을 공유합니다

같은 프로세스·노드에 controller와 broker를 함께 두면 배포 단위는 줄지만 사용자 데이터의 disk I/O·GC(garbage collection)·CPU·네트워크가 metadata 합의 자원과 같은 몫을 놓고 경쟁할 수 있습니다. 예를 들어 produce 부하가 큰 동안 topic 변경이나 broker 장애를 일으키면, controller 응답 시간과 quorum lag를 데이터 요청 p99와 따로 기록합니다.

그래야 metadata 합의가 늦어진 것과 사용자 record 처리 자체가 늦어진 것을 섞어 판단하지 않습니다.

역할 분리는 독립 CPU·메모리·disk·장애 영역을 주기 쉽지만 별도 노드와 운영 비용이 있습니다. 소규모 실험과 중요한 production의 선택은 실제 Kafka 버전 권장·복구 목표에 맞춥니다. 프로세스를 분리했다고 같은 rack·disk·네트워크의 공통 장애가 사라지는 것도 아닙니다.

## Topic과 Partition의 잦은 변경도 부하입니다

사용자 produce TPS가 낮아도 많은 작은 topic·partition 생성·삭제·설정 변경·broker churn은 metadata 로그·controller 상태·전파·복구 비용을 만듭니다. 생성률·객체 수·metadata 적용 지연·controller CPU·disk·heap을 데이터 처리량과 별도 계측합니다.

변경 예산·할당량·batch 정책·불필요한 churn 감소를 적용하고 임계값을 버전별로 확인합니다. 읽기·쓰기 권한을 좁혀 임의 앱이 무한 topic 생성으로 제어 경로를 압박하지 않게 합니다. 증설도 key routing·retention·consumer 비용의 별도 변경입니다.

## 복구는 Cluster ID와 두 로그의 관계를 보존합니다

metadata quorum과 data broker가 함께 중단되면 cluster ID·node ID·metadata log/snapshot·data directory를 보존하고 지원되는 복구 절차로 권위를 회복합니다. 임의 새 cluster ID·storage format으로 초기화한 뒤 옛 데이터를 정상 복구했다고 부르면 안 됩니다.

metadata 권위가 돌아온 뒤 broker 등록·partition 할당·실제 log·leader epoch·ISR·HW가 일치하는지 확인합니다. 성공 ACK 받은 record와 불확정 produce를 구분하고 consumer offset·외부 원장도 대조합니다. 정상 노드 재시작과 과반 영구 손실의 강제 복구는 다른 승인·손실 계약입니다.

## 분리 장애 뒤 조합 장애를 검증합니다

격리 테스트에서 controller 과반 손실만, data leader 손실만, metadata churn과 produce 부하, 둘의 동시 복구를 순서대로 시험합니다. 제어 API와 기존 데이터 요청·새 leader 전환·복구 레코드·consumer 효과를 각각 기록합니다. 현재 작업에서는 Kafka KRaft를 실행하지 않았습니다. 본문은 제어·데이터 plane의 책임과 검증 설계입니다.

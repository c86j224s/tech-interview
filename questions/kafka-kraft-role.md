---
id: kafka-kraft-role
title: "Kafka에서 컨트롤러 노드 장애와 데이터 파티션 리더 장애가 각각 발생했습니다. KRaft의 합의와 파티션 복제는 어떤 상태를 관리하며 어떻게 역할이 다른가요?"
answerMinutes: 5
followups: [{"id":"kafka-acks-isr","prompt":"data leader 장애에서 ISR과 min ISR이 생산을 어떻게 제한하나요?"},{"id":"raft-log-commit-apply","prompt":"controller metadata log의 commit·apply와 사용자 partition 복제를 어떻게 비교하나요?"},{"id":"consensus-quorum-failure","prompt":"controller quorum 과반을 잃은 한 노드가 metadata를 독자 확정하면 안 되는 이유는 무엇인가요?"}]
difficulty: 중하
category: 분산 시스템
tags: ["Kafka","KRaft","메타데이터"]
related: ["raft-log-commit-apply","kafka-acks-isr"]
---

# Kafka에서 컨트롤러 노드 장애와 데이터 파티션 리더 장애가 각각 발생했습니다. KRaft의 합의와 파티션 복제는 어떤 상태를 관리하며 어떻게 역할이 다른가요?

## 구두 답변

KRaft의 controller quorum은 Kafka metadata를 Raft 계열 로그로 합의합니다. topic·partition 구성, broker 등록, partition leader 배치 같은 제어 상태를 관리하고, broker는 사용자 record가 있는 partition을 저장·복제합니다. controller metadata log와 사용자 data log는 참여자와 장애 경계가 다릅니다.

### 두 장애를 나눈다

controller quorum이 과반을 잃으면 topic 변경·새 leader 선출 같은 제어 작업이 실패하거나 지연될 수 있지만 이미 배치된 partition 데이터 경로가 모두 멈춘다고 단정하지 않습니다. data leader 장애는 ISR·replication factor·acks·unclean election에 따라 생산과 전환이 달라집니다. controller가 leader를 지정하는 것과 broker가 record를 복제하는 것은 별개입니다.

combined mode는 단순하지만 자원·장애를 공유하고, 분리 배치는 관측과 자원 비용이 다릅니다. controller quorum과 partition ISR은 서로 다른 참여 집합입니다. controller metadata ACK나 partition 생산 ACK가 consumer·외부 DB 효과까지 보장하지 않습니다.

검증은 controller quorum 손실, data leader 손실, ISR 축소, metadata 변경 중 broker 장애를 나눠 topic 제어·leader 전환·복구 레코드·consumer 효과를 기록합니다.

### 제어 로그와 사용자 로그의 경계

controller가 topic의 partition을 추가하는 결정을 metadata log에 확정해도 그 topic의 사용자 레코드가 controller에 저장되는 것은 아닙니다. broker는 할당된 partition의 리더·follower 역할로 데이터를 복제합니다. controller quorum의 term·commit 위치와 데이터 partition의 leader epoch·ISR·high watermark는 별도의 상태입니다. 같은 로그라는 단어를 쓰더라도 무엇의 권위를 정하는지 먼저 구분해야 합니다.

controller 과반이 없어도 기존 리더와 연결이 유지된 일부 데이터 요청은 한동안 처리될 수 있습니다. 하지만 새 리더 선택, broker 등록, 구성 변경 같은 제어 작업은 제한되므로 데이터 리더 장애가 추가되면 영향이 커질 수 있습니다. 모든 요청이 즉시 정지한다고도, 데이터 plane은 영원히 영향을 안 받는다고도 단정하지 않고 실제 버전과 구성의 장애 동작을 확인하겠습니다.

### 배치와 복구를 분리합니다

controller와 broker를 같은 프로세스에 두는 combined mode는 소규모 구성에서 단순하지만 대규모 데이터 I/O가 metadata 합의의 응답을 늦출 수 있습니다. 역할을 분리하면 독립된 CPU·메모리·디스크 예산과 장애 영역을 주기 쉽지만 노드와 운영 비용이 늘어납니다. controller를 늘리는 일이 사용자 topic의 replication factor를 늘리는 일은 아닙니다.

복구에는 metadata 로그와 사용자 로그의 상태를 둘 다 보존해야 합니다. 클러스터 ID·노드 ID·저장 디렉터리를 임의로 새로 만들면 기존 데이터가 있어도 원래 클러스터의 정상 복구가 아닐 수 있습니다. 지원되는 구성 변경·스냅샷·복구 절차를 따르고, metadata quorum 복구 후 broker 할당과 실제 partition 데이터가 일치하는지 확인합니다.

관측은 제어 요청 실패율과 metadata lag, 데이터 생산·소비 지연과 ISR 축소를 나눕니다. 두 종류의 장애를 따로 주입한 뒤 조합해서 시험하면 control plane 장애가 기존 요청에는 드러나지 않다가 리더 변경 순간 가용성 문제로 나타나는 경로를 찾을 수 있습니다.

## 득점 포인트

- metadata 합의와 data replication을 분리한다.
- 두 장애의 영향 범위를 나눈다.
- ISR·acks로 data durability를 검증한다.
- combined mode 비용을 설명한다.

## 감점 포인트

- KRaft가 모든 사용자 record를 직접 commit한다.
- controller와 broker 장애를 같게 본다.
- metadata ACK가 외부 효과를 보장한다.

## 더 파고들 거리

- combined 자원 경합
- metadata 변경 부하
- quorum 복구 순서

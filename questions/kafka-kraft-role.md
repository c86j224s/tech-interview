---
id: kafka-kraft-role
title: "KRaft 컨트롤러 쿼럼의 합의와 Kafka 데이터 파티션의 복제·ACK는 어떤 상태를 각각 결정하나요?"
difficulty: 중하
category: 분산 시스템
tags: ["Kafka","KRaft","메타데이터"]
related: ["raft-log-commit-apply","kafka-acks-isr"]
---

# KRaft 컨트롤러 쿼럼의 합의와 Kafka 데이터 파티션의 복제·ACK는 어떤 상태를 각각 결정하나요?

## 구두 답변

KRaft는 Kafka 클러스터의 메타데이터를 관리하는 controller quorum(브로커·topic·partition 구성을 함께 결정하는 컨트롤러 집합)이 Raft 계열 로그 합의를 사용하는 구성입니다. controller는 어떤 broker가 어떤 partition의 리더인지 같은 클러스터 구성을 결정하고, broker는 그 구성을 받아 사용자 레코드를 저장·복제합니다. 따라서 controller의 제어 로그와 사용자 데이터 partition의 복제 로그는 참여자와 역할이 다릅니다.

예를 들어 controller quorum이 과반을 잃으면 topic 생성이나 새 리더 선출 같은 제어 작업이 영향을 받을 수 있습니다. 그러나 이미 배치된 partition의 데이터 경로가 같은 순간 모두 멈춘다고 단정할 수는 없습니다. 반대로 data leader가 장애를 일으키면 해당 partition의 ISR(In-Sync Replicas, 리더를 따라가 동기화된 복제본 목록)과 `acks`(생산 성공 응답을 언제 보낼지 정하는 조건)에 따라 쓰기와 리더 전환이 달라집니다. 두 장애를 같은 “Kafka 합의 장애”로 부르면 원인과 복구 순서를 잘못 잡게 됩니다.

운영에서는 controller와 broker의 CPU·디스크·네트워크·메타데이터 적용 지연을 따로 관찰합니다. 사용자 데이터 내구성은 replication factor(설정상 복제본 수), ISR, `acks`, unclean leader election(뒤처진 복제본도 리더로 올리는 정책)으로 검증하고, KRaft의 역할을 controller와 broker가 나눠 갖는지 같은 노드에 함께 갖는지도 확인합니다. controller 과반 손실과 data leader 손실을 각각 주입해 생성·리더 전환·메타데이터 변경·복구 결과를 따로 기록하겠습니다.

## 득점 포인트

- KRaft가 관리하는 메타데이터와 데이터 partition 복제를 구분한다.
- 컨트롤러 과반 손실과 데이터 리더 장애의 영향을 나눈다.
- 내구성 검증에 acks·ISR을 별도로 연결한다.

## 감점 포인트

- KRaft의 Raft 쿼럼이 모든 사용자 레코드를 직접 커밋한다고 말한다.
- 컨트롤러와 broker의 자원·장애 범위를 동일시한다.
- Kafka 버전과 controller/broker 역할 구성을 무시한다.

## 더 파고들 거리

- controller와 broker를 같은 노드에 두는 combined mode의 운영 비용은 무엇인가요?
- 메타데이터 변경이 빈번할 때 controller 디스크와 네트워크에 어떤 부하가 생기나요?
- controller quorum 복구와 일반 broker 재시작의 검증 순서는 어떻게 다를까요?

---
id: "kraft-quorum-broker-recovery-order"
title: "Kafka metadata quorum과 데이터 broker가 함께 중단됐습니다. ID·로그·할당을 어떤 순서로 복구 검증하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","KRaft","메타데이터","심화 질문"]
related: ["kafka-kraft-role","raft-log-commit-apply","kafka-acks-isr"]
promotedFrom: {"id":"kafka-kraft-role","prompt":"quorum 복구 순서"}
---

# Kafka metadata quorum과 데이터 broker가 함께 중단됐습니다. ID·로그·할당을 어떤 순서로 복구 검증하나요?

## 구두 답변

클러스터 ID·노드 ID·metadata quorum의 내구 로그를 보존하고 지원되는 복구 절차로 권위를 회복합니다. 데이터 broker의 partition 로그와 metadata 할당이 일치하는지 이어서 검증합니다.

임의로 새 storage format이나 cluster ID를 만들어 원래 복구처럼 취급하지 않습니다. 성공 응답된 레코드·ISR·새 leader와 consumer 처리를 대조합니다. 제어 경로 복구와 실제 사용자 데이터 가용성은 별도입니다.

## 득점 포인트

- 클러스터 ID·노드 ID·metadata quorum의 내구 로그를 보존하고 지원되는 복구 절차로 권위를 회복합니다. 데이터 broker의 partition 로그와 metadata 할당이 일치하는지 이어서 검증합니다.
- 제어 경로 복구와 실제 사용자 데이터 가용성은 별도입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 클러스터 ID·노드 ID·metadata quorum의 내구 로그를 보존하고 지원되는 복구 절차로 권위를 회복합니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka에서 컨트롤러 노드 장애와 데이터 파티션 리더 장애가 각각 발생했습니다. KRaft의 합의와 파티션 복제는 어떤 상태를 관리하며 어떻게 역할이 다른가요?](/tech-interview/questions/kafka-kraft-role/)

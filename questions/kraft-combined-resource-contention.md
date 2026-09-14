---
id: "kraft-combined-resource-contention"
title: "Kafka controller와 broker를 같은 프로세스에 둡니다. 데이터 I/O가 metadata 합의에 주는 간섭은 어떻게 측정하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","KRaft","메타데이터","심화 질문"]
related: ["kafka-kraft-role","raft-log-commit-apply","kafka-acks-isr"]
promotedFrom: {"id":"kafka-kraft-role","prompt":"combined 자원 경합"}
---

# Kafka controller와 broker를 같은 프로세스에 둡니다. 데이터 I/O가 metadata 합의에 주는 간섭은 어떻게 측정하나요?

## 구두 답변

combined mode는 배치가 단순하지만 broker의 데이터 I/O·GC·CPU가 controller 합의와 자원을 공유할 수 있습니다. 사용자 partition 지연과 metadata quorum 지연을 각각 계측합니다.

역할 분리는 독립 자원·장애 경계를 주는 대신 노드·운영 비용이 늘어납니다. 대량 생산과 topic 변경·leader 장애를 조합해 시험하고 controller 수가 데이터 복제 수를 바꾸지 않음을 명시합니다.

## 득점 포인트

- combined mode는 배치가 단순하지만 broker의 데이터 I/O·GC·CPU가 controller 합의와 자원을 공유할 수 있습니다. 사용자 partition 지연과 metadata quorum 지연을 각각 계측합니다.
- 대량 생산과 topic 변경·leader 장애를 조합해 시험하고 controller 수가 데이터 복제 수를 바꾸지 않음을 명시합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: combined mode는 배치가 단순하지만 broker의 데이터 I/O·GC·CPU가 controller 합의와 자원을 공유할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka에서 컨트롤러 노드 장애와 데이터 파티션 리더 장애가 각각 발생했습니다. KRaft의 합의와 파티션 복제는 어떤 상태를 관리하며 어떻게 역할이 다른가요?](/tech-interview/questions/kafka-kraft-role/)

---
id: "jetstream-slow-replica-quorum"
title: "JetStream 복제본 하나가 느립니다. 생산 지연과 장애 여유를 어떤 쿼럼·lag 지표로 구분하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["NATS","JetStream","복제","심화 질문"]
related: ["jetstream-stream-replication","consensus-quorum-failure"]
promotedFrom: {"id":"jetstream-stream-replication","prompt":"느린 replica"}
---

# JetStream 복제본 하나가 느립니다. 생산 지연과 장애 여유를 어떤 쿼럼·lag 지표로 구분하나요?

## 구두 답변

복제본 하나의 지연과 과반의 지연은 생산 확인·장애 여유에 다른 영향을 줄 수 있습니다. 실제 replica lag·리더 상태·quorum 응답을 보고 가장 느린 한 노드가 항상 모든 쓰기를 막는다고 하지 않습니다.

쓰기 지연·확인된 이벤트 보존·재동기화 시간과 디스크·네트워크를 측정합니다. 두 번째 장애가 겹칠 때 진행이 가능한지와 파일 저장의 flush 계약도 별도로 확인합니다.

## 득점 포인트

- 복제본 하나의 지연과 과반의 지연은 생산 확인·장애 여유에 다른 영향을 줄 수 있습니다. 실제 replica lag·리더 상태·quorum 응답을 보고 가장 느린 한 노드가 항상 모든 쓰기를 막는다고 하지 않습니다.
- 두 번째 장애가 겹칠 때 진행이 가능한지와 파일 저장의 flush 계약도 별도로 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 복제본 하나의 지연과 과반의 지연은 생산 확인·장애 여유에 다른 영향을 줄 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: JetStream stream의 replicas를 1에서 3으로 늘리려 합니다. 저장 확인, 장애 대응, 자원 비용에서 무엇이 달라지나요?](/tech-interview/questions/jetstream-stream-replication/)

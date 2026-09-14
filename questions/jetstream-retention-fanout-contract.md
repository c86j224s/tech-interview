---
id: "jetstream-retention-fanout-contract"
title: "분석과 알림이 같은 stream을 독립 소비합니다. Limits·Interest·WorkQueue 보관 정책은 어떤 삭제 조건이 다른가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["NATS","JetStream","durable consumer","심화 질문"]
related: ["jetstream-durable-consumer","nats-core-jetstream"]
promotedFrom: {"id":"jetstream-durable-consumer","prompt":"retention별 삭제"}
---

# 분석과 알림이 같은 stream을 독립 소비합니다. Limits·Interest·WorkQueue 보관 정책은 어떤 삭제 조건이 다른가요?

## 구두 답변

Limits는 시간·크기·개수 한도, Interest는 관심 소비자 ACK, WorkQueue는 한 작업 완료 중심의 보관 의미를 가집니다. 독립 fan-out에 맞는 정책과 consumer 필터 제약을 확인합니다.

durable 이름은 삭제된 메시지를 영구 복구하지 못합니다. 관심이 없던 기간·보관 초과·consumer 삭제·새 구독 시작점을 시험합니다. 외부 DB commit과 ACK는 같은 transaction이 아니므로 멱등 효과가 필요합니다.

## 득점 포인트

- Limits는 시간·크기·개수 한도, Interest는 관심 소비자 ACK, WorkQueue는 한 작업 완료 중심의 보관 의미를 가집니다. 독립 fan-out에 맞는 정책과 consumer 필터 제약을 확인합니다.
- 외부 DB commit과 ACK는 같은 transaction이 아니므로 멱등 효과가 필요합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Limits는 시간·크기·개수 한도, Interest는 관심 소비자 ACK, WorkQueue는 한 작업 완료 중심의 보관 의미를 가집니다.

## 더 파고들 거리

- [기본 상황과 비교: 분석과 알림 서비스가 같은 JetStream 메시지를 각각 읽어야 합니다. stream과 durable consumer를 어떻게 나누고 재시작 위치를 유지하나요?](/tech-interview/questions/jetstream-durable-consumer/)

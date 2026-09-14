---
id: "managed-queue-full-cost"
title: "관리형 큐 비용을 추정합니다. API 요청 수 외에 보관·재전달·데이터 이동·중복 처리 비용은 어떻게 포함하나요?"
difficulty: "중하"
category: "설계"
tags: ["NATS","Kafka","SQS","메시징","심화 질문"]
related: ["messaging-tool-choice","nats-core-jetstream","kafka-partition-offset"]
promotedFrom: {"id":"messaging-tool-choice","prompt":"관리형 큐 비용을 요청 수 외에 보관·데이터 이동·재전달까지 어떻게 계산할까요?"}
---

# 관리형 큐 비용을 추정합니다. API 요청 수 외에 보관·재전달·데이터 이동·중복 처리 비용은 어떻게 포함하나요?

## 구두 답변

생산·수신·삭제·poll·재시도 API 수와 메시지 바이트·보관·지역 이동·DLQ·중복 처리 자원을 합산합니다. 단가만 비교하면 실제 workload 비용을 놓칩니다.

batch가 호출 수를 줄여도 대기·큰 payload·부분 실패 처리가 늘 수 있습니다. 같은 성공 기준·트래픽·보관 기간에서 대조하고 운영 인력·복구 훈련 비용도 포함합니다.

## 득점 포인트

- 생산·수신·삭제·poll·재시도 API 수와 메시지 바이트·보관·지역 이동·DLQ·중복 처리 자원을 합산합니다. 단가만 비교하면 실제 workload 비용을 놓칩니다.
- 같은 성공 기준·트래픽·보관 기간에서 대조하고 운영 인력·복구 훈련 비용도 포함합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 생산·수신·삭제·poll·재시도 API 수와 메시지 바이트·보관·지역 이동·DLQ·중복 처리 자원을 합산합니다.

## 더 파고들 거리

- [기본 상황과 비교: 서비스 간 메시징을 도입하려는데 실시간 알림, 과거 이벤트 재생, 작업 재시도의 요구가 다릅니다. 어떤 보장과 운영 조건을 기준으로 NATS·Kafka·SQS를 선택하나요?](/tech-interview/questions/messaging-tool-choice/)

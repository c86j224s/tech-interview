---
id: "sqs-fifo-hot-message-group"
title: "SQS FIFO의 한 message group만 밀립니다. 소비자를 늘려도 안 풀리는 이유와 순서 범위 변경의 비용은 무엇인가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["SQS","visibility timeout","메시지","심화 질문"]
related: ["sqs-visibility-timeout","message-consumer-idempotency"]
promotedFrom: {"id":"sqs-visibility-timeout","prompt":"FIFO 핫 group"}
---

# SQS FIFO의 한 message group만 밀립니다. 소비자를 늘려도 안 풀리는 이유와 순서 범위 변경의 비용은 무엇인가요?

## 구두 답변

같은 FIFO message group은 순서를 유지하는 처리 단위여서 한 작업이 오래 걸리면 뒤 작업을 막을 수 있습니다. consumer 수만 늘려 그 group의 병렬 상한을 없앨 수는 없습니다.

group을 나눌 수 있는 독립 키인지 업무 의미를 확인합니다. 작업 크기·visibility 연장·DLQ·재시도와 중복 원장을 관리합니다. 순서 범위를 바꾼 뒤 원래 전이가 안전한지 검증합니다.

## 득점 포인트

- 같은 FIFO message group은 순서를 유지하는 처리 단위여서 한 작업이 오래 걸리면 뒤 작업을 막을 수 있습니다. consumer 수만 늘려 그 group의 병렬 상한을 없앨 수는 없습니다.
- 순서 범위를 바꾼 뒤 원래 전이가 안전한지 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 같은 FIFO message group은 순서를 유지하는 처리 단위여서 한 작업이 오래 걸리면 뒤 작업을 막을 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: SQS 메시지를 처리하는 동안 visibility timeout이 지나 다른 워커도 같은 메시지를 받았습니다. 기존 작업은 중단되며 중복 반영과 메시지 삭제는 어떻게 처리하나요?](/tech-interview/questions/sqs-visibility-timeout/)

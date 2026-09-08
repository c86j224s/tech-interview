---
id: kafka-transactions-external-db
title: "Kafka transaction으로 Kafka offset·출력과 외부 DB 커밋을 한 원자적 작업처럼 묶을 수 있나요?"
difficulty: 중하
category: 분산 시스템
tags: ["Kafka","트랜잭션","외부 DB"]
related: ["transactional-outbox","message-consumer-idempotency"]
---

# Kafka transaction으로 Kafka offset·출력과 외부 DB 커밋을 한 원자적 작업처럼 묶을 수 있나요?

## 구두 답변

Kafka transaction은 Kafka 안의 출력 레코드와 소비 offset을 하나의 트랜잭션 경계로 묶을 수 있지만, 임의의 외부 DB나 HTTP API의 커밋까지 자동으로 포함하는 분산 트랜잭션은 아닙니다. Kafka에서 읽어 변환한 결과를 Kafka에 쓰는 처리라면 입력 offset과 출력 레코드를 같은 Kafka transaction(여러 Kafka 기록을 함께 확정하거나 취소하는 묶음)으로 커밋하고, 소비자는 필요한 경우 `read_committed`(커밋된 트랜잭션의 레코드와 읽기 가능한 비트랜잭션 레코드를 반환하며 중단된 출력을 숨기는 모드)로 중단된 출력을 보지 않게 읽습니다. 이 경계는 Kafka 안에서만 적용됩니다.

외부 DB를 먼저 커밋한 뒤 Kafka transaction을 커밋하기 전에 프로세스가 죽으면 DB 효과는 남고 입력 레코드는 재처리됩니다. 반대로 Kafka를 먼저 커밋하고 DB가 실패하면 Kafka 관점에서는 성공했지만 외부 효과가 빠질 수 있습니다. 따라서 DB 안에 inbox(이미 처리한 이벤트 ID를 기록하는 표)와 업무 변경을 같은 로컬 트랜잭션으로 저장하거나, 외부 시스템의 멱등 키·대사·보상 절차를 사용하겠습니다. 같은 메시지가 다시 오면 inbox의 고유 제약이 두 번째 업무 변경을 막습니다. 이것은 Kafka transaction만 추가해 해결되는 문제가 아닙니다.

`read_committed`(커밋된 트랜잭션의 레코드와 읽기 가능한 비트랜잭션 레코드를 반환하며 중단된 출력을 숨기는 모드)도 외부 부수 효과를 되돌리거나 검증하지 않습니다. 트랜잭션이 오래 열린 채 멈추면 last stable offset(미완료 트랜잭션 때문에 읽기를 보류하는 경계 위치)이 늦어져 뒤의 레코드 소비가 지연될 수 있습니다. transaction 크기와 실행 시간을 제한하고, fencing 오류(같은 트랜잭션 ID를 새 프로듀서가 차지해 옛 프로듀서의 쓰기를 막는 오류)는 일반 네트워크 재시도와 다르게 처리하겠습니다. 옛 프로듀서를 계속 재시도하면 새 소유권과 충돌하므로 종료하고 복구 절차로 넘겨야 합니다. DB 커밋 전후, Kafka commit 전후 각 중단 지점을 재현해 입력·출력·DB 효과의 중복과 누락을 따로 검증합니다.

## 득점 포인트

- Kafka 내부 원자성과 외부 DB 커밋 경계를 분명히 한다.
- DB inbox·멱등 키·대사를 선택지로 제시한다.
- read_committed와 열린 transaction의 지연 비용을 설명한다.

## 감점 포인트

- Kafka transaction이 외부 DB와 API까지 자동 rollback한다고 말한다.
- read_committed가 업무 부수 효과를 검증한다고 말한다.
- exactly-once를 입력·출력·외부 효과의 범위 없이 사용한다.

## 더 파고들 거리

- transaction이 열린 채 producer가 멈추면 last stable offset과 consumer lag에 어떤 영향이 있나요?
- DB에 업무 변경과 처리 offset을 함께 저장할 때 필요한 재처리 전제는 무엇인가요?
- producer fencing 오류를 일시적 연결 오류와 다르게 종료해야 하는 이유는 무엇인가요?

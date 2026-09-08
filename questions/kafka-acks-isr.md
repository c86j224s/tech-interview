---
id: kafka-acks-isr
title: "Kafka에서 복제 계수 3, acks=all, min.insync.replicas=2일 때 ISR이 2개 또는 1개로 줄면 생산 요청은 어떻게 되나요?"
difficulty: 중하
category: 분산 시스템
tags: ["Kafka","acks","ISR"]
related: ["db-wal-durability"]
---

# Kafka에서 복제 계수 3, acks=all, min.insync.replicas=2일 때 ISR이 2개 또는 1개로 줄면 생산 요청은 어떻게 되나요?

## 구두 답변

Kafka의 복제 계수는 설정상 복제본 수이고, ISR(In-Sync Replicas, 리더를 따라가 현재 동기화된 복제본 목록)은 현재 쓰기에 참여할 수 있는 복제본 집합입니다. `acks=all`은 리더가 현재 ISR의 복제 조건을 만족한 뒤 생산자에게 성공을 알리도록 요청하는 설정이며, `min.insync.replicas=2`는 그런 쓰기를 허용할 최소 ISR 크기입니다. 따라서 복제 계수가 3이어도 지연된 복제본이 ISR에서 빠지면 실제 확인 범위는 2개 또는 1개가 될 수 있습니다.

ISR이 2개면 조건을 만족해 정상 생산할 수 있지만, ISR이 1개면 `min.insync.replicas` 조건을 만족하지 못해 보통 `NotEnoughReplicas` 계열 오류로 거절됩니다. 이 정책은 장애 중 쓰기 가용성을 낮추는 대신 리더 하나에만 남은 상태에서 성공하는 일을 막습니다. 생산자는 재시도와 순서 설정까지 함께 고려해야 하며, 재시도 실패를 무시하면 업무 유실을 숨길 수 있습니다.

성공 ACK(생산 요청을 받았다는 응답)는 Kafka의 복제 프로토콜 범위에 대한 결과이지 모든 디스크 고장과 외부 DB 커밋을 무손실로 보장하는 표현은 아닙니다. unclean leader election(ISR 밖의 뒤처진 복제본도 새 리더로 올리는 정책)을 허용하면 서비스를 빨리 재개할 수 있지만, 최신 기록이 사라질 위험이 있습니다. 반대로 이를 막으면 데이터 손실 가능성은 줄어도 ISR이 회복될 때까지 쓰기가 거절될 수 있습니다. 복제 지연·리더 장애를 주입해 생산 성공/실패, 복구 후 남은 레코드, 소비자 결과를 따로 확인하겠습니다.

## 득점 포인트

- replication factor와 현재 ISR을 예시 숫자로 구분한다.
- min ISR이 장애 중 쓰기를 거절하는 조건을 완결한다.
- ACK·리더 승격·외부 효과의 보장 범위를 나눈다.

## 감점 포인트

- acks=all이 항상 설정된 모든 replica를 기다린다고 말한다.
- min ISR을 높여도 가용성 비용이 없다고 말한다.
- Kafka ACK를 물리 디스크와 모든 업무 시스템의 무손실 보장으로 확대한다.

## 더 파고들 거리

- ISR 축소·생산 오류·복구 시간을 어떤 메트릭으로 한 화면에서 볼까요?
- unclean leader election을 허용할 수 있는 이벤트와 금지할 이벤트를 어떻게 나눌까요?
- idempotence와 in-flight 설정이 재시도 중 파티션 순서에 미치는 영향은 무엇인가요?

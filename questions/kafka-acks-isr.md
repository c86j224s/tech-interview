---
id: kafka-acks-isr
title: "Kafka에서 복제 계수 3, acks=all, min.insync.replicas=2일 때 ISR이 2개 또는 1개로 줄면 생산 요청은 어떻게 되나요?"
answerMinutes: 5
followups: [{"id":"kafka-idempotent-producer","prompt":"생산 응답 유실 재시도에서 idempotence가 줄이는 중복과 외부 DB에 남는 중복은 무엇인가요?"},{"id":"kafka-kraft-role","prompt":"partition leader 장애와 KRaft controller quorum 장애를 어떻게 구분하나요?"},{"id":"consensus-quorum-failure","prompt":"ISR 하나가 최신처럼 보여도 생산을 거부하는 이유를 quorum과 비교해 보세요."}]
difficulty: 중하
category: 분산 시스템
tags: ["Kafka","acks","ISR"]
related: ["db-wal-durability"]
---

# Kafka에서 복제 계수 3, acks=all, min.insync.replicas=2일 때 ISR이 2개 또는 1개로 줄면 생산 요청은 어떻게 되나요?

## 구두 답변

복제 계수 3, `acks=all`, `min.insync.replicas=2`에서는 현재 ISR이 생산 성공 조건을 결정합니다. ISR은 leader를 따라가 동기화된 replica 집합이고, `acks=all`은 현재 ISR 기준 확인을 요구하며 min ISR은 허용할 최소 수입니다.

### ISR이 줄어들 때

ISR이 2개면 최소 조건을 만족해 생산할 수 있습니다. 세 번째 replica는 lag로 ISR 밖일 수 있습니다. ISR이 1개면 min ISR 2를 만족하지 못해 보통 `NotEnoughReplicas` 계열 오류로 거절됩니다. `acks=all`이 설정된 모든 replica를 항상 기다린다는 뜻은 아닙니다.

min ISR을 높이면 leader 하나만 남은 상태에서 성공하는 일을 막아 내구성은 높지만 장애 중 가용성이 낮아집니다. unclean leader election을 허용하면 뒤처진 replica를 빨리 올릴 수 있지만 최신 기록이 사라질 수 있습니다. 생산 ACK는 Kafka 복제 범위이지 외부 DB 처리나 모든 디스크 장애의 무손실 보장이 아닙니다.

검증은 ISR 3→2→1, leader 장애, ACK 유실, unclean election을 주입해 생산 결과·복구 레코드·소비 효과를 따로 확인합니다.

### 성공 조건과 불확정 실패

복제 계수는 배치할 사본 수이고 ISR은 현재 동기화 상태로 인정되는 집합입니다. ISR이 A·B·C라면 acks=all은 현재 ISR 기준 복제를 기다리며, min ISR=2는 그중 임의 두 개만 기다리라는 옵션이 아닙니다. C가 충분히 뒤처져 ISR에서 빠지면 A·B로도 최소 조건을 만족할 수 있습니다. 반대로 ISR이 하나면 이 설정에서는 생산을 거절해 단일 사본만 남는 성공을 제한합니다.

요청을 받기 전 최소 ISR이 부족한 경우와 기록 도중 ISR이 줄어 성공 확인을 못한 경우는 결과가 다를 수 있습니다. 오류나 timeout을 받았어도 로그에 기록됐을 가능성이 있어 재시도 중복을 고려합니다. idempotent producer는 해당 생산 세션의 재전송을 sequence로 식별하지만 애플리케이션이 같은 주문을 새 이벤트로 두 번 만든 경우까지 자동 제거하지는 않습니다.

### ISR과 합의 쿼럼은 다릅니다

Kafka 사용자 partition의 ISR 기반 복제는 KRaft controller의 고정 투표 집합 Raft 합의와 같은 참여 집합이 아닙니다. ISR은 동기화 상태에 따라 바뀌고 데이터 리더 승격·unclean election 정책과 함께 해석해야 합니다. 과반이라는 말만 붙여 모든 설정을 동일한 무손실 계약으로 설명하지 않겠습니다.

acks는 소비자가 읽고 DB를 반영한 확인도 아니고 모든 노드가 물리 디스크에 즉시 fsync했다는 약속도 아닙니다. 장애 도메인과 디스크 flush, 데이터 보존 기간, 승격 가능한 replica를 함께 봅니다. 가용성을 위해 min ISR을 낮추는 변경은 오류를 줄일 수 있어도 성공 응답된 데이터의 손실 가능성을 바꾸므로 운영 정책과 테스트가 필요합니다.

검증에서는 생산자가 응답받은 ID와 불확정 ID를 나누고, ISR 변화 시간·생산 오류·리더 전환 후 로그를 비교합니다. 외부 DB 중복은 별도 소비자 처리 ID로 세어 생산 내구성 지표와 섞지 않겠습니다.

## 득점 포인트

- RF와 ISR을 숫자로 구분한다.
- min ISR 실패 조건을 완결한다.
- ACK·leader election·외부 효과를 나눈다.
- ISR 장애를 검증한다.

## 감점 포인트

- acks=all이 모든 설정 replica를 기다린다.
- min ISR의 가용성 비용을 무시한다.
- Kafka ACK가 외부 무손실이라고 말한다.

## 더 파고들 거리

- ISR 지표
- unclean 허용 분류
- idempotence와 in-flight

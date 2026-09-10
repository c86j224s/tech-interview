---
id: nats-core-jetstream
title: "알림 소비자가 잠시 내려갔다가 돌아와도 놓친 메시지를 처리해야 합니다. Core NATS와 JetStream은 저장·재전달을 어떻게 지원하며 중복 처리는 누가 책임지나요?"
answerMinutes: 5
followups: [{"id":"jetstream-durable-consumer","prompt":"분석·알림이 같은 stream을 독립적으로 읽을 때 durable consumer를 어떻게 나누나요?"},{"id":"jetstream-ack-redelivery","prompt":"ACK 유실 재전달의 DB 중복을 이벤트 ID로 어떻게 막나요?"},{"id":"nats-subject-queue-group","prompt":"여러 서비스 fan-out과 서비스 내부 분산을 subject·queue group으로 어떻게 구성하나요?"}]
difficulty: 하
category: 분산 시스템
tags: ["NATS","JetStream","메시징"]
related: ["message-consumer-idempotency"]
---

# 알림 소비자가 잠시 내려갔다가 돌아와도 놓친 메시지를 처리해야 합니다. Core NATS와 JetStream은 저장·재전달을 어떻게 지원하며 중복 처리는 누가 책임지나요?

## 구두 답변

Core NATS는 연결된 publish·subscribe의 실시간 전달에 초점을 두고 오프라인 subscriber를 위한 내구 재생을 기본 계약으로 하지 않습니다. JetStream은 stream에 메시지를 저장하고 consumer의 위치·ACK·재전달·재생 정책을 제공합니다. JetStream도 retention을 넘어 삭제된 메시지를 무한 복구할 수는 없습니다.

### 선택과 외부 효과

현재 상태 알림처럼 snapshot으로 복구하거나 순간 유실을 허용하면 Core NATS가 단순합니다. 주문·결제처럼 반드시 처리할 이벤트는 JetStream의 retention·replication·consumer를 검토합니다. producer 저장 성공, consumer ACK, 외부 DB commit은 서로 다른 상태입니다. ACK 전에 죽거나 ACK가 유실되면 재전달되므로 이벤트 ID와 DB transaction·멱등 키가 필요합니다.

오프라인 발행·consumer 중단·ACK 유실·retention 만료를 재현해 저장·재전달 범위, 중복 외부 효과, snapshot 대사를 확인합니다. 제품 이름보다 무엇을 어디까지 저장하고 누가 중복을 책임지는지가 기준입니다.

### 실시간 전달과 저장 확인

Core NATS의 queue group은 연결된 구독자 중 한 곳에 작업을 분배할 수 있지만, 처리 중 구독자가 죽었다고 자동으로 내구 로그에서 다시 전달하는 ACK 모델은 아닙니다. 클라이언트가 잠시 재연결 버퍼를 제공해도 서버의 영구 보관과 같은 보장으로 해석하지 않습니다. 현재 위치 알림처럼 다음 스냅샷으로 회복 가능한 데이터와 결제 완료처럼 기록을 잃으면 안 되는 이벤트를 구분하겠습니다.

JetStream을 사용하려면 subject를 캡처할 stream과 저장 유형·복제 수·보관 정책을 구성하고, 생산자는 저장 확인을 받는 API를 사용해야 합니다. 평범한 publish 호출이 로컬 버퍼에 들어간 것과 stream의 저장 확인은 다릅니다. 저장 성공 응답을 받지 못했어도 메시지가 이미 저장됐을 수 있으므로 메시지 ID와 지원되는 중복 제거 창을 확인합니다.

### 소비 상태와 복구 한도

consumer는 어디부터 읽을지, 어떤 필터를 적용할지, 언제 ACK와 재전달을 할지 정합니다. 분석과 알림이 각각 모든 이벤트를 읽으려면 독립 소비 상태와 그 목적에 맞는 retention이 필요합니다. WorkQueue와 같은 한 작업 완료 중심 정책을 독립 fan-out 보관 정책으로 잘못 쓰지 않습니다. durable 이름이 있어도 stream의 시간·크기 한도로 삭제된 메시지를 복원하지는 못합니다.

외부 DB commit 뒤 ACK 전에 죽으면 JetStream은 같은 이벤트를 다시 줄 수 있습니다. 처리 ID와 DB 변경을 같은 transaction에 넣어 다시 받아도 같은 결과가 되게 합니다. 브로커의 dedup·ACK 확인을 조합한 전달 보장은 그 범위에서 평가하고, 외부 시스템의 한 번 효과까지 과장하지 않겠습니다.

전환 시험에서는 오프라인 소비자, 생산 ACK 유실, 처리 중 워커 종료, 보관기간 초과를 별도로 재현합니다. 놓쳐도 되는 상태는 스냅샷으로 수렴하는지, 반드시 처리할 이벤트는 원본 대사로 누락을 찾는지 확인합니다. 저장·복제·복구의 추가 비용이 필요하지 않은 실시간 통신에는 Core NATS를 유지하는 것도 합리적입니다.

## 득점 포인트

- Core NATS와 JetStream 저장·재전달을 구분한다.
- producer·consumer ACK를 나눈다.
- retention·외부 멱등 한계를 설명한다.
- 장애를 재현한다.

## 감점 포인트

- Core NATS가 오프라인 메시지를 항상 재생한다.
- JetStream이 외부 exactly once를 보장한다.
- 보관·복제 비용을 무시한다.

## 더 파고들 거리

- retention
- 이벤트 ID
- snapshot 순서

---
id: jetstream-durable-consumer
title: "분석과 알림 서비스가 같은 JetStream 메시지를 각각 읽어야 합니다. stream과 durable consumer를 어떻게 나누고 재시작 위치를 유지하나요?"
answerMinutes: 5
followups: [{"id":"nats-core-jetstream","prompt":"오프라인 중 유실되어도 되는 알림과 반드시 처리할 주문 이벤트를 어떻게 나누나요?"},{"id":"jetstream-ack-redelivery","prompt":"durable 위치가 있어도 ACK 유실 재전달의 중복 효과를 어떻게 막나요?"},{"id":"kafka-consumer-group","prompt":"서비스별 독립 consumer와 group 내부 인스턴스 분산을 Kafka와 비교해 보세요."}]
difficulty: 하
category: 분산 시스템
tags: ["NATS","JetStream","durable consumer"]
related: ["nats-core-jetstream"]
---

# 분석과 알림 서비스가 같은 JetStream 메시지를 각각 읽어야 합니다. stream과 durable consumer를 어떻게 나누고 재시작 위치를 유지하나요?

## 구두 답변

JetStream에서 stream은 subject 메시지를 저장하는 로그이고 consumer는 어디서부터 전달하며 ACK됐는지를 관리합니다. **내구 소비자**(durable consumer)는 연결보다 긴 이름과 상태를 유지해 재시작 후 이어 읽게 합니다. 분석과 알림이 모두 전체 이벤트를 읽어야 하면 서비스별 독립 consumer를 둡니다.

### stream과 consumer

하나의 stream에 analytics consumer와 notification consumer를 만들면 분석의 진행 위치가 알림을 움직이지 않습니다. 같은 durable 이름을 여러 서비스가 공유하면 독립 fan-out이 아니라 하나의 소비 상태를 나누게 됩니다. 매번 새 consumer를 만들면 과거를 다시 읽거나 위치를 잃을 수 있습니다.

durable 위치를 복원해도 외부 DB commit 뒤 ACK 전에 죽으면 재전달됩니다. 따라서 이벤트 ID와 inbox·고유 제약이 필요합니다. pull은 소비자가 양과 속도를 조절하기 쉽고 push는 ACK·backpressure를 더 주의해야 하지만, 어느 방식도 외부 효과 exactly once를 보장하지 않습니다.

### 보관의 한계

limits·WorkQueue·Interest retention에 따라 메시지 삭제 시점이 다릅니다. 오래 내려간 consumer가 돌아와도 보관 한도를 넘긴 메시지는 durable 이름만으로 복구하지 못합니다. inactivity로 consumer 상태가 정리될 수도 있으므로 durable을 영구 보존으로 해석하지 않습니다.

검증은 한 서비스만 중단, 둘 다 재시작, 보관 기간 초과 중단을 시험합니다. 각 consumer의 위치·재전달·외부 중복과 snapshot·재생 복구 경로를 확인합니다.

### 보관 정책이 fan-out을 바꿉니다

분석과 알림이 같은 메시지를 각각 읽는 모델은 해당 stream의 보관 정책이 지원해야 합니다. LimitsPolicy는 시간·개수·크기 한도 아래 기록을 남기므로 독립 소비자가 각자 재생할 수 있습니다. InterestPolicy는 관심 소비자의 ACK를 기준으로 보관하며 관심이 없던 시기의 메시지를 나중 소비자가 읽을 수 있다고 가정하면 안 됩니다. WorkQueuePolicy는 작업을 한 소비 경로에서 완료해 제거하는 목적이고 겹치는 필터의 독립 소비자를 같은 작업에 붙이는 방식과 맞지 않습니다.

같은 durable을 여러 워커가 공유하는 것은 한 서비스 내부의 작업 분배입니다. 분석과 알림이 각자 전체 이벤트를 처리하려면 서로 다른 소비 상태와 권한을 갖고, 각 상태의 전달 시작 정책을 명시해야 합니다. 새 consumer를 만든다고 원래 위치가 자동으로 복원되지 않습니다. 이름과 시작 위치, 필터, ACK 정책이 배포 때마다 바뀌지 않게 관리하겠습니다.

재시작 후에는 소비자 존재 여부, ACK floor, 대기·재전달 수, stream의 첫 보관 위치를 비교합니다. 소비 위치가 보관 시작점보다 뒤처져 데이터가 사라졌다면 조용히 최신부터 읽지 않고 원본 스냅샷과 증분 이벤트를 연결해 재구축합니다. inactivity 삭제 같은 상태 정리는 서버 버전과 설정에 따라 확인합니다. 내구 소비자는 연결의 수명보다 오래 사는 처리 상태이지 메시지 자체를 영구 보관하는 장치는 아닙니다.

## 득점 포인트

- 저장 로그와 소비 상태를 분리한다.
- 서비스별 consumer와 내부 분산을 구분한다.
- durable과 retention 수명의 한계를 말한다.
- 장기 중단·재시작을 검증한다.

## 감점 포인트

- durable이면 메시지가 영구 보존된다고 말한다.
- 독립 서비스가 같은 consumer를 공유한다.
- 재시작마다 새 consumer를 만든다.

## 더 파고들 거리

- pull·push 흐름 제어
- retention별 삭제
- checkpoint 복구

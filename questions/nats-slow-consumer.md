---
id: nats-slow-consumer
title: "NATS slow consumer 경고가 서버 전체 병목인지 특정 subscriber의 처리 지연인지 어떻게 구분하고 대응하나요?"
answerMinutes: 5
followups: [{"id":"bounded-queue-backpressure","prompt":"subscriber 내부 큐가 가득 찰 때 block·drop·disconnect를 어떤 메시지 보장에 따라 선택할까요?"},{"id":"jetstream-ack-redelivery","prompt":"AckWait 만료로 재전달된 메시지가 원래 작업과 겹칠 때 중복 효과를 어떻게 막을까요?"},{"id":"nats-core-jetstream","prompt":"놓친 알림은 버려도 되지만 작업은 재생해야 할 때 Core NATS와 JetStream을 어떻게 나눌까요?"}]
difficulty: 중하
category: 성능
tags: ["NATS","slow consumer","백프레셔"]
related: ["bounded-queue-backpressure"]
---

# NATS slow consumer 경고가 서버 전체 병목인지 특정 subscriber의 처리 지연인지 어떻게 구분하고 대응하나요?

## 구두 답변

NATS slow consumer 경고는 특정 subscriber가 메시지를 도착 속도만큼 읽거나 처리하지 못해 pending buffer와 대기 한도가 쌓였다는 단서입니다. 원인이 broker 전체 CPU·네트워크 포화일 수도 있지만, callback 안에서 DB·외부 RPC·동기 파일 I/O를 수행하는 한 subscriber의 문제일 수도 있습니다. 따라서 서버 전체 지표와 연결별 pending bytes/messages, 도착률, callback 처리율, 가장 오래된 메시지 age를 분리해 보겠습니다. 핵심은 발행률과 소비율의 차이가 어느 대기열에 쌓이는지 찾는 것입니다.

### callback과 워커 큐의 경계를 만듭니다
callback은 가능한 한 빠르게 메시지를 검증해 제한된 내부 큐나 worker로 넘기고, 긴 작업을 직접 수행하지 않는 편이 안전합니다. 내부 큐가 가득 차면 무한히 쌓는 대신 backpressure로 생산을 늦추거나, 최신성에 불필요한 이벤트는 drop하고, 연결을 끊어 재연결·재전달 계약으로 넘기거나, 내구 stream으로 전환하는 정책을 정합니다. 무한 큐는 순간 오류를 숨기지만 메모리와 메시지 age를 무한히 키웁니다. queue group은 같은 작업을 인스턴스 사이에서 나누는 의미이고, 일반 구독자 추가는 각 구독자에게 fan-out되어 중복 수신을 만들 수 있습니다.

Core NATS는 실시간 전달에 적합하지만 subscriber가 끊긴 동안의 메시지를 기본적으로 보존·재생하는 계약이 없습니다. JetStream은 stream 보관과 consumer 위치, ACK·재전달 설정으로 복구 기회를 주지만 중복 전달과 AckWait 만료를 처리해야 합니다. 따라서 Core NATS에서 drop이 허용되는 알림인지, JetStream에서 반드시 처리해야 하는 작업인지 먼저 정합니다. 소비자를 추가할 때도 broker 확장인지 작업 분산인지 목적을 구분하겠습니다.

### 대응을 지표로 종료합니다
서버 CPU·네트워크·flush 지연과 subscriber별 pending·callback duration·worker queue age·메모리를 같은 시간축으로 봅니다. 특정 연결만 pending이 증가하면 callback을 분리해 처리 능력을 높이거나 생산률을 제한하고, 전체 연결이 동시에 밀리면 broker·네트워크·producer burst를 조사합니다. 소비자를 의도적으로 느리게 만들고 disconnect·재연결·재전달·중복 반영을 시험합니다. 큐를 늘린 뒤 가장 오래된 메시지 age가 계속 증가하거나 메모리가 상한에 닿으면 해결이 아니라 지연 은폐로 판단하겠습니다.

특정 subscriber의 pending이 늘면 callback의 DB·외부 호출을 분리하고 처리능력을 개선하거나 producer의 발행률을 제한해야 합니다. 소비자 처리율을 낮추는 것은 backlog를 줄이는 해법이 아니라 보통 역효과이므로, 무한 큐를 늘려 지연을 숨기지 않겠습니다. Core NATS에서 disconnect 뒤 유실을 허용할지, snapshot으로 재동기화할지, JetStream으로 보존·재전달할지를 먼저 정합니다.

JetStream pull batch가 너무 크면 메모리와 AckWait 압박이 커지고 너무 작으면 왕복 비용이 늘어납니다. queue group은 인스턴스 간 작업 분산이지 순서 보장이 아니며, 멱등성은 중복 효과를 줄일 뿐 여러 worker의 순서 역전을 해결하지 않습니다. key별 직렬화나 sequence 검증이 필요할 수 있습니다. 서버 전체 CPU·네트워크와 연결별 pending·callback duration·worker queue age·가장 오래된 메시지 age를 함께 보겠습니다.

특정 연결이 밀릴 때 그 소비자의 처리율을 낮추면 backlog와 메시지 age가 늘어나는 역효과가 납니다. producer 발행률을 제한하거나 callback의 블로킹 작업을 분리하고 실제 처리능력을 높여 입력률보다 처리율을 높여야 합니다. 단, 최신성만 필요한 메시지는 명시적으로 drop하고 snapshot으로 복구할 수 있습니다.

## 득점 포인트

- broker 전체와 특정 callback 병목을 연결별 지표로 구분한다.
- 제한 큐·backpressure·drop·내구 전환을 메시지 계약과 연결한다.
- 일반 구독과 queue group의 fan-out·분산 의미를 구분한다.

## 감점 포인트

- slow consumer면 항상 broker 전체가 느리다고 말한다.
- 무한 큐가 안전한 해결책이라고 말한다.
- 일반 subscriber를 추가하면 자동으로 작업이 분산된다고 말한다.

## 더 파고들 거리

- JetStream pull batch 크기가 메모리·ACK 지연·재전달에 어떤 영향을 주나요?
- callback에서 긴 DB 작업을 직접 수행할 때 어떤 순서 역전과 pending 증가가 생길까요?
- 연결이 잠시 끊긴 뒤 snapshot 동기화를 시작할 때 producer와 subscriber를 어떻게 조정할까요?

---
id: nats-core-jetstream
title: "Core NATS와 JetStream에서 소비자 오프라인·ACK 유실·외부 효과 재처리는 어떻게 달라지나요?"
difficulty: 하
category: 분산 시스템
tags: ["NATS","JetStream","메시징"]
related: ["message-consumer-idempotency"]
---

# Core NATS와 JetStream에서 소비자 오프라인·ACK 유실·외부 효과 재처리는 어떻게 달라지나요?

## 구두 답변

Core NATS는 연결된 publish·subscribe의 실시간 전달에 초점을 두며, 기본적으로 소비자가 오프라인인 동안 메시지를 내구 로그에 쌓아 두었다가 나중에 재생하는 계약이 아닙니다. JetStream은 stream(저장할 메시지 묶음)에 메시지를 저장하고 consumer 상태(소비 위치 기록)·ACK(처리 완료 확인)·재전달·재생 정책을 제공하므로 전달 수명과 실패 처리 방식이 달라집니다. 저장이 켜져 있어도 보관 기간이 끝난 메시지는 다시 읽을 수 없습니다. 같은 NATS 서버를 사용해도 선택한 모드가 보장을 결정합니다.

현재 상태 알림처럼 다음 snapshot으로 복구할 수 있고 순간 유실을 허용하는 데이터에는 Core NATS가 단순할 수 있습니다. 반드시 처리해야 하는 주문 이벤트에는 JetStream의 retention·replication·consumer 정책을 검토합니다. JetStream에서도 consumer가 외부 DB(업무 데이터를 저장하는 데이터베이스)에 효과를 적용한 뒤 ACK 전에 죽으면 같은 메시지를 다시 받을 수 있으므로 외부 효과의 멱등성은 별도 책임입니다. 처리 기록과 업무 변경을 같은 DB 트랜잭션으로 묶거나 외부 멱등 키를 사용해야 합니다.

생산자가 JetStream 저장 성공을 확인했는지, consumer가 언제 ACK했는지, 메시지가 언제 retention으로 삭제되는지를 분리해 관찰하겠습니다. 오프라인 발행, ACK 유실, 저장소·consumer 장애를 재현하고, 저장 비용·복제·보관 만료와 재처리 결과를 검증합니다. 제품 이름보다 “어디까지 저장하고 무엇을 다시 전달하는가”를 답변 기준으로 삼겠습니다.

## 득점 포인트

- Core NATS의 연결 중심 전달과 JetStream의 저장·재생을 구분한다.
- 업무 변경 뒤 ACK 전에 중단되면 같은 메시지를 다시 받을 수 있음을 설명한다.
- 생산 확인·소비 ACK·retention 시점을 별도 상태로 제시한다.

## 감점 포인트

- Core NATS가 오프라인 메시지를 항상 재생한다고 말한다.
- JetStream이면 외부 효과도 정확히 한 번이라고 말한다.
- 저장·복제·보관 만료 비용을 무시한다.

## 더 파고들 거리

- stream retention 종류에 따라 메시지가 언제 제거되는지 어떻게 확인할까요?
- 생산 확인 응답이 유실될 때 재발행을 어떤 업무 키로 구분할까요?
- 순간 상태 유실을 snapshot으로 복구할 때 snapshot 시점과 이벤트 순서를 어떻게 맞출까요?

---
id: nats-slow-consumer
title: "NATS slow consumer 경고가 서버 전체 병목인지 특정 subscriber의 처리 지연인지 어떻게 구분하고 대응하나요?"
difficulty: 중하
category: 성능
tags: ["NATS","slow consumer","백프레셔"]
related: ["bounded-queue-backpressure"]
---

# NATS slow consumer 경고가 서버 전체 병목인지 특정 subscriber의 처리 지연인지 어떻게 구분하고 대응하나요?

## 구두 답변

Slow consumer는 보통 특정 소비자가 메시지를 도착 속도만큼 읽거나 처리하지 못해 client pending buffer나 서버 측 대기 한도가 쌓이는 상태를 뜻합니다. 원인은 브로커 전체 포화일 수도 있지만, callback(메시지를 받았을 때 실행되는 함수)에서 느린 DB 쓰기나 블로킹 연산을 수행하는 한 subscriber(구독자)의 문제일 수도 있습니다. 따라서 서버 CPU·네트워크와 연결별 pending·도착률·처리율을 분리해 관찰하겠습니다.

callback은 빠르게 메시지를 받아 제한된 워커 큐로 넘기고, 큐가 가득 차면 무한히 쌓기보다 backpressure(생산 속도를 늦추는 압력)·drop(버림)·disconnect(연결 종료)·내구 stream 전환 중 정책을 적용합니다. 무한 큐를 택하면 잠시 오류가 줄어도 메모리와 지연이 함께 커집니다. Core NATS에서 버퍼 한도를 넘긴 메시지를 복구할 수 있는지와 JetStream에서 ACK 지연·재전달이 어떻게 동작하는지는 다릅니다. 실시간 알림을 Core NATS로 보내면 느린 구독자가 끊긴 뒤 놓친 알림을 다시 받을 수 없지만, JetStream은 설정된 보관 기간과 소비 위치 안에서 재전달할 수 있습니다. 소비자를 추가할 때 일반 구독은 각 subscriber에 fan-out되어 중복 수신이 될 수 있고, queue group은 작업 분산을 위한 별도 의미이므로 목적에 맞게 선택합니다.

큐 길이만 보지 않고 가장 오래된 메시지의 나이, 유실·재전달, callback 지연, 메모리를 함께 경보로 삼겠습니다. 소비자를 의도적으로 느리게 하고 연결 해제·회복·부하 증가를 시험해 무한 큐가 메모리와 tail latency를 숨기지 않는지, 확장이 중복 반영을 일으키지 않는지 확인합니다.

## 득점 포인트

- 소비자별 callback 병목과 서버 전체 병목을 진단 지표로 나눈다.
- 제한된 워커 큐와 모드별 유실·재전달 계약을 연결한다.
- 일반 구독과 queue group 확장의 의미를 분리한다.

## 감점 포인트

- 느린 소비자면 항상 broker가 느리다고 말한다.
- 무한 큐로 메시지를 쌓으면 안전하게 해결된다고 말한다.
- 일반 subscriber 추가가 자동 작업 분산이라고 말한다.

## 더 파고들 거리

- JetStream pull consumer의 batch 크기가 메모리·ACK 지연·재전달에 어떤 영향을 주나요?
- client callback에서 긴 DB·외부 호출을 직접 수행하면 안 되는 이유는 무엇인가요?
- 순간 상태 유실 뒤 snapshot 동기화를 시작할 때 subscriber와 producer를 어떻게 조정할까요?

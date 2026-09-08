---
id: messaging-tool-choice
title: "실시간 publish, 장기 재생 로그, 관리형 작업 큐 중 어떤 요구를 기준으로 NATS·Kafka·SQS를 선택하나요?"
difficulty: 하
category: 설계
tags: ["NATS","Kafka","SQS","메시징"]
related: ["nats-core-jetstream","kafka-partition-offset","sqs-visibility-timeout"]
---

# 실시간 publish, 장기 재생 로그, 관리형 작업 큐 중 어떤 요구를 기준으로 NATS·Kafka·SQS를 선택하나요?

## 구두 답변

제품 이름보다 메시지의 수명과 소비 모델을 먼저 나눕니다. Core NATS(연결된 구독자에게 즉시 전달하는 NATS 방식)는 subject(메시지 분류 이름) 통신에 가깝고, Kafka는 partition log(파티션별 순서 로그)를 보관해 여러 consumer group이 각자 위치에서 재생하는 데 강합니다. SQS는 관리형 작업 큐로서 소비자에게 작업을 전달하고 visibility timeout(처리 중 재전달을 잠시 막는 시간)과 재시도를 운영 서비스에 맡기는 선택입니다. NATS의 JetStream(메시지를 저장·재생하는 NATS 기능)을 쓰면 저장·재생·ACK(처리 완료 확인) 모델이 달라지므로 “NATS 대 Kafka”처럼 제품 단위로만 비교하지 않습니다.

여러 팀이 계정 이벤트를 보관 기간 안에서 독립 재생해야 하면 로그·partition·retention·consumer offset이 중요합니다. 즉시 내부 요청이면 request-reply 지연·연결·응답 상관관계를 보고, 운영 인력이 적고 단순 작업 분배가 목적이면 관리형 큐의 운영 비용을 봅니다. 순서 범위, 최대 메시지 크기, 재전달·중복, 장애 복구, cross-region 비용도 요구사항 표에 적겠습니다.

어떤 broker(메시지를 전달·저장하는 중간 시스템)도 외부 DB 효과의 멱등성이나 업무 중복을 자동으로 없애지 않습니다. 예를 들어 작업 전달이 한 번 더 되면 주문 상태를 두 번 바꾸지 않도록 소비자와 DB가 별도 처리 기록을 가져야 합니다. 대표 workload에서 생산 확인, 소비 지연, 재처리, 보관 만료와 비용을 시험하고, 한 제품으로 통일했을 때의 운영 단순화와 애플리케이션에 옮겨가는 복잡성을 함께 비교해 선택하겠습니다.

## 득점 포인트

- 메시지 수명·재생·작업 분배라는 선택 축을 먼저 제시한다.
- Core NATS와 JetStream 및 SQS의 운영 계약을 구분한다.
- 보관·순서·중복·비용을 실제 비교 항목으로 만든다.

## 감점 포인트

- 한 제품이 모든 요구에서 가장 빠르고 안전하다고 말한다.
- NATS와 JetStream을 같은 전달 보장으로 설명한다.
- broker 선택만으로 외부 업무 멱등성이 해결된다고 말한다.

## 더 파고들 거리

- 장기 재생 로그와 즉시 RPC를 분리할 때 팀별 운영 책임은 어떻게 나눌까요?
- 관리형 큐 비용을 요청 수 외에 보관·데이터 이동·재전달까지 어떻게 계산할까요?
- broker 전환 기간에 이중 소비·중복·순서를 어떤 cutover로 통제할까요?

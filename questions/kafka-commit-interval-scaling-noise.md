---
id: "kafka-commit-interval-scaling-noise"
title: "커밋 간격 때문에 Kafka lag가 주기적으로 튑니다. autoscaling의 관찰 창과 안정화는 어떻게 조정하나요?"
difficulty: "중하"
category: "인프라"
tags: ["KEDA","Kafka","자동 확장","심화 질문"]
related: ["keda-kafka-partitions","kafka-consumer-group"]
promotedFrom: {"id":"keda-kafka-partitions","prompt":"커밋 간격으로 lag가 출렁일 때 autoscaling이 진동하지 않게 어떤 관찰 창을 둘까요."}
---

# 커밋 간격 때문에 Kafka lag가 주기적으로 튑니다. autoscaling의 관찰 창과 안정화는 어떻게 조정하나요?

## 구두 답변

처리 후 offset을 묶어 commit하면 lag가 톱니처럼 보일 수 있습니다. 실질 처리 속도와 가장 오래된 작업을 함께 보며 관찰 창·안정화로 단순 commit 파도를 과대 해석하지 않습니다.

창이 너무 길면 실제 backlog 증가를 늦게 감지합니다. commit 주기·batch·DB 지연을 하나씩 바꿔 확장·축소 진동과 p99를 비교합니다. replica 증가가 partition·원본 한도에 막히는지도 확인합니다.

## 득점 포인트

- 처리 후 offset을 묶어 commit하면 lag가 톱니처럼 보일 수 있습니다. 실질 처리 속도와 가장 오래된 작업을 함께 보며 관찰 창·안정화로 단순 commit 파도를 과대 해석하지 않습니다.
- replica 증가가 partition·원본 한도에 막히는지도 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 처리 후 offset을 묶어 commit하면 lag가 톱니처럼 보일 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka consumer group의 파티션 수보다 KEDA가 소비자 Pod를 많이 만들 때 처리량이 늘지 않는 이유는 무엇인가요?](/tech-interview/questions/keda-kafka-partitions/)

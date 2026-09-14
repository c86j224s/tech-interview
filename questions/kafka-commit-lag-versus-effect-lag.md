---
id: "kafka-commit-lag-versus-effect-lag"
title: "Kafka offset은 자주 커밋되지만 DB 처리는 늦거나 그 반대입니다. 로그 lag와 실제 작업 나이를 어떻게 구분하나요?"
difficulty: "중하"
category: "성능"
tags: ["Kafka","consumer lag","관측","심화 질문"]
related: ["kafka-lag-interpretation","kafka-consumer-group","bounded-queue-backpressure"]
promotedFrom: {"id":"kafka-lag-interpretation","prompt":"긴 DB 트랜잭션이 커밋 lag와 실제 처리 지연을 어떻게 어긋나게 하나요?"}
---

# Kafka offset은 자주 커밋되지만 DB 처리는 늦거나 그 반대입니다. 로그 lag와 실제 작업 나이를 어떻게 구분하나요?

## 구두 답변

fetch 위치·commit 위치·외부 DB 완료 위치와 가장 오래된 작업 나이를 나눕니다. offset을 빨리 commit하면 broker lag는 작아도 내부 큐에 미완료가 쌓일 수 있고 늦은 commit은 이미 처리한 일도 lag로 보일 수 있습니다.

정확한 commit 정책을 먼저 검증하고 autoscaling이 표면 lag만 따라 과잉 반응하지 않게 합니다. DB 지연·batch·revoke·재전달을 시험하고 최종 원장·중복·누락을 대조합니다.

## 득점 포인트

- fetch 위치·commit 위치·외부 DB 완료 위치와 가장 오래된 작업 나이를 나눕니다. offset을 빨리 commit하면 broker lag는 작아도 내부 큐에 미완료가 쌓일 수 있고 늦은 commit은 이미 처리한 일도 lag로 보일 수 있습니다.
- DB 지연·batch·revoke·재전달을 시험하고 최종 원장·중복·누락을 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: fetch 위치·commit 위치·외부 DB 완료 위치와 가장 오래된 작업 나이를 나눕니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka consumer lag가 큰 파티션이 보일 때 소비자 수를 늘리기 전에 어떤 원인을 어떻게 구분하나요?](/tech-interview/questions/kafka-lag-interpretation/)

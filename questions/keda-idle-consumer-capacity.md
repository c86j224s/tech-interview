---
id: "keda-idle-consumer-capacity"
title: "Kafka partition보다 많은 유휴 consumer를 허용합니다. 재할당 준비 이점과 유휴·리밸런싱 비용은 어떻게 평가하나요?"
difficulty: "중하"
category: "인프라"
tags: ["KEDA","Kafka","자동 확장","심화 질문"]
related: ["keda-kafka-partitions","kafka-consumer-group"]
promotedFrom: {"id":"keda-kafka-partitions","prompt":"allowIdleConsumers가 주는 재할당 선점 효과와 유휴 비용을 어떤 운영 조건에서 허용할까요."}
---

# Kafka partition보다 많은 유휴 consumer를 허용합니다. 재할당 준비 이점과 유휴·리밸런싱 비용은 어떻게 평가하나요?

## 구두 답변

partition보다 많은 일반 consumer는 일부가 유휴로 남아 처리량 상한을 늘리지 못합니다. 장애·재할당 시 준비된 인스턴스가 도움될 수 있지만 실제 비용과 리밸런싱 영향은 측정해야 합니다.

allowIdleConsumers의 버전·설정 계약을 확인합니다. 단일 핫 partition은 여전히 병목이고 분할하면 키 순서가 바뀔 수 있습니다. 유휴 연결·메모리·최대 Pod와 DB 전체 예산을 함께 봅니다.

## 득점 포인트

- partition보다 많은 일반 consumer는 일부가 유휴로 남아 처리량 상한을 늘리지 못합니다. 장애·재할당 시 준비된 인스턴스가 도움될 수 있지만 실제 비용과 리밸런싱 영향은 측정해야 합니다.
- 유휴 연결·메모리·최대 Pod와 DB 전체 예산을 함께 봅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: partition보다 많은 일반 consumer는 일부가 유휴로 남아 처리량 상한을 늘리지 못합니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka consumer group의 파티션 수보다 KEDA가 소비자 Pod를 많이 만들 때 처리량이 늘지 않는 이유는 무엇인가요?](/tech-interview/questions/keda-kafka-partitions/)

---
id: "kafka-unclean-election-policy"
title: "Kafka에서 unclean leader election을 허용합니다. 쓰기 재개와 성공 레코드 손실의 대가를 어떻게 정하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","acks","ISR","심화 질문"]
related: ["kafka-acks-isr","db-wal-durability"]
promotedFrom: {"id":"kafka-acks-isr","prompt":"unclean 허용 분류"}
---

# Kafka에서 unclean leader election을 허용합니다. 쓰기 재개와 성공 레코드 손실의 대가를 어떻게 정하나요?

## 구두 답변

unclean election은 동기화된 후보가 없을 때 뒤처진 replica를 리더로 삼아 가용성을 회복하는 대신 최신 레코드를 잃을 수 있는 선택입니다. 버전별 실제 정책과 기본값을 확인합니다.

재생성 가능한 로그와 금전 원장의 손실 비용을 구분합니다. 생산자가 성공받은 ID와 새 리더 로그를 대조하고 누락·중복 복구를 준비합니다. acks·min ISR·복제 수만으로 모든 장애에서 무손실이라고 하지 않습니다.

## 득점 포인트

- unclean election은 동기화된 후보가 없을 때 뒤처진 replica를 리더로 삼아 가용성을 회복하는 대신 최신 레코드를 잃을 수 있는 선택입니다. 버전별 실제 정책과 기본값을 확인합니다.
- acks·min ISR·복제 수만으로 모든 장애에서 무손실이라고 하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: unclean election은 동기화된 후보가 없을 때 뒤처진 replica를 리더로 삼아 가용성을 회복하는 대신 최신 레코드를 잃을 수 있는 선택입니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka에서 복제 계수 3, acks=all, min.insync.replicas=2일 때 ISR이 2개 또는 1개로 줄면 생산 요청은 어떻게 되나요?](/tech-interview/questions/kafka-acks-isr/)

---
id: "kafka-offset-gaps-compaction"
title: "Kafka offset 사이에 번호가 빠져 있습니다. compaction·제어 레코드와 실제 미처리 누락은 어떻게 구분하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","partition","offset","심화 질문"]
related: ["kafka-partition-offset","message-ordering-scope"]
promotedFrom: {"id":"kafka-partition-offset","prompt":"offset 빈 구간"}
---

# Kafka offset 사이에 번호가 빠져 있습니다. compaction·제어 레코드와 실제 미처리 누락은 어떻게 구분하나요?

## 구두 답변

Kafka offset은 배열의 연속 원소 번호가 아니며 compaction·삭제·내부 제어 레코드·소비 isolation 때문에 앱에 보이는 번호가 건너뛸 수 있습니다. 숫자 공백만으로 메시지 유실을 확정하지 않습니다.

실제 전달 순서와 consumer position·보관 시작·끝을 확인합니다. 다음 처리 위치 commit의 의미를 유지하고 존재하지 않는 모든 번호를 기다리지 않습니다. 이벤트의 논리 sequence가 필요한 경우 별도 필드로 검증합니다.

## 득점 포인트

- Kafka offset은 배열의 연속 원소 번호가 아니며 compaction·삭제·내부 제어 레코드·소비 isolation 때문에 앱에 보이는 번호가 건너뛸 수 있습니다. 숫자 공백만으로 메시지 유실을 확정하지 않습니다.
- 이벤트의 논리 sequence가 필요한 경우 별도 필드로 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Kafka offset은 배열의 연속 원소 번호가 아니며 compaction·삭제·내부 제어 레코드·소비 isolation 때문에 앱에 보이는 번호가 건너뛸 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka 메시지의 offset을 처리 완료 번호처럼 저장하려 합니다. topic·partition·offset은 무엇을 식별하며, 메시지 위치와 실제 처리 완료는 왜 구분해야 하나요?](/tech-interview/questions/kafka-partition-offset/)

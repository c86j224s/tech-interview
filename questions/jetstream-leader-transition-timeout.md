---
id: "jetstream-leader-transition-timeout"
title: "JetStream 리더 전환 중 생산 요청이 timeout됐습니다. 저장 여부와 중복 발행을 어떻게 확인하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["NATS","JetStream","복제","심화 질문"]
related: ["jetstream-stream-replication","consensus-quorum-failure"]
promotedFrom: {"id":"jetstream-stream-replication","prompt":"leader 전환 timeout"}
---

# JetStream 리더 전환 중 생산 요청이 timeout됐습니다. 저장 여부와 중복 발행을 어떻게 확인하나요?

## 구두 답변

PubAck를 못 받았어도 stream에 저장됐을 수 있습니다. 안정적인 메시지 ID와 지원 dedup 범위·결과 조회를 사용하고 새 ID로 무조건 발행하지 않습니다.

리더 전환·quorum 손실·느린 replica·응답만 유실을 구분해 기록합니다. 생산 확인은 소비자 DB 처리 완료가 아닙니다. 정상 응답 ID와 불확정 ID를 복구 로그와 대조합니다.

## 득점 포인트

- PubAck를 못 받았어도 stream에 저장됐을 수 있습니다. 안정적인 메시지 ID와 지원 dedup 범위·결과 조회를 사용하고 새 ID로 무조건 발행하지 않습니다.
- 정상 응답 ID와 불확정 ID를 복구 로그와 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: PubAck를 못 받았어도 stream에 저장됐을 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: JetStream stream의 replicas를 1에서 3으로 늘리려 합니다. 저장 확인, 장애 대응, 자원 비용에서 무엇이 달라지나요?](/tech-interview/questions/jetstream-stream-replication/)

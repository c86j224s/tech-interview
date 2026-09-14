---
id: "outbox-claim-lease-recovery"
title: "여러 outbox 발행자가 claim합니다. lease 만료와 늦은 완료·재발행은 어떤 owner·버전으로 처리하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["outbox","메시지","트랜잭션","심화 질문"]
related: ["transactional-outbox","request-timeout-idempotency","db-wal-durability"]
promotedFrom: {"id":"transactional-outbox","prompt":"여러 전달자의 claim과 lease 만료를 어떻게 안전하게 설계하나요?"}
---

# 여러 outbox 발행자가 claim합니다. lease 만료와 늦은 완료·재발행은 어떤 owner·버전으로 처리하나요?

## 구두 답변

claim은 발행자의 임시 실행권이고 lease 만료는 옛 프로세스 종료의 증거가 아닙니다. 완료 표시에 owner·generation 조건을 두고 같은 event ID 재발행을 소비자가 멱등 처리하게 합니다.

broker ACK 후 DB 표시 전 중단은 중복을 만들 수 있습니다. 락 안에서 긴 네트워크를 기다리는 비용과 짧은 claim 상태의 복구 비용을 비교합니다. 여러 전달자의 순서·삭제·재개를 시험합니다.

## 득점 포인트

- claim은 발행자의 임시 실행권이고 lease 만료는 옛 프로세스 종료의 증거가 아닙니다. 완료 표시에 owner·generation 조건을 두고 같은 event ID 재발행을 소비자가 멱등 처리하게 합니다.
- 여러 전달자의 순서·삭제·재개를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: claim은 발행자의 임시 실행권이고 lease 만료는 옛 프로세스 종료의 증거가 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 주문 완료 상태는 DB에 저장됐는데 직후 서버가 꺼져 완료 메시지는 발행되지 않았습니다. transactional outbox로 유실을 어떻게 막고 재발행 중복은 어떻게 처리하나요?](/tech-interview/questions/transactional-outbox/)

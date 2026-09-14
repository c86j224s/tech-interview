---
id: "transactional-audit-record"
title: "데이터 변경과 보안 감사 기록을 반드시 함께 남겨야 합니다. 일반 비동기 로그와 어떤 내구 경계를 다르게 두나요?"
difficulty: "중하"
category: "설계"
tags: ["로그","관측","개인정보","심화 질문"]
related: ["logging-performance-safety","distributed-tracing-boundaries"]
promotedFrom: {"id":"logging-performance-safety","prompt":"감사 이벤트와 데이터 변경 트랜잭션을 연결할 때 내구성과 중복을 어떻게 보장할까요?"}
---

# 데이터 변경과 보안 감사 기록을 반드시 함께 남겨야 합니다. 일반 비동기 로그와 어떤 내구 경계를 다르게 두나요?

## 구두 답변

감사 기록이 변경과 반드시 함께 존재해야 하면 같은 DB transaction의 감사 테이블·outbox 등에 원자적으로 기록합니다. 일반 비동기 로그 큐의 drop 정책에 맡기면 한쪽만 남을 수 있습니다.

전송은 재시도 가능하게 하고 안정 ID로 중복을 처리합니다. 감사 필드·접근·보존·비밀 최소화를 정합니다. 기록 실패 때 변경을 거절할지 명시하고 commit·전송 전후 중단을 시험합니다.

## 득점 포인트

- 감사 기록이 변경과 반드시 함께 존재해야 하면 같은 DB transaction의 감사 테이블·outbox 등에 원자적으로 기록합니다. 일반 비동기 로그 큐의 drop 정책에 맡기면 한쪽만 남을 수 있습니다.
- 기록 실패 때 변경을 거절할지 명시하고 commit·전송 전후 중단을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 감사 기록이 변경과 반드시 함께 존재해야 하면 같은 DB transaction의 감사 테이블·outbox 등에 원자적으로 기록합니다.

## 더 파고들 거리

- [기본 상황과 비교: 장애 재현을 위해 요청 로그를 늘리려는데 처리 지연과 개인정보 노출이 걱정됩니다. 어떤 필드를 남기고, 로그가 밀리면 무엇을 버리거나 보존하나요?](/tech-interview/questions/logging-performance-safety/)

---
id: "nats-inbox-request-lifetime"
title: "NATS request-reply의 inbox를 재사용합니다. 늦은 응답이 새 요청에 섞이지 않게 어떤 상관 ID와 수명을 두나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["NATS","request-reply","타임아웃","심화 질문"]
related: ["nats-request-reply","request-timeout-idempotency"]
promotedFrom: {"id":"nats-request-reply","prompt":"inbox 재사용"}
---

# NATS request-reply의 inbox를 재사용합니다. 늦은 응답이 새 요청에 섞이지 않게 어떤 상관 ID와 수명을 두나요?

## 구두 답변

inbox와 요청 상관 ID를 연결하고 만료·완료된 요청의 늦은 응답을 새 요청에 적용하지 않습니다. client의 inbox multiplexing 구현을 직접 추측하지 않고 API 계약을 따릅니다.

timeout으로 구독을 정리해도 responder의 작업은 계속될 수 있습니다. 변경 요청은 논리 ID로 결과를 조회합니다. 중복 응답·재접속·큰 payload·권한을 시험합니다.

## 득점 포인트

- inbox와 요청 상관 ID를 연결하고 만료·완료된 요청의 늦은 응답을 새 요청에 적용하지 않습니다. client의 inbox multiplexing 구현을 직접 추측하지 않고 API 계약을 따릅니다.
- 중복 응답·재접속·큰 payload·권한을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: inbox와 요청 상관 ID를 연결하고 만료·완료된 요청의 늦은 응답을 새 요청에 적용하지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: NATS로 작업을 요청했는데 no responders 또는 timeout이 반환됩니다. 두 결과는 무엇이 다르며, 재시도 전에 작업이 실행됐는지 어떻게 판단하나요?](/tech-interview/questions/nats-request-reply/)

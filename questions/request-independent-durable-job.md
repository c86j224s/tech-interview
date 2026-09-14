---
id: "request-independent-durable-job"
title: "요청 연결이 끝나도 반드시 완료할 작업을 접수합니다. 내구성·소유권·결과 조회를 어떻게 분리하나요?"
difficulty: "중하"
category: "설계"
tags: ["타임아웃","취소","데드라인","심화 질문"]
related: ["deadline-cancellation-propagation","request-timeout-idempotency","goroutine-lifecycle-and-leaks"]
promotedFrom: {"id":"deadline-cancellation-propagation","prompt":"부모 요청과 무관하게 완료할 작업에는 어떤 내구성과 소유권이 필요할까요?"}
---

# 요청 연결이 끝나도 반드시 완료할 작업을 접수합니다. 내구성·소유권·결과 조회를 어떻게 분리하나요?

## 구두 답변

요청은 내구 작업 ID를 접수하고 결과를 나중 조회하는 계약으로 분리합니다. 큐에 넣었다는 응답은 실제 처리 완료와 다르며 접수 기록을 잃지 않는 지점에서 반환해야 합니다.

별도 worker가 소유권·deadline·재시도·멱등 결과를 관리합니다. 사용자 권한 철회와 중단 정책을 중요한 실행 단계에서 다시 검사합니다. 단순 detached 고루틴은 프로세스 종료에 사라질 수 있어 필수 완료의 내구성이 아닙니다.

## 득점 포인트

- 요청은 내구 작업 ID를 접수하고 결과를 나중 조회하는 계약으로 분리합니다. 큐에 넣었다는 응답은 실제 처리 완료와 다르며 접수 기록을 잃지 않는 지점에서 반환해야 합니다.
- 단순 detached 고루틴은 프로세스 종료에 사라질 수 있어 필수 완료의 내구성이 아닙니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 요청은 내구 작업 ID를 접수하고 결과를 나중 조회하는 계약으로 분리합니다.

## 더 파고들 거리

- [기본 상황과 비교: 사용자 요청이 타임아웃됐는데 하위 API 호출과 DB 작업은 계속 실행됩니다. 응답 대기 종료와 작업 취소를 어떻게 구분하고 어디까지 전파하나요?](/tech-interview/questions/deadline-cancellation-propagation/)

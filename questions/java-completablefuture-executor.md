---
id: "java-completablefuture-executor"
title: "CompletableFuture 체인에서 느린 I/O를 실행하자 다른 비동기 작업도 지연됩니다. executor와 실행 스레드는 어떻게 정해지나요?"
answerMinutes: 5
followups: [{"id": "async-api-and-blocking", "prompt": "비동기 반환값을 받았어도 실제 대기·동기 호출이 어느 스레드를 막는지 어떻게 찾나요?"}, {"id": "js-promise-error-chain", "prompt": "오류를 대체 값으로 바꾸면 후속 체인이 성공으로 진행하는 의미를 어떻게 정하나요?"}, {"id": "bulkhead-isolation", "prompt": "한 기능의 느린 외부 호출이 다른 기능의 worker·연결을 고갈시키지 않게 어떻게 격리하나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["Java", "언어·런타임"]
related: ["async-api-and-blocking", "js-promise-error-chain", "bulkhead-isolation"]
---

# CompletableFuture 체인에서 느린 I/O를 실행하자 다른 비동기 작업도 지연됩니다. executor와 실행 스레드는 어떻게 정해지나요?

## 구두 답변

CompletableFuture의 단계가 어느 스레드에서 실행되는지는 async 여부와 지정한 executor, 완료 시점에 달려 있습니다. 비동기 타입을 썼다고 모든 작업이 독립된 전용 스레드에서 실행되는 것은 아닙니다.

### 동작 원리와 전제

non-async 단계는 완료를 수행하는 스레드에서 실행될 수 있고 async 단계는 지정 executor나 기본 executor를 사용할 수 있습니다. 공용 풀에 긴 블로킹 I/O를 넣으면 다른 계산이 기다릴 수 있어 작업 유형과 풀 정책을 분리합니다.

### 선택과 실패 처리

thenApply와 thenCompose는 값 변환과 중첩 비동기 결과 연결이 다릅니다. 예외 복구가 성공 값으로 바뀌는 경로와 실제 외부 작업 취소도 구분해야 합니다. timeout future가 완성됐다고 원래 I/O가 멈추는 것은 아닙니다.

### 구체적인 사례와 검증

완료 직후 이어지는 thenApply가 무거운 JSON 변환을 하면 네트워크 완료 스레드가 그 계산을 수행할 수 있습니다. 이후 다른 요청의 완료 처리까지 늦어지는지 관찰합니다. async를 붙이는 것은 실행 위치를 바꾸는 선택이고 작업 수·큐 길이·예산을 자동 제한하는 것은 아닙니다. 별도 executor를 사용해도 그 큐가 무제한이면 부하가 메모리로 이동합니다. 예외 복구 함수가 기본값을 반환하면 후속 단계는 성공으로 진행할 수 있어 정상 빈 결과와 실패를 구분합니다. 완료·취소·timeout의 future 상태와 실제 하위 I/O 종료를 분리해 테스트하겠습니다.

완료가 빠른·늦은 경우, 풀 포화, 예외·취소·중첩 future를 시험합니다. executor 큐와 동시성 상한을 두고 context 전달도 확인합니다. API 이름보다 실제 실행 스레드·작업 수명·예외 전파 계약을 기준으로 설계하겠습니다.

## 득점 포인트

- 핵심 구분: CompletableFuture의 단계가 어느 스레드에서 실행되는지는 async 여부와 지정한 executor, 완료 시점에 달려 있습니다.
- 선택 조건: thenApply와 thenCompose는 값 변환과 중첩 비동기 결과 연결이 다릅니다.
- 검증 기준: 완료가 빠른·늦은 경우, 풀 포화, 예외·취소·중첩 future를 시험합니다.

## 감점 포인트

- CompletableFuture의 async 단계는 항상 새 전용 스레드에서 실행된다고 한다.

## 더 파고들 거리

- 비동기 반환값을 받았어도 실제 대기·동기 호출이 어느 스레드를 막는지 어떻게 찾나요?
- 오류를 대체 값으로 바꾸면 후속 체인이 성공으로 진행하는 의미를 어떻게 정하나요?
- 한 기능의 느린 외부 호출이 다른 기능의 worker·연결을 고갈시키지 않게 어떻게 격리하나요?

---
id: "python-asyncio-taskgroup"
title: "Python TaskGroup에서 한 작업이 실패하면 다른 작업과 예외는 어떻게 처리되나요?"
answerMinutes: 5
followups: [{"id": "structured-concurrency-fanout", "prompt": "여러 하위 작업 중 하나가 실패하면 필수·선택 결과와 남은 자원 수명을 어떻게 나누나요?"}, {"id": "python-contextvars-async", "prompt": "한 스레드의 여러 task에 요청별 문맥을 전파하면서 가변 객체 공유는 어떻게 막나요?"}, {"id": "bounded-queue-backpressure", "prompt": "수락한 요청이 계속 쌓이면 실행 수와 대기 수를 어떤 별도 상한으로 제한하나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["Python", "언어·런타임", "TaskGroup"]
related: ["structured-concurrency-fanout", "python-contextvars-async", "bounded-queue-backpressure"]
---

# Python TaskGroup에서 한 작업이 실패하면 다른 작업과 예외는 어떻게 처리되나요?

## 구두 답변

TaskGroup은 관련 task를 하나의 수명 범위로 묶고 종료 때 완료를 기다리는 구조적 동시성 도구입니다. 한 작업의 실패가 다른 작업의 취소와 예외 집계로 이어질 수 있지만 task가 취소를 협력적으로 처리해야 합니다.

### 동작 원리와 전제

예외는 ExceptionGroup 등으로 묶여 전달될 수 있어 첫 오류 문자열만 읽는 처리와 다릅니다. CancelledError를 삼키고 계속 실행하면 상위 수명 계약을 깨뜨릴 수 있습니다. cleanup은 finally로 수행하되 실제 외부 변경이 rollback된다고 가정하지 않습니다.

### 선택과 실패 처리

필수와 선택 결과를 나누고 선택 실패를 로컬 결과로 표현할지 전체 그룹 실패로 만들지 정합니다. TaskGroup 자체가 생성 task 수와 입력 큐를 무제한 제한하는 것은 아니므로 semaphore·bounded queue가 필요할 수 있습니다.

### 구체적인 사례와 검증

두 task가 비슷한 시점에 실패하면 한 오류만 있다고 가정한 except 처리로 필요한 원인을 놓칠 수 있습니다. ExceptionGroup의 구조와 except* 처리 범위를 이해하고 각 오류가 필수 결과의 실패인지 선택 결과인지 구분합니다. 취소를 받은 cleanup이 다시 실패할 수도 있어 원래 원인과 정리 실패를 함께 기록합니다. TaskGroup을 벗어나면 자식 완료를 기다리는 구조가 유용하지만, 별도로 create_task해서 참조를 잃으면 그 수명 바깥의 작업이 생길 수 있습니다. 모든 비동기 작업이 그룹에 속하는지와 task 생성량이 제한되는지를 실제 코드에서 확인하겠습니다.

동시 실패·취소 중 cleanup·외부 I/O의 취소 무시·부분 결과를 시험합니다. 사용하는 Python 버전의 예외·취소 의미를 확인합니다. task를 만들었다는 사실보다 누가 기다리고 누가 실패를 소유하는지를 명확히 하겠습니다.

## 득점 포인트

- 핵심 구분: TaskGroup은 관련 task를 하나의 수명 범위로 묶고 종료 때 완료를 기다리는 구조적 동시성 도구입니다.
- 선택 조건: 필수와 선택 결과를 나누고 선택 실패를 로컬 결과로 표현할지 전체 그룹 실패로 만들지 정합니다.
- 검증 기준: 동시 실패·취소 중 cleanup·외부 I/O의 취소 무시·부분 결과를 시험합니다.

## 감점 포인트

- TaskGroup이 task 개수 제한과 모든 외부 I/O의 강제 취소를 제공한다고 한다.

## 더 파고들 거리

- 여러 하위 작업 중 하나가 실패하면 필수·선택 결과와 남은 자원 수명을 어떻게 나누나요?
- 한 스레드의 여러 task에 요청별 문맥을 전파하면서 가변 객체 공유는 어떻게 막나요?
- 수락한 요청이 계속 쌓이면 실행 수와 대기 수를 어떤 별도 상한으로 제한하나요?

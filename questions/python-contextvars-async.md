---
id: "python-contextvars-async"
title: "asyncio에서 요청별 사용자 정보를 전역 변수나 thread-local에 넣으면 왜 섞일 수 있고 contextvars는 어떻게 도움이 되나요?"
answerMinutes: 5
followups: [{"id": "java-threadlocal-pool", "prompt": "재사용 실행 단위에 이전 사용자 문맥이 남지 않게 어떤 설정·정리 수명을 두나요?"}, {"id": "python-asyncio-blocking", "prompt": "같은 이벤트 루프에서 동기 대기나 긴 계산이 다른 요청에 미치는 영향은 무엇인가요?"}, {"id": "go-context-values", "prompt": "취소·요청 메타데이터와 필수 의존성을 context에 어떻게 구분해 전달하나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["Python", "언어·런타임", "context"]
related: ["java-threadlocal-pool", "python-asyncio-blocking", "go-context-values"]
---

# asyncio에서 요청별 사용자 정보를 전역 변수나 thread-local에 넣으면 왜 섞일 수 있고 contextvars는 어떻게 도움이 되나요?

## 구두 답변

한 OS 스레드에서 여러 coroutine이 교대로 실행되므로 thread-local은 요청별 격리를 제공하지 못할 수 있습니다. contextvars는 비동기 실행 문맥에 연결된 값을 다루지만 task 생성·스레드 이동의 전파 계약을 확인해야 합니다.

### 동작 원리와 전제

각 요청에서 값을 설정하고 반환 토큰으로 finally에서 reset하면 이전 문맥을 복원할 수 있습니다. task가 생성될 때 문맥을 어떻게 복사하는지와 executor로 넘길 때의 동작은 API별로 확인합니다. 가변 객체를 값으로 넣으면 내부 상태가 자동 복사·동기화되지는 않습니다.

### 선택과 실패 처리

인증 정보는 신뢰된 요청 경계에서 설정하고 값이 없을 때 안전하게 실패합니다. 모든 의존성을 context에 숨기지 않고 계산에 필요한 필수 입력은 명시적으로 전달합니다. 백그라운드 작업이 요청 사용자 문맥을 오래 붙잡지 않게 수명을 정합니다.

### 구체적인 사례와 검증

요청 A가 user=A를 설정한 뒤 await하고 B가 user=B를 설정하는 상황에서 전역 변수는 A 재개 시 B 값을 볼 수 있습니다. task별 context를 사용하면 이 문맥을 분리할 수 있지만 값으로 넣은 dict를 양쪽이 공유·수정하면 별도의 공유 상태가 됩니다. 토큰으로 reset하는 finally 경로를 두고 nested scope가 이전 값을 복원하는지 확인합니다. executor로 넘긴 작업이 어떤 context를 받는지 API별 시험을 만들고, 요청 종료 뒤 detached 작업에 인증 문맥이 불필요하게 남지 않게 합니다. context 전파와 실제 권한 검사는 서로 다른 계층입니다.

여러 task의 교차 실행·취소·중첩 설정·스레드 전환을 시험합니다. contextvars는 문맥 전파 도구이고 외부 시스템 인가의 대체재가 아닙니다. 로그 상관 ID와 실제 사용자 권한도 별도 의미로 유지하겠습니다.

## 득점 포인트

- 핵심 구분: 한 OS 스레드에서 여러 coroutine이 교대로 실행되므로 thread-local은 요청별 격리를 제공하지 못할 수 있습니다.
- 선택 조건: 인증 정보는 신뢰된 요청 경계에서 설정하고 값이 없을 때 안전하게 실패합니다.
- 검증 기준: 여러 task의 교차 실행·취소·중첩 설정·스레드 전환을 시험합니다.

## 감점 포인트

- 한 스레드의 thread-local이 모든 asyncio 요청을 자동 격리한다고 한다.

## 더 파고들 거리

- 재사용 실행 단위에 이전 사용자 문맥이 남지 않게 어떤 설정·정리 수명을 두나요?
- 같은 이벤트 루프에서 동기 대기나 긴 계산이 다른 요청에 미치는 영향은 무엇인가요?
- 취소·요청 메타데이터와 필수 의존성을 context에 어떻게 구분해 전달하나요?

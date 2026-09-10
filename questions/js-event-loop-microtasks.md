---
id: js-event-loop-microtasks
title: "한 JavaScript 실행 흐름에서 동기 로그, 이미 이행된 Promise의 콜백, 지연 0인 setTimeout을 등록했습니다. 왜 등록 순서와 실행 순서가 다를 수 있나요?"
answerMinutes: 5
followups: [{"id":"js-promise-error-chain","prompt":"마이크로태스크 안에서 throw한 오류가 동기 try/catch에 잡히지 않는 이유는 Promise 상태와 어떻게 연결되나요?"},{"id":"python-asyncio-blocking","prompt":"JavaScript 이벤트 루프와 asyncio 이벤트 루프에서 긴 동기 계산을 분리하는 수단은 어떻게 다른가요?"},{"id":"throughput-vs-latency","prompt":"마이크로태스크 폭주를 줄인 뒤 처리량과 입력 지연이 어떻게 달라졌는지 어떤 지표로 확인할까요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["JavaScript","이벤트 루프","마이크로태스크","Promise"]
related: ["js-promise-error-chain","js-async-await-parallel"]
---

# 한 JavaScript 실행 흐름에서 동기 로그, 이미 이행된 Promise의 콜백, 지연 0인 setTimeout을 등록했습니다. 왜 등록 순서와 실행 순서가 다를 수 있나요?

## 구두 답변

다음 코드는 일반적인 브라우저와 Node.js의 현재 작업에서 실행된다고 하겠습니다.

### 현재 작업이 끝난 다음

```js
console.log('A');
setTimeout(() => console.log('timer'), 0);
Promise.resolve().then(() => console.log('microtask'));
console.log('B');
// A
// B
// microtask
// timer
```

먼저 현재 JavaScript 작업의 동기 코드가 호출 스택에서 끝까지 실행됩니다. 따라서 `A`, `B`가 먼저 출력됩니다. `Promise.then`에 등록한 함수는 즉시 실행되지 않고 마이크로태스크 큐에 들어갑니다. 현재 작업이 끝나면 런타임은 보통 다음 타이머 작업으로 넘어가기 전에 마이크로태스크 큐를 비웁니다. `setTimeout(..., 0)`의 0은 즉시 실행이 아니라 최소 지연을 요청하는 값이므로, 타이머 콜백은 그 뒤의 작업 큐에서 실행됩니다.

이 순서를 이벤트 루프가 모든 비동기 일을 동시에 처리한다고 설명하면 안 됩니다. 한 번에 실행되는 JavaScript 작업은 하나이며, Node.js가 일부 파일·네트워크 작업을 워커나 운영체제에 맡길 수 있어도 콜백을 JavaScript로 돌려보내는 시점의 순서는 별도 규칙을 따릅니다. 마이크로태스크에서 계속 새 마이크로태스크를 추가하면 타이머나 화면 갱신이 지연되는 기아가 생길 수도 있습니다.

### 호스트 큐와 기아

따라서 짧은 후속 상태 반영은 Promise 마이크로태스크에 둘 수 있지만, 오래 걸리는 계산을 그 안에 넣어도 비동기가 되는 것은 아닙니다. 브라우저 화면이나 Node 버전별 세부 큐, Node의 `process.nextTick` 같은 우선순위까지 문제 삼는다면 실행 환경을 먼저 고정하고 직접 관찰하겠습니다.

### 선택 기준과 검증

마이크로태스크를 연속으로 추가하면 현재 작업 사이에 계속 실행되어 타이머·입력·렌더링이 기회를 얻지 못할 수 있습니다. 짧은 상태 반영은 microtask에 둘 수 있지만 긴 계산은 Worker나 별도 작업으로 옮겨야 합니다. ECMAScript의 Promise 순서와 브라우저 렌더링·Node의 timer 및 `process.nextTick` 순서는 서로 다른 층이므로 실제 호스트에서 따로 측정하겠습니다.

이미 이행된 Promise를 await해도 일반적인 후속 실행은 현재 동기 흐름 뒤의 Promise 작업으로 예약됩니다. 하지만 Promise 생성자의 executor 자체는 생성할 때 동기 실행되므로, 생성자 안의 긴 계산은 microtask로 미뤄지지 않습니다. 이런 시작 시점과 후속 콜백 시점을 나누면 'Promise로 감싸면 비동기 계산이 된다'는 오해를 피할 수 있습니다.

브라우저에는 단순한 전역 FIFO 큐 하나만 있는 것이 아니라 여러 작업 소스와 렌더링 기회가 있습니다. setTimeout의 지연은 최소 대기 요청이지 정확한 실행 시각 보장이 아니며 백그라운드 탭의 제한도 받을 수 있습니다. 렌더링을 기다릴 목적으로 microtask를 계속 연결하면 오히려 화면 갱신 기회를 늦출 수 있습니다. 프레임과 함께 처리할 변경은 requestAnimationFrame 등의 호스트 계약을 검토하고 긴 CPU 계산은 Worker나 작은 실행 단위로 분리하겠습니다.

## 득점 포인트

- 동기 작업·마이크로태스크·타이머의 상대 순서를 설명한다.
- 0ms와 즉시 실행을 구분한다.
- 마이크로태스크 폭주와 호스트별 세부 차이를 관찰한다.

## 감점 포인트

- Promise 콜백이 현재 동기 코드보다 먼저 실행된다고 말한다.
- setTimeout 0이 현재 스택을 중단하고 즉시 실행된다고 단정한다.
- 이벤트 루프가 긴 JavaScript 계산을 자동으로 다른 스레드로 옮긴다고 설명한다.

## 더 파고들 거리

- Node의 `process.nextTick`과 Promise microtask의 우선순위를 어떤 버전에서 재현할까요?
- 브라우저 microtask 폭주가 렌더링·입력 지연으로 이어지는 경로는 무엇인가요?
- event loop lag를 CPU 계산·I/O callback 대기와 어떤 계측으로 분리할까요?

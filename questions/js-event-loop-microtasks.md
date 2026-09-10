---
id: js-event-loop-microtasks
title: "한 JavaScript 실행 흐름에서 동기 로그, 이미 이행된 Promise의 콜백, 지연 0인 setTimeout을 등록했습니다. 왜 등록 순서와 실행 순서가 다를 수 있나요?"
difficulty: 중하
category: 언어·런타임
tags: ["JavaScript","이벤트 루프","마이크로태스크","Promise"]
related: ["js-promise-error-chain","js-async-await-parallel"]
---

# 한 JavaScript 실행 흐름에서 동기 로그, 이미 이행된 Promise의 콜백, 지연 0인 setTimeout을 등록했습니다. 왜 등록 순서와 실행 순서가 다를 수 있나요?

## 구두 답변

다음 코드는 일반적인 브라우저와 Node.js의 현재 작업에서 실행된다고 하겠습니다.

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

따라서 짧은 후속 상태 반영은 Promise 마이크로태스크에 둘 수 있지만, 오래 걸리는 계산을 그 안에 넣어도 비동기가 되는 것은 아닙니다. 브라우저 화면이나 Node 버전별 세부 큐, Node의 `process.nextTick` 같은 우선순위까지 문제 삼는다면 실행 환경을 먼저 고정하고 직접 관찰하겠습니다.

## 득점 포인트

- 현재 동기 작업·마이크로태스크·타이머 작업의 상대 순서를 설명한다.
- setTimeout의 0이 즉시 실행을 뜻하지 않음을 구분한다.
- 마이크로태스크 연쇄가 다른 작업을 지연시킬 수 있음을 말한다.

## 감점 포인트

- Promise 콜백이 동기 코드보다 먼저 실행된다고 말한다.
- setTimeout 0이면 현재 스택이 끝나기 전에 실행된다고 단정한다.
- 이벤트 루프가 긴 JavaScript 계산을 자동으로 다른 스레드로 옮긴다고 말한다.

## 더 파고들 거리

- Node.js의 process.nextTick과 Promise 마이크로태스크는 어떤 우선순위를 보이나요?
- 마이크로태스크 폭주가 브라우저 렌더링과 입력 처리에 어떤 영향을 주나요?
- 이벤트 루프 지연을 실제 Node 지표로 어떻게 측정하나요?

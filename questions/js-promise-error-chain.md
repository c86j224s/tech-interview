---
id: js-promise-error-chain
title: "Promise 체인 중간에서 오류를 잡고 대체 값을 반환했습니다. 뒤의 then은 실행되며, 호출자에게 실패를 계속 전달하려면 어떻게 해야 하나요?"
answerMinutes: 5
followups: [{"id":"js-event-loop-microtasks","prompt":"catch에서 복구한 then이 어느 마이크로태스크 시점에 실행되는지 어떻게 관찰할까요?"},{"id":"js-async-await-parallel","prompt":"Promise.all 안의 한 작업이 reject된 뒤 다른 작업의 부작용과 오류를 어떻게 수집할까요?"},{"id":"request-timeout-idempotency","prompt":"catch에서 재시도하기 전 이전 Promise가 외부 변경을 완료했는지 모를 때 어떤 멱등 계약이 필요할까요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["JavaScript","Promise","예외 전파","catch"]
related: ["js-event-loop-microtasks","js-async-await-parallel"]
---

# Promise 체인 중간에서 오류를 잡고 대체 값을 반환했습니다. 뒤의 then은 실행되며, 호출자에게 실패를 계속 전달하려면 어떻게 해야 하나요?

## 구두 답변

`then` 콜백에서 `throw`하거나 거부된 Promise를 반환하면 그 지점부터 뒤의 체인은 rejected 상태로 이어집니다. `catch`는 앞에서 전파된 rejection을 받아 처리하고, 정상 값을 반환하면 그 다음 체인을 다시 fulfilled 상태로 바꿉니다.

### 새 Promise로 이어지는 상태

```js
Promise.resolve('start')
  .then(() => { throw new Error('boom'); })
  .then(() => console.log('skip'))
  .catch(error => { console.log(error.message); return 'recovered'; })
  .then(value => console.log(value));
// boom
// recovered
```

각 `then`은 원래 Promise를 바꾸는 것이 아니라 새 Promise를 반환합니다. 첫 번째 콜백의 `throw`는 새 Promise를 rejected로 만들고, 바로 다음 `then`의 성공 콜백은 건너뜁니다. 뒤의 `catch`가 오류를 받아 값을 반환했기 때문에 마지막 `then`은 그 값을 받습니다. `return Promise.reject(error)`도 rejection을 유지하고, 콜백 내부에서 다른 Promise를 반환하면 그 상태가 새 체인에 채택됩니다.

### 복구와 실패 전파

오류를 기록만 하고 삼키면 이후에는 성공처럼 보일 수 있습니다. 복구할 수 없는 오류라면 `catch`에서 다시 throw하거나 rejected Promise를 반환해야 최종 호출자가 실패를 알 수 있습니다. 반대로 `catch` 자체에서 새 오류를 던지면 그 뒤의 다음 `catch`가 처리합니다. Promise의 비동기 콜백은 현재 동기 스택이 끝난 뒤 실행되므로, 동기 `try/catch`가 나중의 rejection을 자동으로 잡는다고 생각해서도 안 됩니다.

### 선택 기준과 검증

`catch` 안에서 다시 throw하면 새 rejection이 만들어져 뒤의 catch로 이동하고, 값을 반환하면 이후 then이 정상 경로가 됩니다. 따라서 로그만 남기고 기본값을 반환하는 코드는 호출자에게 성공으로 보일 수 있습니다. 오류 원인은 `cause` 등으로 보존하고, 외부 변경의 결과가 불확실할 때는 재전파와 롤백을 동일시하지 않겠습니다.

콜백 안에서 다른 비동기 작업을 시작했지만 return하지 않으면 바깥 체인은 그 작업의 완료를 기다리지 않습니다. 뒤의 then이 먼저 실행되고 내부 rejection은 바깥 catch와 분리될 수 있습니다. 이를 떠 있는 Promise 또는 누락된 체인 연결 문제로 설명할 수 있습니다. 작업을 체인의 일부로 취급하려면 해당 Promise를 반환하거나 async 함수에서 await해야 합니다.

then(success, failure)의 failure는 같은 then의 success가 던진 오류를 처리하지 않습니다. success 실행이 만든 새 Promise의 거부는 그 뒤 catch가 받기 때문입니다. finally는 보통 값·오류를 그대로 통과시키면서 정리를 수행하지만, finally가 예외를 던지거나 거부된 Promise를 반환하면 원래 결과를 대체할 수 있습니다. 정리 실패가 원래 오류를 가리지 않게 원인과 보조 오류를 보존하고, 최종 호출자가 완료와 실패를 반드시 관찰하게 하겠습니다.

## 득점 포인트

- throw·reject·catch 반환이 새 Promise 상태를 바꾸는 과정을 설명한다.
- 복구와 오류 재전파를 구분한다.
- 비동기 오류 경계와 외부 부작용 재시도를 분리한다.

## 감점 포인트

- 중간 throw 뒤의 모든 성공 then이 실행된다고 말한다.
- catch에서 값을 반환해도 뒤 then이 계속 rejected라고 설명한다.
- 동기 try/catch가 나중의 Promise rejection까지 자동으로 잡는다고 가정한다.

## 더 파고들 거리

- Promise 생성자 실행부의 동기 throw와 then 내부 throw는 관찰 시점이 어떻게 다른가요?
- 여러 catch에서 가장 가까운 rejection 경계는 어떻게 선택되나요?
- unhandled rejection을 기록하면서 프로세스 종료 정책을 어떻게 정할까요?

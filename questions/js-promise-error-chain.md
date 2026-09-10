---
id: js-promise-error-chain
title: "Promise 체인 중간에서 오류를 잡고 대체 값을 반환했습니다. 뒤의 then은 실행되며, 호출자에게 실패를 계속 전달하려면 어떻게 해야 하나요?"
difficulty: 중하
category: 언어·런타임
tags: ["JavaScript","Promise","예외 전파","catch"]
related: ["js-event-loop-microtasks","js-async-await-parallel"]
---

# Promise 체인 중간에서 오류를 잡고 대체 값을 반환했습니다. 뒤의 then은 실행되며, 호출자에게 실패를 계속 전달하려면 어떻게 해야 하나요?

## 구두 답변

`then` 콜백에서 `throw`하거나 거부된 Promise를 반환하면 그 지점부터 뒤의 체인은 rejected 상태로 이어집니다. `catch`는 앞에서 전파된 rejection을 받아 처리하고, 정상 값을 반환하면 그 다음 체인을 다시 fulfilled 상태로 바꿉니다.

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

오류를 기록만 하고 삼키면 이후에는 성공처럼 보일 수 있습니다. 복구할 수 없는 오류라면 `catch`에서 다시 throw하거나 rejected Promise를 반환해야 최종 호출자가 실패를 알 수 있습니다. 반대로 `catch` 자체에서 새 오류를 던지면 그 뒤의 다음 `catch`가 처리합니다. Promise의 비동기 콜백은 현재 동기 스택이 끝난 뒤 실행되므로, 동기 `try/catch`가 나중의 rejection을 자동으로 잡는다고 생각해서도 안 됩니다.

## 득점 포인트

- throw와 reject가 체인의 rejected 상태로 변환되는 과정을 설명한다.
- then·catch가 새 Promise를 반환하고 반환값이 다음 상태를 결정함을 말한다.
- 오류를 복구·재전파·삼키는 선택을 구분한다.

## 감점 포인트

- 중간 throw 뒤의 모든 then 성공 콜백이 실행된다고 말한다.
- catch에서 값을 반환해도 다음 then이 건너뛴다고 말한다.
- 비동기 rejection을 바깥 동기 try/catch가 항상 잡는다고 말한다.

## 더 파고들 거리

- Promise 생성자 실행부의 동기 throw와 then 콜백의 throw는 관찰 시점이 어떻게 다른가요?
- 여러 catch를 두었을 때 가장 가까운 rejection 처리 경로는 어떻게 정해지나요?
- unhandled rejection을 운영 환경에서 어떻게 기록하고 종료 정책을 정하나요?

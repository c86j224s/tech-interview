---
id: js-async-await-parallel
title: "화면을 그리려면 서로 독립적인 API 두 개의 결과가 필요합니다. 순차 await와 Promise.all 중 무엇을 선택하고, 하나가 실패하면 나머지 요청은 어떻게 처리하나요?"
answerMinutes: 5
followups: [{"id":"js-promise-error-chain","prompt":"Promise.all의 한 rejection을 호출자에게 전파하면서 이미 성공한 하위 결과는 어떻게 폐기하거나 보상할까요?"},{"id":"structured-concurrency-fanout","prompt":"AbortSignal을 지원하지 않는 하위 API가 남으면 부모 응답 종료와 실제 작업 종료를 어떻게 표시할까요?"},{"id":"request-timeout-idempotency","prompt":"병렬 요청 중 일부가 서버에 반영된 뒤 브라우저가 타임아웃되면 재시도 전에 무엇을 조회할까요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["JavaScript","async/await","Promise.all","병렬 실행","취소"]
related: ["js-promise-error-chain","js-event-loop-microtasks"]
---

# 화면을 그리려면 서로 독립적인 API 두 개의 결과가 필요합니다. 순차 await와 Promise.all 중 무엇을 선택하고, 하나가 실패하면 나머지 요청은 어떻게 처리하나요?

## 구두 답변

`await jobA()` 다음에 `await jobB()`처럼 작업을 호출하고 바로 기다리면 B의 호출은 A 완료 뒤로 미뤄집니다. 이미 두 작업을 시작해 둔 뒤 각각 await하는 경우에는 대기를 순서대로 해도 실행은 겹칠 수 있습니다. 독립적인 작업이라면 먼저 Promise를 만들어 두고 `Promise.all`로 함께 기다려 시작 지연을 줄일 수 있습니다.

### 작업을 시작하는 시점

```js
function job(name, ms, fail = false) {
  return new Promise((resolve, reject) => {
    console.log('start', name);
    setTimeout(() => fail ? reject(new Error(name)) : resolve(name), ms);
  });
}
async function run() {
  const a = job('A', 30);       // 여기서 A 시작
  const b = job('B', 10, true); // 여기서 B 시작
  try { console.log(await Promise.all([a, b])); }
  catch (e) { console.log('failed', e.message); }
}
run();
// start A
// start B
// failed B
```

`const a = await job('A', 30)` 다음에 `const b = await job('B', 10)`를 쓰면 B 호출 자체가 A 완료 뒤로 미뤄집니다. 반면 위 코드는 `job` 호출 시 Promise의 작업이 시작되고, `Promise.all`은 두 결과를 모아 하나라도 거부되면 결과 Promise를 거부합니다. 이때 A가 이미 끝났거나 진행 중인 사실을 되돌리지 않으며, 다른 Promise를 자동으로 취소하지도 않습니다. 그래서 실패 로그가 먼저 나와도 A의 네트워크·타이머·파일 작업이 계속 끝날 수 있습니다.

### 실패·취소·부분 결과

취소가 필요하면 호스트의 fetch 같은 API가 제공하는 `AbortSignal`이나 별도 취소 계약을 받아 실제 작업을 중단하도록 협력해야 합니다. 독립 작업은 `Promise.all`로 묶되 실패 시 남은 작업을 중단할 수 있는지와 부분 부작용을 보상할 수 있는지를 확인하겠습니다. 순서가 의존되거나 앞 결과가 다음 입력이면 순차 `await`를 선택하고, 성공과 실패를 모두 모아 작업별 후속 처리를 해야 한다면 `allSettled`를 쓰겠습니다. 이 도구도 실패를 해결해 주지는 않으므로 각 결과의 상태를 확인해야 합니다.

### 선택 기준과 검증

병렬 시작은 응답 시간을 줄일 수 있지만 하위 API의 rate limit과 연결·메모리 예산을 한꺼번에 소비합니다. 필수 요청 수에 상한을 두고, 선택 요청은 deadline 안의 결과만 응답에 포함하겠습니다. `Promise.all`이나 `allSettled`는 이미 서버에 발생한 부작용을 취소하지 않으므로 변경 요청에는 멱등 키와 결과 조회를 붙이겠습니다.

Promise.all의 결과 배열은 완료된 순서가 아니라 입력 Promise의 순서를 유지합니다. A가 느리고 B가 빨라도 성공 결과는 [A의 결과, B의 결과]로 모입니다. 반면 하나가 실패하면 나머지 성공 결과를 부분 응답으로 돌려주는 도구는 아니므로 각 결과를 모두 판별해야 하면 allSettled를 선택해야 합니다. any는 첫 성공, race는 첫 이행 또는 거부를 기준으로 해 목적이 다릅니다.

수천 항목을 map으로 호출해 Promise.all에 넣으면 대기 문법은 짧아도 모든 작업을 한꺼번에 시작할 수 있습니다. 제한된 워커 수로 아직 시작하지 않은 함수를 꺼내 호출하는 풀을 두어 동시성을 통제하겠습니다. 이미 시작한 Promise를 나중에 작은 배열로 나누어 기다리는 것은 시작된 작업 수를 줄이지 못합니다. 취소 신호도 라이브러리가 관찰해야 효과가 있으므로 timeout을 race로 구현했다는 사실과 실제 작업 중단을 구분하겠습니다.

## 득점 포인트

- 작업 시작 시점과 결과 대기 시점을 구분한다.
- Promise.all의 실패 전파와 취소 부재를 설명한다.
- 부분 부작용·AbortSignal·멱등 재시도를 함께 판단한다.

## 감점 포인트

- Promise.all이 호출만으로 병렬 스레드를 만들거나 다른 작업을 취소한다고 말한다.
- 순차 await와 미리 생성한 Promise의 시작 시점을 구분하지 않는다.
- 실패한 부작용이 Promise combinator에 의해 롤백된다고 설명한다.

## 더 파고들 거리

- `all`, `allSettled`, `any`, `race`의 성공 조건을 한 작업 표로 비교해 보세요.
- 여러 fetch에 하나의 AbortSignal을 공유할 때 이미 완료된 응답은 어떻게 처리할까요?
- 일부 변경이 성공한 뒤 재시도 전에 서버 상태를 어떻게 확인할까요?

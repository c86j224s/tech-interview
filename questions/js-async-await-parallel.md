---
id: js-async-await-parallel
title: "화면을 그리려면 서로 독립적인 API 두 개의 결과가 필요합니다. 순차 await와 Promise.all 중 무엇을 선택하고, 하나가 실패하면 나머지 요청은 어떻게 처리하나요?"
difficulty: 중하
category: 언어·런타임
tags: ["JavaScript","async/await","Promise.all","병렬 실행","취소"]
related: ["js-promise-error-chain","js-event-loop-microtasks"]
---

# 화면을 그리려면 서로 독립적인 API 두 개의 결과가 필요합니다. 순차 await와 Promise.all 중 무엇을 선택하고, 하나가 실패하면 나머지 요청은 어떻게 처리하나요?

## 구두 답변

`await jobA()` 다음에 `await jobB()`처럼 작업을 호출하고 바로 기다리면 B의 호출은 A 완료 뒤로 미뤄집니다. 이미 두 작업을 시작해 둔 뒤 각각 await하는 경우에는 대기를 순서대로 해도 실행은 겹칠 수 있습니다. 독립적인 작업이라면 먼저 Promise를 만들어 두고 `Promise.all`로 함께 기다려 시작 지연을 줄일 수 있습니다.

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

취소가 필요하면 API가 `AbortSignal`이나 별도 취소 계약을 받아 실제 작업을 중단하도록 협력해야 합니다. 독립 작업은 `Promise.all`로 묶되 실패 시 남은 작업을 중단할 수 있는지와 부분 부작용을 보상할 수 있는지를 확인하겠습니다. 순서가 의존되거나 앞 결과가 다음 입력이면 순차 `await`를 선택하고, 성공과 실패를 모두 모아 작업별 후속 처리를 해야 한다면 `allSettled`를 쓰겠습니다. 이 도구도 실패를 해결해 주지는 않으므로 각 결과의 상태를 확인해야 합니다.

## 득점 포인트

- 이 예제에서는 job 호출 때 타이머 작업이 시작되고, await는 그 결과를 기다린다는 점을 구분한다.
- 순차 await와 Promise.all의 실행 시간·실패 전파 차이를 설명한다.
- Promise.all이 취소를 제공하지 않으며 협력적 취소가 필요함을 말한다.

## 감점 포인트

- 호출 즉시 기다리는 순차 실행과, 미리 시작한 여러 작업을 순서대로 기다리는 경우를 같다고 말한다.
- Promise.all이 하나 실패하면 다른 작업도 자동으로 중단된다고 말한다.
- Promise.all이 입력 Promise의 부작용을 되돌린다고 말한다.

## 더 파고들 거리

- Promise.all과 allSettled, any, race는 어떤 성공·실패 조건을 표현하나요?
- AbortController를 여러 작업에 연결할 때 이미 완료된 작업은 어떻게 처리하나요?
- 여러 요청 중 일부만 데이터를 변경한 채 실패했다면, 재시도 전에 어떤 결과를 확인하고 무엇을 보상해야 하나요?

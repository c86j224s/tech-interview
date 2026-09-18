---
id: js-promise-state
title: Promise 체인의 상태 전파와 결과 집계
topic: 언어·런타임
summary: executor·then의 실행 시점, catch 복구·finally 대체·누락된 return과 all·any·race의 성공 조건·동시 실행 상한을 설명합니다.
questionIds: [js-promise-error-chain, promise-executor-then-throw, promise-rejection-nearest-handler, js-async-await-parallel, promise-combinator-success-contract]
---

# Promise 체인의 상태 전파와 결과 집계

Promise는 작업을 실행하는 스레드가 아니라, 비동기 결과의 상태와 후속 반응을 연결하는 값입니다. 생성자의 executor는 생성 시점에 실행되고, `then`·`catch` 반응은 나중 job으로 실행되며, callback의 반환·throw가 다음 Promise의 상태를 만듭니다. 이 모델을 먼저 잡아야 오류 복구, 병렬 시작, 취소, 조합자의 성공 조건을 혼동하지 않습니다.

## Catch 반환값과 후속 성공 경로

```js
const events = [];
await Promise.resolve('start')
  .then(() => { throw new Error('boom'); })
  .then(() => events.push('skip'))
  .catch(error => { events.push(error.message); return 'recovered'; })
  .then(value => events.push(value));
// events: ['boom', 'recovered']
```

각 then·catch는 원래 Promise를 바꾸는 대신 새로운 Promise를 반환합니다. callback이 값을 반환하면 다음 Promise가 그 값으로 이행될 수 있고, throw하면 거절됩니다. 반환한 Promise나 thenable의 상태를 채택하는 경우 즉시 이행되는 것과는 다릅니다.

오류를 로그에만 남기고 return 없이 끝낸 catch도 정상적으로 undefined를 반환한 것이므로 이후에는 성공 경로가 됩니다. 복구하지 못했다면 다시 throw하거나 거절된 Promise를 반환해야 호출자가 실패를 관찰합니다.

## Executor와 반응 callback의 실행 시점

실행 순서를 작은 trace로 확인할 수 있습니다. `new Promise(resolve => { log(1); resolve(); log(2); })`는 생성 중 `1,2`를 기록하고, 그 뒤에 붙인 `then`은 현재 동기 호출이 끝난 후 실행됩니다. executor 안의 계산이 다른 스레드로 이동한 것은 아니며, `then` callback에서 throw한 오류는 그 callback이 만든 새 Promise의 rejection입니다.

Promise 생성자의 executor는 생성 호출 중 동기 실행됩니다. 그 안에서 throw한 예외는 일반적으로 생성된 Promise의 rejection으로 연결되므로 생성자 바깥 동기 try/catch만으로 그 거절을 관찰하지 못합니다. 단, 이미 resolve된 뒤 throw한 경우처럼 Promise가 이미 결정된 조건은 구분합니다.

then callback은 Promise 반응 job으로 나중 실행되고 그 throw는 then이 반환한 새 Promise를 거절시킵니다. Promise로 긴 계산을 감쌌다고 executor가 다른 스레드로 이동하지 않습니다. async executor를 Promise 생성자에 넣는 패턴도 반환된 내부 Promise를 생성자가 자동 연결하지 않으므로 피하는 것이 좋습니다.

| callback 동작 | 다음 Promise |
| --- | --- |
| 일반 값 반환 | 그 값으로 이행 |
| 아무것도 반환하지 않음 | undefined로 이행 |
| throw | 거절 |
| Promise 반환 | 반환한 Promise의 최종 상태 채택 |
| 내부 Promise 시작만 하고 return 누락 | 내부 작업과 바깥 완료가 분리 |

## 오류 handler와 반환 체인의 탐색 범위

`then(success, failure)`의 failure는 같은 then의 success가 던진 오류를 받지 않습니다. 그 오류는 **그 then이 반환한 Promise**의 거절이므로 다음 catch가 받습니다. 서로 갈라진 체인 중 하나에 붙인 catch가 다른 가지의 오류까지 자동 처리하지도 않습니다.

```diagram
{"title":"각 단계는 다음 Promise의 상태를 만듭니다","caption":"화살표는 체인의 상태 전파입니다. 오류를 잡은 callback이 정상 값을 반환하면 뒤의 성공 handler가 실행됩니다.","rows":[[{"id":"start","label":"P1 이행"}],[{"id":"throw","label":"then이 throw · P2 거절"}],[{"id":"catch","label":"catch가 대체값 반환"}],[{"id":"success","label":"P3 이행 · 다음 then 실행"}]],"edges":[{"from":"start","to":"throw","label":"성공 handler"},{"from":"throw","to":"catch","label":"거절 handler"},{"from":"catch","to":"success","label":"복구 값"}]}
```

finally는 보통 값·오류를 그대로 통과시키면서 정리합니다. 그러나 finally가 throw하거나 거절된 Promise를 반환하면 원래 결과를 새 실패로 대체할 수 있습니다. 정리 실패가 원래 오류를 지우지 않게 원인과 보조 오류를 보존합니다. 동기 try/catch가 나중 job의 오류를 모두 잡는 것은 아니며, async 함수에서는 try 안에서 await해야 해당 rejection을 catch할 수 있습니다.

## 비동기 작업 시작 시점과 대기 순서

`await jobA(); await jobB();`는 A 완료 뒤 B를 호출합니다. `const a=jobA(); const b=jobB(); await Promise.all([a,b]);`는 두 job 호출을 먼저 수행해 외부 I/O가 겹칠 수 있습니다. Promise.all이 새로운 병렬 스레드를 만드는 것은 아닙니다.

| 조합 | 성공·실패 결정 | 빈 iterable |
| --- | --- | --- |
| all | 모두 이행하면 입력 순서 결과, 하나 거절하면 거절 | 이행된 빈 배열 |
| allSettled | 모두 정착하면 입력 순서 상태 배열 | 이행된 빈 배열 |
| any | 첫 이행, 모두 거절이면 AggregateError | AggregateError로 거절 |
| race | 첫 이행 또는 거절 | 계속 pending |

결과 상태가 즉시 결정되어도 then 반응은 동기 호출처럼 앞질러 실행되지 않습니다. all의 결과 배열은 완료 순서가 아니라 입력 순서입니다. allSettled는 실패를 해결하지 않고 보여 줄 뿐이며 결과별 후속 정책이 필요합니다.

## Promise 실패 집계와 취소·롤백의 구분

선택 기준은 “호출자에게 언제 실패를 알릴지”와 “이미 시작한 작업을 실제로 멈출 수 있는지”입니다. `Promise.race` timeout은 전자만 바꾸고, `AbortSignal`은 API가 협조할 때만 후자를 바꿉니다. 서버에 이미 커밋된 효과는 Promise combinator의 rejection으로 취소되지 않으므로, 업무 변경에는 멱등 키·보상·상태 조회가 별도로 필요합니다.

B가 먼저 실패해 `Promise.all`이 거절되어도, 이미 시작한 A의 fetch나 계산은 계속 실행될 수 있습니다. `Promise.race`로 timeout을 만들면 race는 호출자에게 먼저 도착한 결과를 넘길 뿐이어서 사용자 대기가 끝난 뒤에도 실제 작업이 남을 수 있습니다. 취소를 지원하는 API라면 `AbortSignal` 같은 해당 API의 신호를 A·B에 전달하고, 작업이 실제로 종료됐는지 별도로 관찰합니다. 이미 서버에서 커밋한 변경은 combinator의 거절이나 abort로 되돌아가지 않습니다.

수천 개 함수를 map으로 호출해 이미 Promise를 만든 뒤 작은 그룹으로 기다려도 시작 수는 줄지 않습니다. 아직 시작하지 않은 함수들을 제한된 worker가 꺼내 호출하는 구조로 상한을 둡니다. 활성 수·대기 수·바이트·전체 deadline과 실패 뒤 미시작 작업의 정책을 정합니다.

## deferred 기반 Promise 상태 전이 검증

테스트에서는 시간 지연에 기대기보다 외부에서 resolve·reject할 수 있는 deferred 작업을 사용해 B 실패 뒤 A가 계속 남는지, all 결과 순서가 유지되는지 확인합니다. 빈 입력·catch 재throw·finally 실패·중첩 return 누락도 각각 검사합니다.

최종 호출자는 성공·실패를 반드시 관찰하고 unhandled rejection의 로그·종료 정책은 실제 Node 버전과 실행 설정에 맞춥니다. 이 노트의 출력은 기대 계약이며 실제 외부 API의 취소·롤백을 검증한 결과는 아닙니다.

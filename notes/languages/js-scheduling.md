---
id: js-scheduling
title: JavaScript 작업 큐와 렌더링 양보·Worker
topic: 언어·런타임
summary: 동기 실행·microtask·timer와 Node 문맥 차이를 나누고 시간 예산·Worker clone·transfer·공유 메모리·종료 수명을 설명합니다.
questionIds: [js-event-loop-microtasks, browser-microtask-starvation, node-nexttick-microtask-context, js-web-worker-transfer]
---

# JavaScript 작업 큐와 렌더링 양보·Worker

## 0ms 타이머도 현재 호출 스택을 끊지 않습니다

```js
console.log('A');
setTimeout(() => console.log('timer'), 0);
Promise.resolve().then(() => console.log('microtask'));
console.log('B');
// 이 예제의 기대 순서: A, B, microtask, timer
```

현재 동기 실행이 끝난 뒤 Promise 반응이 처리되고 이후 타이머 작업이 실행될 수 있습니다. 0ms는 즉시 실행 명령이 아니라 최소 대기 요청이며 백그라운드 탭 제한·다른 작업·호스트 스케줄링 때문에 더 늦어질 수 있습니다.

ECMAScript의 Promise job과 브라우저의 이벤트 루프·렌더링, Node의 timer·I/O phase는 서로 다른 계층입니다. 브라우저의 모든 작업을 단일 전역 FIFO 하나로 설명하지 않습니다.

## Microtask를 비우지 못하면 다음 기회가 늦어집니다

microtask 처리 중 새 microtask를 계속 추가하면 checkpoint가 끝나지 않아 타이머·입력·렌더링 기회가 밀릴 수 있습니다. `await Promise.resolve()`를 반복하면 현재 함수가 잠시 중단되어도 이어지는 작업은 다시 microtask이므로 렌더링을 위한 충분한 양보가 아닐 수 있습니다.

```diagram
{"title":"짧은 후속 처리와 긴 계산의 경로를 나눕니다","caption":"화살표는 스케줄링 선택입니다. microtask 안 긴 계산도 같은 실행 흐름을 막으며 task 양보나 Worker는 별도의 비용·수명 계약을 가집니다.","rows":[[{"id":"work","label":"현재 JavaScript 작업"}],[{"id":"micro","label":"짧은 microtask 후속 처리"},{"id":"cpu","label":"긴 CPU 작업"}],[{"id":"yield","label":"시간 예산으로 task 양보"},{"id":"worker","label":"Worker에서 계산"}]],"edges":[{"from":"work","to":"micro","label":"짧은 상태 반영"},{"from":"work","to":"cpu","label":"분할 필요"},{"from":"cpu","to":"yield","label":"메인 흐름 유지"},{"from":"cpu","to":"worker","label":"별도 문맥"}]}
```

메인 스레드에 남길 계산은 performance.now 기준의 작은 시간 예산으로 나눠 적절한 task 또는 지원되는 scheduler 양보를 사용합니다. timer로 양보한다고 매번 페인트가 보장되지는 않지만 microtask 연쇄와 다른 기회를 만듭니다. requestAnimationFrame은 렌더링 시점과 연결된 callback이지 긴 계산을 공짜로 만드는 worker가 아닙니다. 그 안에서 오래 실행하면 역시 프레임을 막습니다.

## Node의 nextTick 순서는 실행 문맥까지 봅니다

CommonJS 최상위 실행에서 nextTick과 Promise를 등록한 경우의 관찰과, ESM 최상위 평가 또는 이미 Promise job 안에서 등록한 경우의 관찰은 다를 수 있습니다. nextTick을 언제나 모든 Promise callback보다 먼저 실행하는 보편 규칙으로 외우지 않습니다. 현재 어떤 큐를 drain 중인지와 다음 호스트 경계가 중요합니다.

| 비교 문맥 | 고정할 정보 | 관찰 항목 |
| --- | --- | --- |
| `.cjs` 최상위 | Node 버전·시작 파일 | sync·nextTick·Promise 순서 |
| `.mjs` 최상위 | top-level await 유무 | module 평가 job의 영향 |
| I/O callback 내부 | 실제 API·callback 경계 | callback 후 큐 처리 |
| Promise callback 내부 | 이미 microtask 실행 중 | 새 Promise와 nextTick 재등록 |

nextTick을 무한히 이어도 I/O가 굶을 수 있습니다. 긴 작업은 분할하거나 적절한 worker로 옮깁니다. setImmediate와 timer의 상대 순서도 문맥·버전에 따라 달라질 수 있으므로 작은 코드의 특정 결과를 모든 Node 실행에 확대하지 않습니다.

## Worker 메시지는 일반 객체 참조를 그대로 공유하지 않습니다

Web Worker는 별도 실행 문맥에서 계산해 메인 스레드 부하를 줄입니다. DOM을 직접 조작하는 역할은 메인 문맥과 다르며 메시지 전달·시작·결과 병합 비용이 생깁니다. 작은 작업에서는 그 비용이 계산 자체보다 클 수 있습니다.

| 전달 방식 | 송신 쪽 상태 | 필요한 관리 |
| --- | --- | --- |
| structured clone | 원본 유지, 지원 데이터 그래프 복사 | 복사량·지원 타입·피크 메모리 |
| ArrayBuffer transfer | 버퍼 detach, 이전 사용 불가 | 소유권 이전·반환 |
| SharedArrayBuffer | 양쪽이 같은 메모리 접근 | Atomics·동기화·브라우저 보안 조건 |

`worker.postMessage({id, buffer}, [buffer])`로 transfer한 뒤 buffer를 다시 렌더 입력으로 읽는 코드는 소유 계약 위반입니다. 다른 view도 같은 backing buffer를 참조했다면 영향을 받습니다. Worker가 결과를 돌려줄 때 다시 transfer할 수 있지만 송신·수신 어느 쪽이 지금 소유하는지 명확해야 합니다.

공유 메모리는 보통의 메시지 복사와 다릅니다. JS Atomics와 SharedArrayBuffer의 호스트 지원·cross-origin isolation 조건을 확인하고, C++의 메모리 순서 문법을 그대로 JS API에 옮기지 않습니다. 일반 객체 필드까지 자동 공유되는 것도 아닙니다.

## 작업 ID와 종료 책임이 필요합니다

Worker에 계산 A를 맡겼다가 새 검색 B를 시작하면 A 결과가 늦게 와 화면을 덮을 수 있습니다. 작업 ID·세대를 검사하고 완료·취소·실패를 한 상태로 관리합니다. 메시지로 취소를 보내도 Worker가 긴 동기 루프 중이면 메시지를 아직 처리하지 못할 수 있습니다. 작업 분할·공유 취소 플래그·종료 중 어떤 계약을 사용할지 정합니다.

terminate는 실행을 끊지만 정상 cleanup·부분 결과 반환을 보장하는 일반적인 완료와 다릅니다. transfer한 버퍼를 결과로 되돌려받지 못할 때도 소유자가 복구할 수 있어야 합니다. worker 수·메시지 대기 수·바이트·최대 나이를 제한합니다.

## 전체 완료 시간과 UI 지연을 함께 측정합니다

동일 계산을 메인 스레드 한 번, 시간 예산 분할, Worker clone, Worker transfer로 비교합니다. 결과 동일성을 먼저 확인한 뒤 main-thread long task·입력 지연·프레임 간격·전체 완료 시간·메모리 피크를 기록합니다. Worker가 총시간을 늘려도 UI 응답성을 개선할 수 있으므로 지표 하나로 판단하지 않습니다.

Node 순서 실험은 `.cjs`·`.mjs`·I/O callback을 별도 파일에서 실행하고 버전을 기록합니다. 저장소의 `tests/language-study-examples.test.mjs`로 Node v26.8.2에서 최상위 코드를 실행했을 때 CJS는 `sync → tick → promise`, ESM은 `sync → promise → tick`을 관찰했습니다. 테스트는 이 차이를 출력하되 모든 미래 버전의 고정 순서로 단정하지 않습니다. I/O callback의 세부 순서와 Worker 성능·브라우저 프레임 지연은 이 실행에서 측정하지 않았습니다.

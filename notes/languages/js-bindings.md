---
id: js-bindings
title: JavaScript 바인딩의 초기화와 클로저
topic: 언어·런타임
summary: var·let·const·함수의 초기화 시점, shadowing·TDZ·반복별 바인딩·ESM 순환과 private 상태의 외부 계약을 설명합니다.
questionIds: [js-hoisting-tdz, js-function-declaration-expression-init, js-block-shadowing-tdz, js-closure-loop, foreach-parameter-loop-binding, closure-private-class-field-testing, js-module-cycle-initialization]
---

# JavaScript 바인딩의 초기화와 클로저

## 선언을 위로 옮긴다는 비유보다 준비와 실행을 나눕니다

함수 안에서 `var x = 1`보다 먼저 x를 읽으면 undefined가 보일 수 있습니다. 실행 환경을 준비할 때 바인딩이 생성되고 undefined로 초기화되지만, 1을 대입하는 동작은 해당 문장에 도달했을 때 일어납니다. 호이스팅은 코드 전체가 실제로 재배열된다는 뜻이 아닙니다.

let·const도 렉시컬 바인딩이 준비되지만 선언의 초기화 전에는 읽거나 쓸 수 없는 TDZ에 있습니다. undefined를 읽는 것과 접근 자체가 ReferenceError인 것은 다릅니다.

| 선언 | 준비된 바인딩의 초기 상태 | 선언 실행 전 사용 |
| --- | --- | --- |
| 함수 내부 var | undefined로 초기화 | 읽기는 undefined, 함수처럼 호출하면 TypeError |
| let·const | 초기화되지 않음 | 읽기·typeof도 ReferenceError |
| 일반 함수 선언 | 해당 문맥의 초기화에서 함수 준비 | 보통 같은 함수 스코프에서 호출 가능 |
| var에 함수 표현식 대입 | 대입 전 undefined | 함수 객체 준비 전 호출 불가 |
| let에 함수 표현식 대입 | TDZ | 초기화 전 호출 불가 |

block 함수 선언은 strict·module과 비엄격 스크립트의 레거시 규칙이 다를 수 있으므로 위 표를 모든 문맥에 그대로 적용하지 않습니다. 기본 예제는 strict 함수 또는 ES module 문맥으로 고정합니다.

## Shadowing은 안쪽 초기화 전에도 적용됩니다

```js
const x = 'outer';
{
  try { console.log(x); }
  catch (error) { console.log(error.name); } // ReferenceError
  let x = 'inner';
  console.log(x); // inner
}
```

안쪽 x가 블록 전체에서 바깥 x를 가립니다. 초기화되지 않았다고 바깥 값으로 돌아가지는 않습니다. `typeof x`도 TDZ에는 안전한 부재 검사가 아닙니다. 아예 선언되지 않은 이름에 typeof를 적용하는 경우와 구분합니다.

TDZ는 단순한 소스 줄 위치보다 실행 시점의 문제입니다. `const read = () => value; let value = 3; read();`는 함수 본문을 초기화 뒤 실행하므로 정상입니다. value 초기화 전에 read를 호출하면 실패합니다. 함수 생성과 본문 실행은 다릅니다.

## 클로저는 값의 사진이 아니라 바인딩을 읽습니다

```js
const a = [];
for (var i = 0; i < 3; i++) a.push(() => i);
const b = [];
for (let j = 0; j < 3; j++) b.push(() => j);
console.log(a.map(f => f())); // [3, 3, 3]
console.log(b.map(f => f())); // [0, 1, 2]
```

var i의 바인딩은 반복 전체가 공유합니다. 함수 안이면 함수 환경, 일반 스크립트 최상위면 전역 환경, ES module이면 모듈 환경이므로 var가 어디서나 전역이라는 설명은 틀립니다. for의 let j는 반복별 바인딩을 만들어 각각의 클로저가 다른 j를 봅니다.

```diagram
{"title":"콜백이 어떤 바인딩을 공유하는지 추적합니다","caption":"화살표는 클로저의 참조입니다. var 예제의 두 콜백은 반복이 끝난 같은 i를 읽고, let 반복에서는 서로 다른 바인딩이 생깁니다.","rows":[[{"id":"f1","label":"var 콜백 A"},{"id":"f2","label":"var 콜백 B"}],[{"id":"binding","label":"공유 바인딩 i = 3"}],[{"id":"result","label":"둘 다 3을 읽음"}]],"edges":[{"from":"f1","to":"binding","label":"참조"},{"from":"f2","to":"binding","label":"같은 참조"},{"from":"binding","to":"result","label":"나중 실행"}]}
```

forEach의 각 호출 매개변수도 호출별 바인딩입니다. 그러나 매개변수마다 같은 객체 참조를 받으면 객체 내부 변경은 공유됩니다. let·const도 객체를 깊게 복제하지 않습니다. 숫자 snapshot이 필요하면 별도 값 매개변수로 전달하고, 가변 객체 snapshot이 필요하면 복사·불변 소유 계약을 추가합니다. forEach는 async callback의 Promise를 모아 기다리지 않으므로 `await array.forEach(async ...)`로 전체 완료를 기다릴 수 없습니다.

## 모듈 연결은 값의 초기화 완료와 다릅니다

ES module import는 export의 live binding에 연결됩니다. 순환이 있어도 모든 값이 즉시 준비되는 것은 아닙니다. A의 최상위 초기화가 B를 읽고 B의 최상위 초기화가 아직 초기화되지 않은 A의 const를 읽으면 TDZ 오류가 날 수 있습니다.

```js
// a.mjs
import { b } from './b.mjs';
export const a = b + 1;
// b.mjs
import { a } from './a.mjs';
export const b = a + 1;
```

반대로 함수 정의만 서로 참조하고 모든 모듈 초기화 뒤 호출하는 순환은 다른 상황입니다. import 순서를 우연히 바꿔 숨기기보다 공통 순수 책임을 분리하거나 조립 시작점에서 값을 주입합니다. CommonJS의 부분 exports와 캐시 동작은 ESM live binding·TDZ와 같지 않습니다. 새 프로세스 cold import와 실제 번들 출력을 모두 확인해야 캐시가 오류를 숨기지 않습니다.

## Private 상태는 공개 행동으로 검증합니다

클로저 안 count와 class의 `#count`는 외부 접근을 제한하는 서로 다른 표현입니다. 테스트는 내부 이름을 강제로 노출하기보다 increment·reset·읽기·실패 후 상태라는 공개 계약을 확인합니다. 인스턴스 두 개의 상태가 독립인지, 콜백이 언제 최신 값을 읽는지도 검사합니다.

시간·저장소·네트워크를 의미 있는 경계로 주입하면 내부 배치를 고정하지 않고 실패를 시험할 수 있습니다. private이라는 문법은 await 사이 경쟁·외부 거래 원자성을 보장하지 않습니다. 오래된 listener가 클로저를 붙잡는 수명도 별도입니다.

## 실행 문맥까지 고정해서 결과를 비교합니다

strict 함수·브라우저 module·Node ESM을 명시하고 선언 전 읽기·typeof·함수 호출·반복 콜백 결과를 확인합니다. 모듈 순환은 캐시 없는 새 프로세스에서 시험하고 지연 호출 구조로 바꾼 뒤 정상 초기화도 검사합니다. 아래 예제들의 값은 언어 규칙에 따른 기대 결과이며 별도의 런타임 검증 결과는 검증 기록에서 구분합니다.

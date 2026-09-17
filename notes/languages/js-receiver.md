---
id: js-receiver
title: JavaScript This와 콜백 함수의 정체성
topic: 언어·런타임
summary: 일반 호출·메서드·화살표의 this 결정과 bind 부분 적용·rest·prototype 공유·등록 해제 수명을 예제로 설명합니다.
questionIds: [js-this-binding, js-arrow-this, js-callback-bind-arrow-wrapper, js-bind-partial-arguments, js-arrow-field-prototype-memory, js-arrow-arguments-rest]
---

# JavaScript This와 콜백 함수의 정체성

## 메서드 분리와 호출 receiver 상실

```js
'use strict';
const counter = { value: 7, read() { return this.value; } };
const detached = counter.read;
console.log(counter.read()); // 7
try { detached(); } catch (e) { console.log(e.name); } // TypeError
```

일반 함수의 this는 정의한 객체에 영구 결합되지 않습니다. `counter.read()`에서는 counter가 receiver이고, strict 함수의 분리 호출 `detached()`에서는 this가 undefined입니다. 비엄격 함수의 전역 객체 보정에 의존하면 브라우저·Node·모듈 문맥에 따라 예상하지 못한 값을 읽을 수 있습니다.

call·apply는 한 번의 호출에 사용할 `this`를 지정하고, 호출이 끝나면 그 설정이 남지 않습니다. `bind`는 원본을 바꾸지 않고 지정한 `this`와 앞 인자를 기억하는 새 함수를 만들므로, 이후 일반 호출에서는 그 bound 함수의 설정이 사용됩니다. 다만 원본이 생성자로 호출될 수 있는 함수에서 `new`를 쓰는 규칙은 일반 호출과 다르므로, bind가 모든 호출에서 `this`를 영구히 고정한다고 일반화하지 않습니다.

## 화살표와 생성 문맥의 this

```js
const box = {
  value: 10,
  makePair() {
    return {
      normal() { return this.value; },
      arrow: () => this.value,
    };
  },
};
const pair = box.makePair();
pair.value = 20;
console.log(pair.normal(), pair.arrow()); // 20, 10
box.value = 30;
console.log(pair.arrow()); // 30
```

normal은 pair의 메서드로 호출되고 arrow는 makePair가 실행될 때의 box를 봅니다. 화살표가 value=10을 복사한 것이 아니므로 box.value를 바꾸면 30을 읽습니다. makePair 자체를 분리 호출했다면 화살표가 원래 box를 자동으로 찾아 주지도 않습니다.

```diagram
{"title":"같은 객체에 담겨 있어도 this의 근거는 다릅니다","caption":"화살표는 this 결합 근거입니다. 일반 함수는 pair의 호출 관계를, 화살표는 생성된 makePair 실행의 바깥 this를 사용합니다.","rows":[[{"id":"normal","label":"pair.normal()"},{"id":"arrow","label":"pair.arrow()"}],[{"id":"pair","label":"호출 receiver = pair"},{"id":"box","label":"바깥 this = box"}]],"edges":[{"from":"normal","to":"pair","label":"호출 형태"},{"from":"arrow","to":"box","label":"lexical 결합"}]}
```

화살표의 this는 call·apply·bind로 교체되지 않습니다. 하지만 bind가 앞 인자를 고정하는 효과는 남을 수 있습니다. 화살표는 자체 arguments도 만들지 않고 바깥 문맥을 참조하며 new로 호출할 생성자가 아닙니다.

## 부분 적용과 호출 인자 결합 순서

```js
function collect(prefix, event, index) {
  return [this.id, prefix, event, index];
}
const fixed = collect.bind({ id: 'panel' }, 'click');
console.log(fixed('event-object', 2));
// ['panel', 'click', 'event-object', 2]
```

bind의 앞 인자 다음에 실제 호출 인자가 붙습니다. 배열 callback이나 이벤트 API가 추가로 보내는 index·event가 어느 자리에 오는지 확인합니다. `(...args) => target.method(...args)` 같은 래퍼는 반환값이나 Promise를 그대로 반환해야 바깥 호출자가 완료·오류를 관찰할 수 있습니다.

화살표에서 자기 호출 인자가 필요하면 `(...args)` rest parameter를 사용합니다. rest는 실제 배열이며 일반 함수의 arguments와 다릅니다. 바깥 arguments가 있으면 화살표가 그것을 볼 수 있고, 없는 문맥이면 원하는 인자가 저절로 생기지 않습니다. strict·비엄격 arguments의 매개변수 연결 차이까지 필요하다면 실행 문맥을 고정합니다.

## 함수 공유와 인스턴스별 결합 비용

| 방식 | this·호출 특징 | 함수 정체성과 비용 |
| --- | --- | --- |
| prototype 메서드 | 호출 receiver에 따라 결정 | 인스턴스가 함수 공유 가능 |
| 생성 시 한 번 bind | 일반 호출 receiver 고정 | 인스턴스별 bound 함수 |
| 화살표 필드 | 인스턴스 생성 문맥 this | 보통 인스턴스별 함수 |
| 래퍼 | 명시한 target 호출 | 새 함수·캡처·반환 계약 |

class의 화살표 필드는 prototype 메서드와 상속·테스트 대역 방식도 다릅니다. 인스턴스가 많으면 함수 수·메모리와 실제 callback 편의를 비교합니다. prototype 공유가 모든 상태 공유를 뜻하지도, 화살표가 모든 수명 문제를 해결하지도 않습니다.

## 등록·제거와 함수 정체성

`addEventListener('click', handler.bind(this))` 뒤에 새 `handler.bind(this)`를 만들어 remove해도 다른 함수 객체라 등록이 제거되지 않습니다. bound 함수나 래퍼를 필드에 보관하거나 지원되는 AbortSignal로 등록 수명을 묶습니다. 제거는 이벤트 종류·동일 함수·capture 조건을 맞춥니다.

오래된 전역 listener가 bound 함수나 화살표를 잡으면 receiver도 유지될 수 있습니다. 한번 실행이 필요한 이벤트에 once를 쓰더라도 이벤트가 영원히 오지 않을 때의 수명은 남습니다. 화면 종료에서 listener·timer·구독을 정리하고 늦은 결과의 세대도 확인합니다.

## 반환·인자·수명과 외부 계약 검사

메서드 호출·분리 호출·call·bind·화살표를 같은 객체로 비교하고 this 변경과 속성 변경을 나누어 확인합니다. 인스턴스 두 개의 prototype 메서드 동일성과 화살표 필드의 별도 함수도 검사합니다. 등록·제거를 반복해 이벤트 한 번에 callback 하나만 실행되는지 봅니다. 이 노트의 출력은 언어 규칙상 기대값이며 별도 실행 여부는 테스트 기록에서 구분합니다.

---
id: js-this-binding
title: "객체 메서드를 변수에 담아 호출했더니 this가 달라집니다. strict 환경에서 왜 실패하며 어떻게 고정하나요?"
answerMinutes: 5
followups: [{"id":"js-arrow-this","prompt":"분리한 메서드를 화살표 래퍼로 감쌀 때 this와 인자 전달은 어떤 규칙을 따르나요?"},{"id":"js-closure-loop","prompt":"이벤트 핸들러를 bind로 고정하면서 반복별 ID를 캡처할 때 제거와 메모리 수명은 어떻게 관리할까요?"},{"id":"js-event-loop-microtasks","prompt":"bind한 메서드를 Promise 콜백으로 넘겼을 때 호출 시점의 큐와 this 결정은 서로 영향을 주나요?"}]
difficulty: 하
category: 언어·런타임
tags: ["JavaScript","this","strict mode","bind"]
related: ["js-arrow-this"]
---

# 객체 메서드를 변수에 담아 호출했더니 this가 달라집니다. strict 환경에서 왜 실패하며 어떻게 고정하나요?

## 구두 답변

일반 함수의 `this`는 함수를 정의한 위치보다 호출 형태로 결정됩니다. 메서드로 `counter.read()`를 호출하면 점 앞의 `counter`가 `this`가 되지만, 메서드를 변수에 분리하면 그 호출 관계가 사라집니다.

### 분리 호출이 잃는 정보

```js
'use strict';
const counter = { value: 7, read() { return this.value; } };
const detached = counter.read;
console.log(counter.read()); // 7
try { console.log(detached()); } catch (e) { console.log(e.name); } // TypeError
const fixed = counter.read.bind(counter);
console.log(fixed()); // 7
```

strict mode의 일반 함수 호출에서 `this`는 `undefined`입니다. 따라서 `this.value`를 읽는 순간 `TypeError`가 납니다. 비엄격한 일반 함수 호출에서는 `this`가 전역 객체로 보정될 수 있지만, 전역 프로퍼티를 우연히 읽거나 수정하게 되어 모듈·브라우저·Node 실행 방식에 따라 결과가 달라질 수 있으므로 의존하지 않겠습니다.

### bound 함수의 관리

`bind(counter)`는 지정한 `this`와 선택적 앞쪽 인자를 기억하는 새 함수를 만듭니다. 나중에 `fixed()`로 호출해도 객체 메서드 관계가 없어지지 않습니다. 한 번만 즉시 호출할 때는 `counter.read.call(other)`처럼 호출 시 대상을 지정할 수 있지만, 콜백으로 전달해 계속 사용할 함수라면 bind나 명시적 래퍼가 의도를 보존합니다. `bind`가 원본 함수를 수정하는 것은 아니며, 불필요하게 매번 새 bound 함수를 만들면 이벤트 제거 시 함수 동일성 문제가 생길 수 있습니다.

### 선택 기준과 검증

`bind`는 this와 앞쪽 인자를 기억한 새 함수이므로 이벤트 등록 때 만든 참조를 필드에 보관해야 제거할 수 있습니다. 매번 `bind`를 호출해 제거할 때 새 함수를 넘기면 같은 리스너로 인식되지 않습니다. UI가 unmount됐거나 세션이 끝난 뒤 callback이 실행되는 논리적 종료 문제는 bind가 해결하지 않으므로 abort나 상태 세대 검사를 별도로 두겠습니다.

bind한 함수는 일반 호출에서 고정한 this를 쓰지만, 원본이 생성 가능한 함수이고 new로 호출한다면 생성자 호출의 this 규칙이 적용됩니다. 따라서 bind를 모든 호출 형태의 영구적인 객체 메서드 관계라고 설명하지 않겠습니다. 또 f.call(obj)는 한 번의 호출 대상만 지정하고 다음 호출까지 함수를 변경하지 않습니다. 호출 형태를 코드에서 드러내는 것이 우선입니다.

브라우저 addEventListener에 일반 함수를 전달하면 this가 리스너의 currentTarget과 연결되는 계약이 있을 수 있지만, Promise.then이 같은 방식으로 호출해 준다고 기대할 수 없습니다. 콜백 API가 어떤 receiver와 인자를 주는지 확인해야 합니다. 중간 래퍼를 두면 전달되는 인자와 반환 Promise까지 유지해야 하고, 새 함수 참조가 생긴다는 점도 등록·해제에서 관리하겠습니다.

## 득점 포인트

- 호출 형태가 일반 함수 this를 정한다는 원리를 설명한다.
- bind·call·래퍼의 수명과 함수 동일성을 비교한다.
- strict/module과 비엄격 전역 보정을 구분한다.

## 감점 포인트

- 함수 정의 위치가 일반 함수의 this를 영구 결정한다고 말한다.
- strict 분리 호출에서 this가 전역 객체라고 설명한다.
- bind가 원본 함수 자체를 수정하거나 매번 새 함수를 제거에 써도 된다고 말한다.

## 더 파고들 거리

- class 메서드를 콜백으로 넘길 때 bind·화살표·래퍼 중 무엇을 고를까요?
- bind로 앞쪽 인자를 고정하면 callback API의 나머지 인자는 어떻게 받나요?
- 이벤트 제거를 위해 bound 함수 참조를 어떤 객체 수명에 보관할까요?

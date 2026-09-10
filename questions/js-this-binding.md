---
id: js-this-binding
title: "객체 메서드를 변수에 담아 호출했더니 this가 달라집니다. strict 환경에서 왜 실패하며 어떻게 고정하나요?"
difficulty: 하
category: 언어·런타임
tags: ["JavaScript","this","strict mode","bind"]
related: ["js-arrow-this"]
---

# 객체 메서드를 변수에 담아 호출했더니 this가 달라집니다. strict 환경에서 왜 실패하며 어떻게 고정하나요?

## 구두 답변

일반 함수의 `this`는 함수를 정의한 위치보다 호출 형태로 결정됩니다. 메서드로 `counter.read()`를 호출하면 점 앞의 `counter`가 `this`가 되지만, 메서드를 변수에 분리하면 그 호출 관계가 사라집니다.

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

`bind(counter)`는 지정한 `this`와 선택적 앞쪽 인자를 기억하는 새 함수를 만듭니다. 나중에 `fixed()`로 호출해도 객체 메서드 관계가 없어지지 않습니다. 한 번만 즉시 호출할 때는 `counter.read.call(other)`처럼 호출 시 대상을 지정할 수 있지만, 콜백으로 전달해 계속 사용할 함수라면 bind나 명시적 래퍼가 의도를 보존합니다. `bind`가 원본 함수를 수정하는 것은 아니며, 불필요하게 매번 새 bound 함수를 만들면 이벤트 제거 시 함수 동일성 문제가 생길 수 있습니다.

## 득점 포인트

- 메서드 호출과 분리된 일반 함수 호출의 this 결정을 구분한다.
- strict mode에서 undefined가 되어 프로퍼티 접근이 실패하는 이유를 말한다.
- bind의 새 함수와 call의 일회성 호출, 함수 동일성 비용을 설명한다.

## 감점 포인트

- 함수 정의 위치가 일반 함수의 this를 영구히 결정한다고 말한다.
- strict mode의 분리 호출에서 this가 전역 객체라고 말한다.
- bind가 원본 함수의 this를 바꾼다고 말한다.

## 더 파고들 거리

- class 메서드를 콜백으로 넘길 때 this를 보존하는 선택지는 무엇인가요?
- bind로 앞쪽 인자를 고정하면 나머지 인자는 어떻게 전달되나요?
- 이벤트 리스너를 제거할 때 bound 함수의 참조를 어떻게 보관해야 하나요?

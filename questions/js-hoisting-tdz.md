---
id: js-hoisting-tdz
title: "함수 안에서 선언문보다 먼저 변수를 읽었더니 var는 undefined이고 let·const는 ReferenceError입니다. 변수의 생성과 초기화 시점은 어떻게 다른가요?"
difficulty: 하
category: 언어·런타임
tags: ["JavaScript","호이스팅","var","TDZ"]
related: ["js-closure-loop"]
---

# 함수 안에서 선언문보다 먼저 변수를 읽었더니 var는 undefined이고 let·const는 ReferenceError입니다. 변수의 생성과 초기화 시점은 어떻게 다른가요?

## 구두 답변

`var`와 `let`, `const`는 선언이 코드 아래에 있다는 사실만으로 같은 결과를 내지 않습니다.

```js
function sample() {
  console.log(a); // undefined
  var a = 1;
  try { console.log(b); } catch (e) { console.log(e.name); } // ReferenceError
  let b = 2;
  try { console.log(c); } catch (e) { console.log(e.name); } // ReferenceError
  const c = 3;
}
sample();
```

함수 실행 환경을 만들 때 `var a`의 바인딩은 먼저 만들어지고 초기값 `undefined`를 받습니다. `a = 1`이라는 할당은 실제 실행 위치에서 일어나므로 그 전에는 `undefined`입니다. 이를 흔히 호이스팅이라고 부르지만, 값 전체가 위로 이동하거나 코드가 재배열되는 것은 아닙니다. 함수 선언문처럼 선언과 함수 객체 준비가 함께 이뤄지는 문법은 별도의 규칙을 가집니다.

`let`과 `const`도 블록 시작 시 식별자를 위한 렉시컬 바인딩이 준비되지만, 선언문을 실행해 초기화하기 전까지는 값을 읽을 수 없는 일시적 사각지대(TDZ)에 있습니다. 그래서 아래 선언이 존재한다는 이유로 `typeof b`조차 안전하지 않습니다. 이 구간에서 읽거나 할당하면 `ReferenceError`이고, `const`는 초기화 뒤 재할당도 허용하지 않습니다. 블록 밖의 같은 이름 변수를 가리는 경우에도 안쪽 TDZ가 우선합니다.

실무에서는 선언을 사용 위치보다 앞에 두고, 기본적으로 블록 스코프인 `let`과 `const`를 선택하는 편이 읽기와 오류 발견에 유리합니다. `var`의 동작을 근거로 선언문을 자유롭게 앞당겨도 된다고 판단하지 말고, 특히 조건문·반복문에서 실제 스코프와 초기화 시점을 확인하겠습니다.

## 득점 포인트

- var의 바인딩 준비와 할당 실행을 분리해 설명한다.
- let·const의 미초기화 바인딩과 TDZ를 구분한다.
- 블록 스코프와 const 재할당 제한까지 연결한다.

## 감점 포인트

- 호이스팅을 할당 값까지 위로 이동하는 복사라고 말한다.
- TDZ에서 typeof를 호출해도 항상 undefined라고 말한다.
- let·const가 선언 자체도 전혀 준비되지 않는다고 말한다.

## 더 파고들 거리

- 함수 선언문과 함수 표현식은 호출 가능 시점이 어떻게 다른가요?
- 중첩 블록의 같은 이름 선언이 바깥 변수를 가리는 시점은 언제인가요?
- 모듈 환경의 최상위 let·const와 전역 객체 프로퍼티는 어떻게 다른가요?

---
id: js-arrow-this
title: "객체 메서드 안에서 만든 화살표 함수와 일반 함수의 this가 서로 다른 값을 가리키는 이유는 무엇인가요?"
difficulty: 하
category: 언어·런타임
tags: ["JavaScript","화살표 함수","this","lexical this"]
related: ["js-this-binding"]
---

# 객체 메서드 안에서 만든 화살표 함수와 일반 함수의 this가 서로 다른 값을 가리키는 이유는 무엇인가요?

## 구두 답변

화살표 함수는 자기 `this`를 만들지 않고, 만들어진 시점의 바깥 함수나 메서드가 가진 `this`를 어휘적으로 캡처합니다. 일반 함수는 같은 위치에서 만들어졌더라도 호출된 객체를 기준으로 `this`를 정합니다.

```js
const box = {
  value: 10,
  makePair() {
    return {
      normal: function () { return this.value; },
      arrow: () => this.value
    };
  }
};
const pair = box.makePair();
pair.value = 20;
console.log(pair.normal(), pair.arrow()); // 20 10
```

`makePair()`는 메서드 호출이므로 그 안의 `this`는 `box`입니다. `normal`은 `pair.normal()`이라는 호출로 실행되어 `pair`를 보고 20을 반환합니다. `arrow`는 호출할 때 점 앞의 객체를 새 `this`로 받지 않고, 생성 당시의 `box`를 계속 보므로 10을 반환합니다. 이 특성은 타이머나 배열 콜백에서 바깥 객체를 사용해야 할 때 유용합니다.

반대로 화살표 함수를 객체의 메서드로 작성하면 호출 객체의 `this`를 얻지 못할 수 있습니다. 화살표에는 자체 `arguments`, `super`, `new.target`도 없고 `new`의 생성자로 사용할 수도 없습니다. `call`, `apply`, `bind`로 화살표의 `this`를 바꿀 수 있다는 기대도 틀립니다. 객체 메서드처럼 호출 대상에 따라 달라져야 하면 일반 메서드를, 바깥 문맥을 고정해야 하면 화살표를 선택하겠습니다.

## 득점 포인트

- 화살표 함수의 lexical this와 일반 함수의 호출 기반 this를 대비한다.
- 예제에서 pair와 box가 각각 반환값을 결정하는 과정을 설명한다.
- 메서드·콜백·생성자 선택 기준과 bind 무효 조건을 말한다.

## 감점 포인트

- 화살표 함수도 점 앞 객체를 this로 받는다고 말한다.
- 화살표 함수에 bind를 적용하면 this가 바뀐다고 말한다.
- 화살표 함수를 new의 생성자로 사용할 수 있다고 말한다.

## 더 파고들 거리

- 클래스 생성자에서 타이머 콜백에 화살표를 쓸 때 어떤 수명이 캡처되나요?
- 화살표 함수의 arguments가 필요할 때 어떤 대안을 사용하나요?
- 객체 리터럴의 화살표 메서드가 테스트에서 잘못된 this를 보이는 사례는 무엇인가요?

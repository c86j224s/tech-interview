---
id: js-prototype-lookup
title: "객체에 직접 값을 넣었다가 삭제했는데 같은 이름의 값이 여전히 조회됩니다. 프로토타입을 따라 찾는 과정과 class 메서드의 저장 위치를 설명해 보세요."
difficulty: 중하
category: 언어·런타임
tags: ["JavaScript","프로토타입","프로퍼티 조회","class","shadowing"]
related: ["js-object-copy"]
---

# 객체에 직접 값을 넣었다가 삭제했는데 같은 이름의 값이 여전히 조회됩니다. 프로토타입을 따라 찾는 과정과 class 메서드의 저장 위치를 설명해 보세요.

## 구두 답변

프로퍼티를 읽을 때 JavaScript는 먼저 객체 자신의 own 프로퍼티를 찾고, 없으면 `[[Prototype]]` 연결을 따라가며 찾습니다. 상속받은 이름과 같은 own 프로퍼티를 만들면 상속 프로퍼티를 가리는 shadowing이 일어납니다.

```js
const base = { kind: 'base', describe() { return this.kind; } };
const item = Object.create(base);
item.kind = 'item';
console.log(Object.hasOwn(item, 'kind'), item.describe()); // true item
delete item.kind;
console.log(item.kind); // base

class User { greet() { return 'hi'; } }
const user = new User();
console.log(Object.hasOwn(user, 'greet'));          // false
console.log(Object.hasOwn(User.prototype, 'greet')); // true
```

`item.describe`는 `item`에 own 프로퍼티가 없으므로 `base`에서 찾지만, 호출 형태가 `item.describe()`이므로 메서드 안의 `this`는 `item`입니다. 따라서 처음에는 own `kind`인 `item`을 읽고, 그 프로퍼티를 삭제한 뒤에는 프로토타입의 `base`를 읽습니다. 읽기에서는 `in`이 프로토타입까지 포함하고, `Object.hasOwn`은 객체 자신만 검사하므로 목적에 맞는 API를 선택해야 합니다.

`class` 문법으로 만든 일반 인스턴스 메서드는 보통 각 인스턴스에 복사되지 않고 `User.prototype`에 놓여 공유됩니다. 그렇다고 프로토타입에 있는 모든 상태가 인스턴스별로 분리되는 것은 아니며, 배열 같은 가변 값을 프로토타입에 두면 여러 인스턴스가 공유할 수 있습니다. 인증·외부 입력 이름을 프로퍼티 키로 다룰 때는 `hasOwn`과 안전한 자료구조를 사용해 의도하지 않은 상속 프로퍼티를 데이터로 받아들이지 않겠습니다.

## 득점 포인트

- own 조회와 프로토타입 체인 조회의 순서를 설명한다.
- shadowing과 delete 이후의 재조회 결과를 this와 연결한다.
- class 메서드의 prototype 저장과 공유 가변 상태의 위험을 말한다.

## 감점 포인트

- 상속받은 프로퍼티는 own 프로퍼티와 구별할 수 없다고 말한다.
- delete가 프로토타입의 같은 이름 프로퍼티까지 삭제한다고 말한다.
- class 메서드가 모든 인스턴스에 함수 복사본으로 저장된다고 말한다.

## 더 파고들 거리

- Object.hasOwn과 in, 직접 undefined 비교는 존재성 검사에서 어떻게 다른가요?
- 프로토타입 체인을 길게 만들면 조회와 디버깅에 어떤 비용이 생기나요?
- Object.create(null) 객체는 일반 객체와 어떤 프로퍼티 조회 차이가 있나요?

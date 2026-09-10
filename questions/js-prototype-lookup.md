---
id: js-prototype-lookup
title: "객체에 직접 값을 넣었다가 삭제했는데 같은 이름의 값이 여전히 조회됩니다. 프로토타입을 따라 찾는 과정과 class 메서드의 저장 위치를 설명해 보세요."
answerMinutes: 5
followups: [{"id":"js-object-copy","prompt":"prototype의 가변 배열과 spread 복사본을 함께 사용할 때 어느 데이터가 공유되나요?"},{"id":"js-this-binding","prompt":"prototype 메서드를 변수로 분리 호출하면 property lookup과 this 바인딩은 각각 어떻게 진행되나요?"},{"id":"authentication-vs-authorization","prompt":"외부 키를 객체 프로퍼티로 해석한 결과와 사용자의 자원 접근 권한 검사를 어떤 순서로 분리할까요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["JavaScript","프로토타입","프로퍼티 조회","class","shadowing"]
related: ["js-object-copy"]
---

# 객체에 직접 값을 넣었다가 삭제했는데 같은 이름의 값이 여전히 조회됩니다. 프로토타입을 따라 찾는 과정과 class 메서드의 저장 위치를 설명해 보세요.

## 구두 답변

프로퍼티를 읽을 때 JavaScript는 먼저 객체 자신의 own 프로퍼티를 찾고, 없으면 `[[Prototype]]` 연결을 따라가며 찾습니다. 상속받은 이름과 같은 own 프로퍼티를 만들면 상속 프로퍼티를 가리는 shadowing이 일어납니다.

### own 프로퍼티에서 체인으로

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

### 공유 메서드와 입력 키

`class` 문법으로 만든 일반 인스턴스 메서드는 보통 각 인스턴스에 복사되지 않고 `User.prototype`에 놓여 공유됩니다. 그렇다고 프로토타입에 있는 모든 상태가 인스턴스별로 분리되는 것은 아니며, 배열 같은 가변 값을 프로토타입에 두면 여러 인스턴스가 공유할 수 있습니다. 인증·외부 입력 이름을 프로퍼티 키로 다룰 때는 `hasOwn`과 안전한 자료구조를 사용해 의도하지 않은 상속 프로퍼티를 데이터로 받아들이지 않겠습니다.

### 선택 기준과 검증

`undefined`를 읽었다고 프로퍼티가 없다는 뜻은 아니므로, 존재성은 `Object.hasOwn`이나 `in`으로 목적에 맞게 검사하겠습니다. 외부 입력을 일반 객체 키로 저장하면 상속 이름과 특수 프로퍼티가 데이터로 섞일 수 있어 `Map`이나 `Object.create(null)`을 검토합니다. prototype의 메서드 공유와 인스턴스별 가변 상태 초기화는 별도 책임입니다.

own 프로퍼티가 undefined라는 값을 가지면 프로토타입에 같은 이름의 값이 있어도 그것을 가립니다. 삭제해야 다음 프로토타입 값이 다시 보입니다. 또한 일반 프로퍼티 대입은 상속된 setter를 호출할 수 있으므로 '대입하면 언제나 own data property가 만들어진다'고 일반화하면 안 됩니다. 예제는 쓰기 가능한 일반 데이터 속성이라는 전제를 두고, 접근자와 읽기 전용 속성은 별도 검사하겠습니다.

class의 prototype 메서드는 기본적으로 열거되지 않지만 객체 리터럴의 메서드는 일반적으로 own enumerable 프로퍼티입니다. 그래서 for...in, Object.keys, spread의 결과가 같지 않을 수 있습니다. hasOwnProperty라는 이름 자체가 입력에 의해 덮일 수 있으므로 Object.hasOwn을 쓰거나 안전한 기본 메서드 호출을 선택합니다. Map과 null-prototype 객체는 상속 이름을 데이터로 오인하는 범위를 줄이지만 입력 검증과 권한 검사를 대신하지는 않습니다.

## 득점 포인트

- own과 prototype lookup의 순서를 설명한다.
- shadowing·delete·this를 하나의 실행 사례로 연결한다.
- class 메서드 공유와 안전한 키 조회를 판단한다.

## 감점 포인트

- 상속 프로퍼티와 own 프로퍼티를 구별할 수 없다고 말한다.
- delete가 prototype의 같은 이름까지 제거한다고 설명한다.
- class 메서드가 모든 인스턴스에 독립 함수로 복사된다고 가정한다.

## 더 파고들 거리

- Object.hasOwn·in·undefined 비교가 존재성에서 어떻게 다른가요?
- prototype chain이 길어질 때 lookup 비용과 디버깅 복잡도를 어떻게 측정할까요?
- Map과 Object.create(null)을 외부 키 저장소로 선택하는 기준은 무엇인가요?

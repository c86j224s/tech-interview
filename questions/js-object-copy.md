---
id: js-object-copy
title: "객체를 spread로 복사했는데 중첩 값이 함께 바뀝니다. 얕은 복사와 structuredClone의 범위는 어떻게 다른가요?"
answerMinutes: 5
followups: [{"id":"js-prototype-lookup","prompt":"spread 복사본의 own 프로퍼티와 원본 prototype 프로퍼티 조회가 어떻게 달라질까요?"},{"id":"js-equality-coercion","prompt":"깊은 복사 전후 객체를 ===로 비교해도 내용 동등성을 알 수 없는 이유는 무엇인가요?"},{"id":"python-shallow-deep-copy","prompt":"JavaScript structuredClone과 Python deepcopy가 함수·사용자 객체를 처리하는 한계는 어떻게 다른가요?"}]
difficulty: 하
category: 언어·런타임
tags: ["JavaScript","객체 복사","spread","structuredClone","참조 공유"]
related: ["js-prototype-lookup","js-equality-coercion"]
---

# 객체를 spread로 복사했는데 중첩 값이 함께 바뀝니다. 얕은 복사와 structuredClone의 범위는 어떻게 다른가요?

## 구두 답변

객체 spread는 새 바깥 객체를 만들지만 중첩 객체까지 재귀적으로 복제하지 않는 얕은 복사입니다. 따라서 중첩 프로퍼티는 원본과 같은 참조를 가질 수 있습니다.

### 객체 그래프에서 공유되는 것

```js
const source = { prefs: { dark: false } };
const shallow = { ...source };
shallow.prefs.dark = true;
console.log(source.prefs.dark, shallow.prefs === source.prefs); // true true

const original = { prefs: { dark: false } };
const deep = structuredClone(original);
deep.prefs.dark = true;
console.log(original.prefs.dark, deep.prefs.dark); // false true
console.log(deep.prefs === original.prefs); // false

try { structuredClone({ handler: () => {} }); }
catch (e) { console.log(e.name); } // DataCloneError
```

배열·객체·Map 같은 중첩 가변 값을 독립적으로 수정해야 하면 얕은 spread만으로는 부족합니다. 필요한 경로만 새로 만드는 선택적 불변 업데이트가 데이터 구조와 비용을 예측하기 쉽고, 지원되는 값 전체를 분리해야 할 때 웹 플랫폼의 `structuredClone` API가 재귀 복사와 순환 참조 처리를 제공할 수 있습니다. 다만 복사할 수 있는 값의 종류에는 제한이 있으며 함수는 복제하지 못해 예외가 납니다. 클래스 인스턴스의 프로토타입·메서드 보존을 일반화해서도 안 됩니다.

### 복사 도구의 선택

JSON 직렬화 후 다시 파싱하는 방식은 함수·`undefined`를 생략하거나 바꾸고 순환 참조에서는 오류가 나며 날짜나 숫자 특수값도 다른 형태가 될 수 있어 범용 깊은 복사로 쓰지 않겠습니다. 큰 버퍼를 복사하면 메모리 비용이 커지므로 소유권을 넘기는 transfer 옵션이나 구조 공유를 검토할 수 있지만, 그때는 원본 사용 가능 여부까지 확인해야 합니다. 복사 목적이 중첩 상태 격리인지, 직렬화인지, 성능인지 먼저 정하고 도구를 선택하겠습니다.

### 선택 기준과 검증

복사 범위는 변경 경로와 소유권으로 결정하겠습니다. 한 필드만 바뀌는 상태라면 필요한 경로만 새로 만드는 방식이 전체 `structuredClone`보다 저렴하지만, 공유된 노드를 실수로 수정하지 않는 규율이 필요합니다. 함수·DOM·클래스 인스턴스·transferable은 웹 API의 별도 계약이므로 ECMAScript 언어 기능과 같은 버전 보장으로 말하지 않겠습니다.

spread는 열거 가능한 own 프로퍼티의 값을 읽어 새 객체에 넣습니다. getter가 있으면 복사 시점에 getter가 실행될 수 있고, 원래의 접근자나 writable 같은 프로퍼티 descriptor를 그대로 복제하는 것은 아닙니다. 프로토타입의 속성도 일반 객체 spread로 복사되지 않습니다. 따라서 데이터 스냅샷이 필요한지 객체의 동작과 상속 구조까지 보존해야 하는지 먼저 구분하겠습니다.

지원되는 ArrayBuffer를 transfer하면 단순 복사와 달리 원본 버퍼가 분리되어 이전 소유자가 사용할 수 없게 됩니다. 큰 데이터를 워커에 넘길 때 복사량을 줄일 수 있지만 반환 후 원본을 다시 읽는 코드가 있으면 계약이 깨집니다. 순환 참조를 복제하는 것과 외부 DOM·함수의 동작을 복제하는 것도 다릅니다. 원본과 복사본의 별칭 관계, getter 실행, buffer 분리 여부를 각각 작은 테스트로 확인하겠습니다.

## 득점 포인트

- spread의 own enumerable 얕은 복사를 설명한다.
- structuredClone·함수·프로토타입·순환의 범위를 구분한다.
- 선택적 불변 업데이트와 복사 비용을 비교한다.

## 감점 포인트

- spread가 중첩 객체까지 독립적으로 복사한다고 말한다.
- structuredClone이 함수와 모든 class 인스턴스를 그대로 보존한다고 설명한다.
- JSON 왕복을 타입·순환 보존이 필요한 범용 복사로 추천한다.

## 더 파고들 거리

- getter 프로퍼티를 spread할 때 값 평가와 descriptor가 어떻게 달라지나요?
- structured clone의 순환 참조와 transferable 버퍼는 원본에 어떤 변화를 주나요?
- 불변 업데이트와 Immer의 프록시 비용을 어떤 변경 패턴에서 비교할까요?

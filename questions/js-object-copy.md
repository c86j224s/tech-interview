---
id: js-object-copy
title: "객체를 spread로 복사했는데 중첩 값이 함께 바뀝니다. 얕은 복사와 structuredClone의 범위는 어떻게 다른가요?"
difficulty: 하
category: 언어·런타임
tags: ["JavaScript","객체 복사","spread","structuredClone","참조 공유"]
related: ["js-prototype-lookup","js-equality-coercion"]
---

# 객체를 spread로 복사했는데 중첩 값이 함께 바뀝니다. 얕은 복사와 structuredClone의 범위는 어떻게 다른가요?

## 구두 답변

객체 spread는 새 바깥 객체를 만들지만 중첩 객체까지 재귀적으로 복제하지 않는 얕은 복사입니다. 따라서 중첩 프로퍼티는 원본과 같은 참조를 가질 수 있습니다.

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

배열·객체·Map 같은 중첩 가변 값을 독립적으로 수정해야 하면 얕은 spread만으로는 부족합니다. 필요한 경로만 새로 만드는 선택적 불변 업데이트가 데이터 구조와 비용을 예측하기 쉽고, 지원되는 값 전체를 분리해야 할 때 `structuredClone`이 재귀 복사와 순환 참조 처리를 제공할 수 있습니다. 다만 복사할 수 있는 값의 종류에는 제한이 있으며 함수는 복제하지 못해 예외가 납니다. 클래스 인스턴스의 프로토타입·메서드 보존을 일반화해서도 안 됩니다.

JSON 직렬화 후 다시 파싱하는 방식은 함수·`undefined`를 생략하거나 바꾸고 순환 참조에서는 오류가 나며 날짜나 숫자 특수값도 다른 형태가 될 수 있어 범용 깊은 복사로 쓰지 않겠습니다. 큰 버퍼를 복사하면 메모리 비용이 커지므로 소유권을 넘기는 transfer 옵션이나 구조 공유를 검토할 수 있지만, 그때는 원본 사용 가능 여부까지 확인해야 합니다. 복사 목적이 중첩 상태 격리인지, 직렬화인지, 성능인지 먼저 정하고 도구를 선택하겠습니다.

## 득점 포인트

- spread가 최상위 own enumerable 값만 새로 만든다는 점을 설명한다.
- 중첩 참조 공유와 structuredClone의 재귀 복사를 결과로 입증한다.
- 함수·프로토타입·JSON 직렬화 손실과 메모리 비용을 구분한다.

## 감점 포인트

- spread가 모든 중첩 객체를 독립 복사한다고 말한다.
- structuredClone이 함수와 모든 class 인스턴스를 그대로 복제한다고 말한다.
- JSON 왕복을 타입·순환 참조 보존이 필요한 범용 복사로 추천한다.

## 더 파고들 거리

- getter가 있는 객체를 spread할 때 평가와 프로퍼티 속성은 어떻게 달라지나요?
- structuredClone에서 순환 참조와 transferable ArrayBuffer는 어떻게 처리되나요?
- 불변 업데이트와 Immer 같은 프록시 기반 도구의 비용을 어떻게 비교하나요?

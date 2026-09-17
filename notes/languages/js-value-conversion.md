---
id: js-value-conversion
title: JavaScript 동등 비교·형 변환·정수 정밀도
topic: 언어·런타임
summary: 비교 규칙의 NaN·0 차이와 ToPrimitive hook을 추적하고 빈 입력·정수 문법·Number 안전 범위·BigInt·JSON 왕복을 설명합니다.
questionIds: [js-equality-coercion, js-objectis-samevaluezero, js-toprimitive-side-effects, js-number-bigint-precision]
---

# JavaScript 동등 비교·형 변환·정수 정밀도

## 빈 문자열·0 동치와 입력 검증

`input.value` 같은 폼 값은 문자열이므로, 사용자가 빈 칸을 제출하면 `'' == 0`은 `true`이고 `Number('')`는 `0`이 됩니다. 비교 연산자를 `===`로 바꾸면 암묵 변환은 줄지만 빈 문자열·허용할 숫자 문법·범위·정밀도를 대신 검사해 주지는 않으므로, 먼저 입력 타입과 업무 의미를 정합니다.

예를 들어 음수가 아닌 최소 단위 정수 금액만 받는다면 문자열 타입과 빈 값·숫자 문법을 확인한 뒤 Number로 바꾸고 Number.isSafeInteger 및 업무 상한을 검사할 수 있습니다. 소수점 금액은 통화별 최소 단위·반올림·decimal 정책이 추가로 필요합니다.

## 동일성 규칙별 특수값 처리

| 비교 | NaN 대 NaN | +0 대 -0 | 서로 다른 같은 내용 객체 |
| --- | --- | --- | --- |
| === | false | true | false |
| Object.is | true | false | false |
| SameValueZero | true | true | false |

Set·Map 키의 동일성은 SameValueZero를 사용합니다. Object.is로 구분한 두 0을 Set에서 별개 키로 보존할 수 있다고 기대하면 안 됩니다. 객체 내용의 깊은 동등성은 순환·날짜·prototype·별칭을 어떻게 볼지 정하는 별도 계약입니다.

느슨한 비교는 타입에 따른 규칙을 적용합니다. `0 == false`, `'' == 0`, `null == undefined`는 true이지만 이로부터 null이 모든 0 같은 값과 같다고 일반화할 수 없습니다. `value == null`을 null·undefined 둘 다의 부재 검사로 의도적으로 쓰는 제한된 관용구는 가능하지만 데이터 계약과 테스트로 의도를 드러냅니다.

## 객체 변환 메서드와 부수 효과

`String(value)`, `+value`, `value + 1`처럼 객체를 원시값 문맥에 넣으면 `Symbol.toPrimitive`가 있으면 먼저 `hint`와 함께 실행되고 원시값을 반환해야 합니다. 이 hook이 없을 때의 일반적인 fallback은 number hint에서 `valueOf`를 먼저, string hint에서 `toString`을 먼저 시도하지만, default hint에는 Date 같은 예외가 있습니다. 따라서 한 줄의 비교·덧셈도 메서드 부수 효과나 예외를 실행할 수 있습니다.

```js
const trace = [];
const value = {
  [Symbol.toPrimitive](hint) {
    trace.push(hint);
    return hint === 'string' ? 'label' : 4;
  },
};
console.log(String(value), +value, value + 1); // label, 4, 5
console.log(trace); // ['string', 'number', 'default']
```

비교·덧셈 한 줄도 hook의 부수 효과나 예외를 만들 수 있습니다. 외부 객체를 금액·인가 조건에 암묵 변환하지 말고 데이터 전용 타입을 검증합니다. +는 원시값 변환 뒤 문자열이 관여하면 연결이 될 수 있으므로 숫자 덧셈이라는 의도를 입력 경계에서 확정합니다.

```diagram
{"title":"값을 비교하기 전에 도메인 표현을 확정합니다","caption":"화살표는 외부 숫자 입력 검증 순서입니다. 명시적 Number 변환도 빈 문자열을 허용하므로 문법 검사보다 먼저 정답 판정에 사용하지 않습니다.","rows":[[{"id":"input","label":"외부 입력 타입 확인"}],[{"id":"syntax","label":"빈 값·정수 문법 검사"}],[{"id":"parse","label":"Number 또는 BigInt 변환"}],[{"id":"range","label":"정밀도·업무 범위 확인"}],[{"id":"compare","label":"확정된 도메인 값 비교"}]],"edges":[{"from":"input","to":"syntax","label":"문자열 계약"},{"from":"syntax","to":"parse","label":"허용 형식만"},{"from":"parse","to":"range","label":"변환 성공"},{"from":"range","to":"compare","label":"유효 값"}]}
```

## Number 정밀도 손실과 BigInt 복구 한계

`Number`는 `-(2**53 - 1)`부터 `2**53 - 1`까지의 정수를 모두 정확히 구분할 수 있어 이 범위를 안전 정수 범위라고 부릅니다. `2**53`처럼 범위 밖에서도 어떤 정수는 정확히 표현되지만, 인접한 모든 정수를 구분할 수 없으므로 safe integer가 아닙니다.

```js
const parsed = JSON.parse('{"id":9007199254740993}');
console.log(parsed.id);          // 9007199254740992
console.log(BigInt(parsed.id));  // 9007199254740992n, 복구되지 않음
const exact = BigInt('9007199254740993');
```

식별자가 계산 대상이 아니면 문자열로 끝까지 유지하는 것이 단순합니다. 선행 0·부호·정규 형식·최대 길이를 검증하고 문자열 정렬과 수치 정렬을 혼동하지 않습니다. BigInt가 필요하면 문자열에서 직접 변환하고 JSON의 기본 stringify가 BigInt를 지원하지 않는 경로에 명시적인 문자열 어댑터를 둡니다.

BigInt와 Number의 일반 산술 혼합은 TypeError가 될 수 있고 Number로 되돌리면 다시 정밀도를 잃을 수 있습니다. 금액은 정수 ID와 달리 산술·반올림 규칙까지 필요하므로 같은 정책으로 묶지 않습니다.

## 식별자 표현의 브라우저·서버·중간 계층 왕복 보존

최대 안전 정수 주변의 인접 ID·빈 값·공백·지수 표기·NaN·Infinity·선행 0을 테스트합니다. 무엇을 허용할지는 API의 명시적 문법으로 정합니다. 서버 JSON·메시지 큐·DB 드라이버·로그·브라우저를 왕복해 원래 문자열이 보존되는지 확인합니다.

비교 연산자 통일만 완료로 보지 않고 잘못된 타입의 hook이 실행되지 않는지도 검토합니다. 위 출력은 JavaScript 규칙상 기대 결과이며 전체 서비스 왕복 테스트를 실제 수행했다는 뜻은 아닙니다.

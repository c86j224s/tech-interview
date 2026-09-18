---
id: js-object-graph
title: JavaScript 프로퍼티 조회와 객체 그래프 복사
topic: 언어·런타임
summary: own·상속·undefined·getter를 구분하고 spread·structuredClone·경로 복사·proxy 업데이트의 공유 관계와 측정 조건을 설명합니다.
questionIds: [js-prototype-lookup, js-property-existence-undefined, prototype-chain-performance, js-object-copy, js-spread-getter-descriptor, immutable-proxy-update-cost]
---

# JavaScript 프로퍼티 조회와 객체 그래프 복사

JavaScript 객체를 이해하는 기본 모델은 값을 보는 것과 프로퍼티 슬롯·prototype 연결·객체 참조를 보는 것을 분리하는 것입니다. 같은 `undefined`라도 own 프로퍼티가 있는 경우와 아예 없는 경우가 다르고, 루트 객체를 복사해도 중첩 노드의 참조가 공유될 수 있으므로 조회·복사·불변 업데이트를 각각 추적해야 합니다.

## 삭제 이후 값 재등장과 상속 경로

객체에서 프로퍼티를 읽으면 own 프로퍼티를 먼저 찾고 없을 때 prototype 연결을 따라갑니다. own 값이 undefined라도 프로퍼티 자체가 있으면 상속값을 가립니다. 삭제하면 그제야 다음 prototype의 값이 보일 수 있습니다.

```js
const base = { kind: 'base', describe() { return this.kind; } };
const item = Object.create(base);
item.kind = undefined;
console.log(item.kind, Object.hasOwn(item, 'kind')); // undefined, true
item.kind = 'item';
console.log(item.describe()); // item
 delete item.kind;
console.log(item.kind, 'kind' in item, Object.hasOwn(item, 'kind'));
// base, true, false
```

describe는 base에서 찾았지만 `item.describe()`로 호출했으므로 this는 item입니다. 메서드가 저장된 곳과 호출 receiver는 다릅니다.

이 차이를 디버깅할 때는 `Object.hasOwn`, `in`, 실제 읽기 결과를 한 행에 함께 기록합니다. 삭제 뒤 값이 다시 나타나면 먼저 prototype chain에서 온 것인지 확인하고, getter나 Proxy가 있다면 검사 자체가 사용자 코드를 실행했을 가능성도 로그로 분리합니다. 존재성은 값의 허용 여부나 권한을 자동으로 증명하지 않습니다.

 위의 대입은 쓰기 가능한 일반 데이터 프로퍼티를 전제로 합니다. 상속된 setter나 읽기 전용 속성이 있으면 대입이 항상 새 own data property를 만드는 것은 아닙니다.

## 존재성과 값의 분리 검사

| 검사 | own undefined | 상속 프로퍼티 | 완전히 없음 |
| --- | --- | --- | --- |
| Object.hasOwn | true | false | false |
| `key in object` | true | true | false |
| `object[key] === undefined` | true | 상속값에 따라 다름 | true |

객체 자신의 hasOwnProperty 메서드는 덮일 수 있고 null-prototype 객체에는 없을 수 있습니다. Object.hasOwn처럼 안전한 호출 API를 사용합니다. getter·Proxy는 읽기와 존재 검사에 사용자 코드를 실행할 수 있으므로 임의 객체를 순수 데이터로 가정하지 않습니다. 존재성 검사는 허용 값이나 권한의 증명이 아닙니다.

class의 일반 prototype 메서드는 인스턴스마다 복사되지 않으며 기본적으로 열거되지 않습니다. 객체 리터럴의 메서드는 보통 own enumerable입니다. Object.keys·for...in·spread의 결과가 같은 목록은 아닙니다. prototype에 가변 배열을 두면 여러 인스턴스가 그 배열을 공유할 수 있습니다.

## Spread 루트 복사와 중첩 참조 공유

```js
const source = { prefs: { dark: false } };
const copy = { ...source };
copy.prefs.dark = true;
console.log(source !== copy, source.prefs === copy.prefs); // true, true
```

```diagram
{"title":"새 바깥 객체 두 개가 같은 중첩 객체를 가리킵니다","caption":"화살표는 객체 참조입니다. spread 뒤 루트가 달라도 prefs를 수정하면 두 루트에서 같은 변경을 관찰합니다.","rows":[[{"id":"source","label":"source"},{"id":"copy","label":"spread copy"}],[{"id":"prefs","label":"공유 prefs 객체","detail":["dark = true"]}]],"edges":[{"from":"source","to":"prefs","label":"prefs 참조"},{"from":"copy","to":"prefs","label":"같은 참조 복사"}]}
```

spread는 열거 가능한 own 문자열·symbol 키를 읽어 새 객체에 데이터 프로퍼티로 저장합니다. 원본 키가 getter라면 이 읽기 과정에서 getter가 실행되고, 반환된 값이 저장되므로 원래 접근자 descriptor·읽기 전용 속성·prototype이 그대로 복제되지는 않습니다. getter가 예외를 던지면 spread 자체도 실패할 수 있습니다. descriptor 보존이 필요하면 명시적 descriptor API를 검토하되, 그 방법도 외부 파일·연결 같은 자원의 소유권까지 복제하지는 않습니다.

## Structured clone과 JSON 왕복의 계약 차이

structuredClone은 지원되는 객체 그래프의 순환·공유 별칭을 새 그래프 안에서 보존할 수 있습니다. 같은 원본 객체를 두 필드가 가리키면 복사본에서도 두 필드가 같은 새 객체를 가리킵니다. 원본의 가변 노드와는 분리되지만 함수·DOM·임의 클래스 prototype의 동작을 그대로 복제하는 범용 기능은 아닙니다. 지원하지 않는 값은 DataCloneError 등 실패가 생깁니다.

JSON 왕복은 순환에서 실패하고 undefined·함수 생략, 날짜·숫자 특수값 변환 등 정보 손실이 있어 범용 deep copy가 아닙니다. BigInt도 기본 JSON 직렬화에 별도 변환이 필요합니다. 외부 파일·네트워크 연결처럼 데이터 복사와 소유 수명이 다른 대상은 별도 API가 필요합니다.

ArrayBuffer transfer는 복사와 달리 송신 쪽 버퍼를 detach합니다. SharedArrayBuffer는 공유이며 detach되지 않는 대신 동기화가 필요합니다. 지원 값과 보안 조건은 웹 호스트 API 계약이므로 ECMAScript 문법 하나로 모든 환경 지원을 보장하지 않습니다.

## 불변 업데이트와 경로별 구조 복사

```js
const next = {
  ...source,
  prefs: { ...source.prefs, dark: false },
};
```

변경하지 않은 노드는 구조적으로 공유하고 바뀐 경로만 복사하면 전체 그래프 복사량을 줄일 수 있습니다. 하지만 공유 노드를 나중에 직접 변경하지 않는 규율이 필요합니다. Object.freeze도 기본적으로 얕은 동결이므로 중첩 전체 불변성을 자동 제공하지 않습니다.

Proxy 기반 라이브러리는 draft에 대한 변경을 추적해 필요한 새 구조를 만들 수 있지만, 읽기 trap·경로 추적·freeze·할당 비용이 추가됩니다. 비교할 때는 깊은 트리의 한 leaf만 바꾸는 경우, 넓은 배열을 대량 변경하는 경우, 읽기만 많은 루프를 분리하고 같은 결과와 불변식을 확인합니다.

버전·개발/운영 옵션·자동 동결·변경률을 고정하지 않은 속도 수치는 서로 다른 실행 조건을 섞으므로 의미가 약합니다. 외부 자원 복사나 동시 writer 사이에서 한 변경이 다른 쓰기에 덮이는 lost update까지 이 라이브러리가 자동으로 해결한다고 가정하지 않습니다.

## Prototype 성능과 shape·cache·guard 조건

언어상 조회는 체인을 따르지만 엔진은 object shape·inline cache·가드로 반복 접근을 최적화할 수 있습니다. 같은 shape의 안정적인 접근과 여러 shape를 섞거나 prototype을 자주 바꾸는 접근을 따로 측정합니다. 체인 길이 하나만 늘린 microbenchmark를 앱 전체 비용으로 일반화하지 않습니다.

값이 어느 prototype에서 왔는지 디버깅하는 비용과 메서드 공유의 메모리 이점도 비교합니다. 외부 키 사전은 Map·null-prototype 객체로 상속 이름 혼동을 줄일 수 있지만 스키마·인가 검사는 여전히 필요합니다.

## 참조 관계와 descriptor 검사

루트와 중첩 객체의 ===, 순환의 자기 참조, getter 실행 횟수, Object.getOwnPropertyDescriptor 결과를 확인합니다. 변환 실패·transfer 뒤 원본 접근·원본 불변성도 검사합니다. 성능 비교는 기능 결과가 같은지 먼저 확인하고 warmup·할당·GC·실제 접근 분포를 기록합니다. 이 노트는 기대 계약을 설명하며 별도 성능 측정을 수행한 결과는 아닙니다.

재현 연습은 own `undefined`, 상속 값, getter, 순환 그래프, spread 뒤 중첩 수정, structured clone의 공유 별칭을 한 세트로 검사하는 것입니다. 예상 결과는 own `undefined`가 상속값을 가리고, spread 루트는 새롭지만 중첩 참조는 공유하며, structured clone은 지원되는 그래프 안에서 원본과 분리된 새 노드를 만든다는 것입니다. 성능 결론은 이 기능 결과 검사가 통과한 뒤 동일한 엔진·옵션·warmup 조건에서만 비교합니다.

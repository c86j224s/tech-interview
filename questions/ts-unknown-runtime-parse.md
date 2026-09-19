---
id: ts-unknown-runtime-parse
title: JSON을 타입 단언으로 바꿨는데 런타임에 필드가 없습니다. unknown과 런타임 검증을 어디에 두나요?
difficulty: 중하
category: 언어·런타임
tags:
  - TypeScript
  - unknown
  - runtime-validation
  - 언어·런타임
related:
  - js-prototype-lookup
  - js-equality-coercion
---
# JSON을 타입 단언으로 바꿨는데 런타임에 필드가 없습니다. unknown과 런타임 검증을 어디에 두나요?

## 구두 답변

`as User`는 compiler에게 해당 값으로 취급하라고 지시할 뿐 JSON을 검사하거나 없는 필드를 만들어 주지 않습니다. assertion은 산출 JavaScript에 runtime check를 추가하지 않으므로 외부 입력은 `unknown`으로 받고 boundary adapter에서 실제 구조를 검사해야 합니다.

```ts
type User = { id: string; age: number };
function isUser(x: unknown): x is User {
  if (typeof x !== 'object' || x === null) return false;
  const v = x as Record<string, unknown>;
  return typeof v.id === 'string'
      && typeof v.age === 'number'
      && Number.isFinite(v.age);
}
```

입력이 `{id:'u1'}`라면 T0는 unknown, T1 object/null 검사는 통과하지만 T2 age의 `typeof`에서 실패하여 service로 전달하지 않습니다. `{id:'u1', age:20}`은 최소 guard를 통과해 `User`로 좁혀집니다. `age`가 숫자여도 NaN·음수·상한 초과를 허용할지 도메인 규칙이 더 필요합니다. 배열은 `Array.isArray`와 원소별 검사, 중첩 object는 각 nested field 검사가 필요하며 prototype이나 알 수 없는 필드 정책도 결정해야 합니다.

검증된 값을 service에 넘긴 뒤 외부 alias가 object를 바꾸지 못하게 필요한 필드만 복사하거나 immutable DTO로 정규화하는 것이 안전합니다. 반대로 내부 모든 함수가 매번 unknown guard를 반복하면 책임과 비용이 분산됩니다. assertion은 이미 검증된 invariant를 표현하는 좁은 지점에서는 유용하지만 HTTP·파일·localStorage 경계를 건너뛰는 shortcut으로 쓰면 안 됩니다.

## 득점 포인트

- 타입 단언이 runtime code를 만들지 않는다는 결론을 먼저 말하고 unknown→guard→내부 타입의 경계를 제시합니다.
- 누락 age, NaN, 배열, 중첩 구조를 단순 필드 존재 확인과 구분합니다.
- 검증 위치를 boundary adapter에 모으되 mutation 수명과 immutable copy를 고려합니다.

## 감점 포인트

- `as User`만으로 JSON이 User가 된다고 하면 assertion과 validation을 혼동한 것입니다.
- `typeof x === 'object'`만 확인하면 null·배열·원소 타입을 놓칩니다.
- type predicate가 항상 true를 반환해도 compiler가 검증해 준다고 믿으면 잘못된 타입이 내부 전체로 퍼집니다.

## 더 파고들 거리

- schema version이 바뀔 때 v1 payload를 v2 내부 DTO로 변환하는 위치를 정해 보세요.
- validation error를 HTTP 400으로 반환할지 내부 장애로 기록할지 입력 경계와 신뢰 수준에 따라 나눠 보세요.

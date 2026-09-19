---
id: ts-discriminated-union-exhaustive
title: 서로 다른 응답을 discriminated union으로 모델링할 때 never 검사가 누락된 분기를 어떻게 찾나요?
difficulty: 중하
category: 언어·런타임
tags:
  - TypeScript
  - discriminated-union
  - narrowing
  - 언어·런타임
related:
  - js-prototype-lookup
  - js-equality-coercion
---
# 서로 다른 응답을 discriminated union으로 모델링할 때 never 검사가 누락된 분기를 어떻게 찾나요?

## 구두 답변

응답마다 literal discriminant를 두고 union으로 묶은 뒤, `default`에서 남은 값을 `never`에 넘기면 누락 분기를 컴파일 오류로 찾을 수 있습니다. 예를 들어 data·retry 두 종류만 있던 union에 fatal을 추가했는데 switch에 case를 추가하지 않으면 default의 값은 never가 아니라 fatal member가 됩니다.

```ts
type Reply =
  | { kind: 'data'; rows: string[] }
  | { kind: 'retry'; afterMs: number }
  | { kind: 'fatal'; reason: string };
function assertNever(x: never): never { throw new Error(String(x)); }
function describe(r: Reply) {
  switch (r.kind) {
    case 'data': return `${r.rows.length} rows`;
    case 'retry': return `retry in ${r.afterMs}`;
    case 'fatal': return r.reason;
    default: return assertNever(r);
  }
}
```

T0에 r의 정적 타입은 세 member입니다. T1에 `r.kind === 'data'` case에서는 data만 남고 rows를 안전하게 읽습니다. T2에 retry와 fatal도 소비한 뒤 default에 도달할 수 있는 union이 없어 `r`가 never가 됩니다. case를 하나 삭제하면 T3에 default의 r가 해당 member가 되어 `assertNever(r)` 호출이 compile error가 됩니다. 이는 내부 코드가 선언된 union을 빠짐없이 처리한다는 컴파일 계약이지, `JSON.parse(x) as Reply`가 실제로 올바른 kind를 가진다는 runtime 증거는 아닙니다. 외부 입력은 먼저 unknown guard를 통과해야 하며, type predicate가 잘못되면 never 패턴도 잘못된 값을 막지 못합니다.

## 득점 포인트

- literal discriminant가 union member와 payload를 연결한다는 점을 설명합니다.
- case 삭제 후 default의 r가 never가 아니게 되는 정확한 compile-time 상태를 제시합니다.
- exhaustive check와 JSON runtime validation을 분리합니다.

## 감점 포인트

- default를 무조건 `return ''`으로 처리하면 새 응답 종류가 조용히 누락될 수 있습니다.
- `never` 검사가 외부 JSON의 진위까지 보장한다고 설명하면 정적 계약과 runtime 검증을 혼동한 것입니다.
- discriminant를 일반 string으로 넓히면 member별 payload narrowing이 약해진다는 점을 놓치면 안 됩니다.

## 더 파고들 거리

- union에 `cancelled` member를 추가했을 때 어느 switch들이 의도적으로 깨지는지 compile test 목록을 만들어 보세요.
- runtime guard 통과 후에도 내부 object가 mutation될 수 있을 때 immutable copy와 exhaustive switch의 조합을 설계해 보세요.

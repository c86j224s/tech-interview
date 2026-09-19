---
id: typescript-structural-narrowing-runtime-validation
title: TypeScript 구조적 타입·Narrowing·런타임 검증
topic: 언어·런타임
summary: >-
  TypeScript의 구조적 호환과 control-flow narrowing이 컴파일 시 계약임을 설명하고, JSON 경계의 unknown
  검증과 excess property 검사의 범위를 추적합니다.
questionIds: []
prerequisites:
  - js-object-graph
  - js-value-conversion
related:
  - js-object-graph
  - js-value-conversion
reviewedAt: '2026-09-19'
---
# TypeScript 구조적 타입·Narrowing·런타임 검증

TypeScript는 객체의 이름보다 필요한 멤버 구조를 중심으로 호환성을 판단합니다. control-flow narrowing은 조건문을 따라 정적 타입을 줄여 주지만 JavaScript 실행 중 검사기를 만들지는 않습니다. 따라서 내부 값에는 구조적 타입과 discriminated union을 사용하되, JSON·HTTP·localStorage 경계에서는 `unknown`을 받아 실제 값을 검사해야 합니다.

## 구조적 호환

`Point`가 `x`와 `y`를 요구할 때 `Vector`라는 이름이 없어도 두 필드를 제공하면 대입할 수 있습니다.

```ts
type Point = { x: number; y: number };
const vector = { x: 1, y: 2, label: 'screen' };
const point: Point = vector; // OK
```

이는 Point로 사용할 때 필요한 멤버가 있다는 뜻이지 추가 필드가 없다는 뜻이 아닙니다. 클래스 이름이나 `implements` 선언은 이 구조적 대입의 필수 조건이 아닙니다. 정확한 schema, 권한, version compatibility를 자동 보장한다고 확대하면 안 됩니다.

## Control-flow narrowing

`typeof`, `in`, `instanceof`, 사용자 정의 type predicate, literal discriminant 비교는 현재 경로에서 가능한 타입을 줄이는 신호입니다.

```ts
type Result = { kind: 'ok'; value: number } | { kind: 'error'; message: string };
function text(r: Result) {
  if (r.kind === 'ok') return String(r.value);
  return r.message;
}
```

if 안에서는 `r`가 ok member로 좁혀지고 else에서는 error member가 남습니다. 이는 compiler의 정적 추론이지 객체가 불변이라는 runtime 보장은 아닙니다. alias로 객체를 바꾸거나 부정확한 predicate가 true를 반환하면 정적 믿음과 실제 값이 갈라집니다.

## Discriminated union

응답 종류를 literal field로 고정하면 payload와 case가 연결됩니다. `never` 검사는 union에 새 member가 추가됐을 때 누락된 switch를 compile error로 드러냅니다.

```ts
type Reply =
  | { kind: 'data'; rows: string[] }
  | { kind: 'retry'; afterMs: number }
  | { kind: 'fatal'; reason: string };
function assertNever(x: never): never { throw new Error(`unhandled: ${JSON.stringify(x)}`); }
function describe(r: Reply): string {
  switch (r.kind) {
    case 'data': return `${r.rows.length} rows`;
    case 'retry': return `retry in ${r.afterMs}`;
    case 'fatal': return r.reason;
    default: return assertNever(r);
  }
}
```

`fatal` case를 제거하면 default의 `r`가 never가 아니므로 오류입니다. 다만 `assertNever`가 실행되지 않는다는 기대는 내부에서 올바른 `Reply`를 생성한다는 전제에만 해당합니다. 외부 JSON을 단언한 값은 여전히 가짜 kind를 가질 수 있습니다.

## unknown과 타입 단언

`JSON.parse` 결과를 `as Reply`로 바꾸면 compiler에게만 약속하고 검사 코드는 추가하지 않습니다. 안전한 adapter는 `unknown`에서 object/null, discriminant, 각 payload 원시 타입을 확인한 뒤 type predicate로 좁힙니다.

```ts
function isReply(v: unknown): v is Reply {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (r.kind === 'data') return Array.isArray(r.rows) && r.rows.every(x => typeof x === 'string');
  if (r.kind === 'retry') return typeof r.afterMs === 'number' && Number.isFinite(r.afterMs);
  if (r.kind === 'fatal') return typeof r.reason === 'string';
  return false;
}
```

Type assertion은 산출 JavaScript에서 사라지고 runtime validation을 수행하지 않습니다. `satisfies`와 `as const`도 추론을 돕는 컴파일 기능일 뿐 외부 값을 검사하지 않습니다. 중첩 schema, 범위, 금지 필드 정책은 도메인 guard 또는 schema library가 별도로 책임져야 합니다.

## 검증 경계와 수명

HTTP adapter가 unknown을 받고 `isReply`를 통과한 값만 service에 넘기면 책임이 한 곳에 모입니다. 검증 직후 mutable object를 외부 alias가 바꿀 수 있다면 필요한 필드만 복사하거나 immutable DTO로 변환합니다. 반대로 내부 함수마다 같은 JSON guard를 반복하면 비용과 책임이 분산됩니다.

검증 통과는 영원한 불변식이 아니므로 배열 원소와 nested object의 mutation 정책도 정해야 합니다. 인증·권한과 타입 검사는 같은 일이 아니며, 구조적으로 맞는 payload라도 사용자가 권한을 가졌다는 뜻은 아닙니다.

## Excess property 검사

fresh object literal을 target에 직접 대입할 때 TypeScript는 오타 가능성을 줄이는 추가 검사를 적용합니다. 변수에 저장한 뒤 대입하면 필요한 필드를 갖는 구조적 호환성이 중심이 됩니다.

```ts
type User = { id: string };
const direct: User = { id: 'u1', nmae: 'typo' }; // excess property error
const raw = { id: 'u1', nmae: 'typo' };
const indirect: User = raw;                       // 구조상 허용
```

두 번째가 통과해도 raw에 오타가 없다는 뜻은 아닙니다. excess property check는 exact object type이나 runtime allow-list가 아닙니다. 함수 호출·spread·generic inference·union이 섞인 진단은 target compiler와 문맥을 고정해 재현해야 하며, 이를 근거로 보안 검증을 대체하면 안 됩니다.

## 중간 상태 추적

입력 `{kind:'data', rows:['a', 3]}`는 T0 `unknown`, T1 object/null 통과, T2 kind data branch, T3 `every`에서 숫자 3 발견, T4 predicate false입니다. 내부 `Reply` 함수에 들어가지 않고 boundary error가 됩니다. `{kind:'data', rows:['a']}`는 같은 경로에서 T3 통과 후 `Reply`로 좁혀지고, 이후 switch가 `data` case를 선택합니다.

이 숫자와 상태는 설명용 추적이며 실행 결과를 가장하지 않습니다. 실제 adapter에서는 malformed JSON parse error와 schema error를 서로 다른 관찰값으로 남기는 것이 좋습니다.

## 실패 조건과 검증 전략

`as Reply`만 사용하는 것이 첫 실패입니다. 배열 여부 없이 `typeof rows === 'object'`만 확인하는 것, `every`에서 원소 타입을 빠뜨리는 것, predicate가 항상 true를 반환하는 것, discriminant를 일반 string으로 넓히는 것도 같은 종류의 오류입니다.

정상 입력, null, 알 수 없는 kind, 배열 아닌 rows, 숫자 아닌 afterMs, NaN, 누락 필드, 추가 필드, 변조된 alias를 각각 테스트합니다. compile test는 누락 case와 excess property를 확인하고 runtime test는 실제 JSON과 변조된 객체를 확인해야 합니다.

## 비용과 선택

수동 guard는 의존성이 적지만 중첩 schema가 커질수록 누락 위험이 증가합니다. schema library를 써도 오류 형식, unknown field 정책, version migration, 검증 비용을 정해야 합니다. discriminated union은 상태 전이를 명확하게 하지만 case 추가 때 모든 exhaustive switch가 의도적으로 깨집니다.

구조적 타입의 장점은 mock과 adapter 교체가 쉽다는 점이고, 단점은 이름 기반 identity·권한을 표현하지 못한다는 점입니다. 외부 경계는 강하게 검증하고 내부는 좁은 불변 계약을 유지하는 것이 전체 비용을 제어합니다.

## 참고 자료

- [TypeScript Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) — control-flow, predicate, discriminated union, never. 확인일 2026-09-19.
- [TypeScript Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) — type assertion이 runtime check를 추가하지 않는다는 설명. 확인일 2026-09-19.
- [TypeScript Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) — object literal excess property check. 확인일 2026-09-19.
- [Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html) — structural compatibility. 확인일 2026-09-19.

```diagram
{"title":"외부 JSON에서 내부 union까지","caption":"unknown 값은 runtime guard를 통과한 뒤에만 내부 discriminated union으로 좁혀집니다.","rows":[[{"id":"json","label":"외부 JSON","detail":["실제 구조 불명"]}],[{"id":"unknown","label":"unknown","detail":["보수적 정적 타입"]}],[{"id":"guard","label":"런타임 guard","detail":["kind·payload 검사"]}],[{"id":"union","label":"내부 union","detail":["switch·never"]}]],"edges":[{"from":"json","to":"unknown","label":"파싱 결과"},{"from":"unknown","to":"guard","label":"명시적 검사"},{"from":"guard","to":"union","label":"predicate 통과"}]}
```

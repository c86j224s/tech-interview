---
id: ts-structural-excess-property
title: 같은 필드를 가진 객체인데 리터럴 대입만 excess property 오류가 나는 이유는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - TypeScript
  - 구조적 타입
  - excess-property
  - 언어·런타임
related:
  - js-prototype-lookup
  - js-equality-coercion
---
# 같은 필드를 가진 객체인데 리터럴 대입만 excess property 오류가 나는 이유는 무엇인가요?

## 구두 답변

TypeScript의 기본 대입은 구조적입니다. target이 `id: string`을 요구하면 source가 그 필드를 갖는 한 추가 필드가 있어도 사용할 수 있습니다. 다만 fresh object literal을 target에 직접 대입하는 위치에서는 오타 가능성을 줄이기 위한 excess property check가 추가됩니다.

```ts
type User = { id: string };
const direct: User = { id: 'u1', nmae: 'typo' }; // 오류
const raw = { id: 'u1', nmae: 'typo' };
const indirect: User = raw;                       // 구조상 허용
```

T0의 direct는 literal의 `nmae`가 User에 없는 이름이므로 ordinary context에서 compile-time error가 됩니다. T1의 raw는 먼저 자기 타입 `{id:string; nmae:string}`으로 추론됩니다. T2에 raw를 User로 대입할 때 compiler는 필요한 id를 찾고, 이미 변수에 담긴 값이라는 문맥에서는 excess check를 같은 방식으로 적용하지 않아 허용될 수 있습니다. 그렇다고 raw가 정확한 User이거나 nmae이 안전하다는 뜻은 아닙니다. excess property check는 exact object type도 runtime allow-list도 아닙니다.

함수 호출, spread, generic inference, union이 섞이면 “항상 오류”라는 설명을 확대하지 말고 target compiler·옵션·문맥을 고정해 재현해야 합니다. 외부 JSON의 추가 필드를 금지하거나 제거해야 한다면 runtime schema validator와 정규화가 필요합니다. `satisfies`는 literal의 정적 검사를 더 잘 보존할 수 있지만 runtime 검증을 추가하지 않습니다. 예를 들어 `const raw = JSON.parse(text) as User`는 오타 필드를 제거하지 않고, 변수 우회도 네트워크 입력의 안전성을 높이지 않습니다. API adapter에서 허용 키를 실제로 reject하거나 strip해야 한다면 compiler 진단과 별도의 schema 정책을 실행해야 합니다.

## 득점 포인트

- 구조적 대입과 fresh literal의 추가 검사를 분리하고 direct 예제의 오류를 “가능성”이 아니라 일반 문맥의 compile-time error로 설명합니다.
- raw를 변수에 담은 뒤 필요한 id만 검사되는 상태를 T0~T2로 추적합니다.
- excess check가 exact type·보안 allow-list가 아니므로 runtime validation이 별도라는 결론을 냅니다.

## 감점 포인트

- TypeScript 객체 타입은 추가 필드를 모두 금지한다고 말하면 구조적 타입의 기본을 거꾸로 설명한 것입니다.
- `nmae` direct 진단을 단순히 “오류 가능”이라고 약화하면 질문의 ordinary 문맥을 흐립니다.
- 변수로 감싸면 runtime에서 필드가 제거되거나 검증된다고 말하면 컴파일 검사와 실행 동작을 혼동한 것입니다.

## 더 파고들 거리

- `satisfies User`와 `as User`가 literal의 추론 타입과 오류 보고에서 어떻게 다른지 비교해 보세요.
- API 경계에서 unknown field를 reject·strip·preserve 중 무엇으로 정할지, backward compatibility와 함께 계약해 보세요.

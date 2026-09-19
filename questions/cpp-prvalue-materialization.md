---
id: cpp-prvalue-materialization
title: prvalue에 참조를 바인딩할 때 temporary materialization과 수명 연장은 어떤 관계인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - temporary materialization
  - 참조 수명
related:
  - cpp-move-semantics
---
# prvalue에 참조를 바인딩할 때 temporary materialization과 수명 연장은 어떤 관계인가요?

## 구두 답변

prvalue는 곧바로 특정 객체를 가리키는 참조가 아니라 값 계산입니다. 참조 바인딩처럼 실제 객체가 필요한 문맥에 들어가면 temporary materialization conversion이 일어나 prvalue의 결과가 객체로 만들어지고, 참조가 그 객체에 연결됩니다. `const T& ref = T{};`에서는 `T{}`가 materialize된 뒤 지역 참조에 바인딩되므로 이 문맥의 임시 객체 수명이 `ref`의 수명까지 연장됩니다.

하지만 수명 연장은 참조가 붙는 모든 경우의 일반 법칙이 아닙니다. 함수 내부 임시를 참조로 반환하면 함수 종료 시 임시가 소멸합니다.

```cpp
const T& bad() { return T{}; }
const T& r = bad(); // r은 이미 소멸한 객체를 가리키는 dangling reference
```

호출자에서 새 참조를 선언해도 종료된 객체를 되살릴 수 없습니다. `r`을 역참조하면 정의되지 않은 동작이므로, 예제는 그 값을 실제로 읽지 않고 반환 직후 dangling 상태만 설명해야 합니다. `new` 초기화, 참조 멤버 저장, 함수 매개변수 전달은 각각 lifetime-extension 규칙이 다르므로 문맥을 고정해야 합니다.

값 반환 `T x = make();`은 C++17 prvalue의 목적지 직접 구성이고, `const T& x = make();`는 호출자 바인딩에 따른 materialization과 수명 연장을 따로 분석합니다. materialization은 소유권 이전이 아니라 객체가 생겼다는 뜻이며, 참조는 소유자가 아닙니다.

## 득점 포인트

- prvalue의 값 계산과 참조 바인딩 시 발생하는 temporary materialization을 실제 객체 생성 단계로 구분합니다.
- 지역 참조 초기화와 함수의 참조 반환을 대비해, 호출자 쪽 새 참조가 이미 소멸한 임시의 수명을 연장하지 못한다는 경계를 제시합니다.

## 감점 포인트

- 모든 rvalue 참조 또는 const 참조가 자동으로 임시의 수명을 연장한다고 말하면 안 됩니다.
- dangling reference 예제에서 정의되지 않은 값을 읽은 실행 결과를 정상적인 측정처럼 제시하면 안 됩니다.

## 더 파고들 거리

- 지역 변수 초기화, `new` 초기화, 참조 멤버 초기화에서 같은 prvalue의 수명 결과가 왜 달라지는지 표로 비교해 보세요.
- `T x = make()`와 `const T& x = make()`의 객체 형성과 파괴 시점을 생성자·소멸자 로그로 관찰하되, 로그가 표준 보장을 증명하지 않는다는 한계를 함께 기록하세요.

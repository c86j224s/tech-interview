---
id: cpp-concept-diagnostic-boundary
title: 템플릿 본문 오류를 concept으로 옮기면 호출자의 진단이 어떻게 달라지나요?
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - concepts
  - diagnostics
  - substitution
related:
  - cpp-move-semantics
---
# 템플릿 본문 오류를 concept으로 옮기면 호출자의 진단이 어떻게 달라지나요?

## 구두 답변

본문에서 `data()`를 호출하다 실패하면 이미 그 template candidate가 선택된 뒤의 instantiation error가 됩니다. 선언부 constraint로 조건을 옮기면 해당 후보가 먼저 viable set에서 빠지고, **다른 viable overload가 있을 때 그 후보를 선택할 기회가 생깁니다.** 다른 후보가 없다면 자동으로 성공하는 것이 아니라 no matching function으로 거절됩니다.

```cpp
template<class T>
auto bytes(T const& x) { return x.data(); }

template<class T>
requires requires(T const& x) { x.data(); }
auto bytes2(T const& x) { return x.data(); }
void bytes2(...);
```

`bytes(7)`은 본문 instantiation 오류가 될 수 있지만, `bytes2(7)`에서는 constrained overload가 제거되고 ellipsis가 선택됩니다. requires가 모든 오류를 숨기지는 않습니다. 비의존 이름과 문법 오류는 정의 시점에 거절될 수 있고, constraint 자체의 normalization parameter mapping 문제는 좁은 IFNDR 경계가 됩니다. 또한 `data()`가 존재해도 body가 기대하는 lifetime이나 semantic 조건은 남으므로 concept이 실제 의미 불변식을 자동 검증하지 않습니다.

예를 들어 bytes2(7)의 선언부 검사에서는 `int`에 data가 없으므로 제약이 false가 됩니다. 이후 ellipsis 후보가 남아 해당 호출이 선택되지만, 예제는 선언만 있으므로 실제 실행하려면 그 함수 정의도 있어야 합니다. 반면 data가 존재하는 타입이어도 선택된 함수 본문이 반환값에 잘못된 연산을 한다면 instantiation 오류가 남습니다. 저는 지원하지 않는 입력의 컴파일 거절, 대체 overload 선택, 본문 내부의 결함을 각각 다른 테스트로 나누겠습니다.

## 득점 포인트

- body instantiation error와 declaration constraint의 후보 제거 시점을 비교합니다.
- 대체 overload의 존재 여부에 따라 선택 또는 no matching으로 갈라짐을 말합니다.
- 비의존 오류, semantic 조건, compiler별 진단 문구를 별도 경계로 둡니다.

## 감점 포인트

- requires로 감싸면 템플릿 내부 모든 오류가 SFINAE가 된다고 설명합니다.
- 제한된 후보가 없으면 컴파일러가 적당한 함수를 자동으로 만든다고 말합니다.
- concept이 `data()`의 수명·범위·의미까지 자동으로 보장한다고 가정합니다.

## 더 파고들 거리

- 단계별 concept이 진단을 개선하는 경우와 normalization을 복잡하게 만드는 경우는 언제인가요?
- 후보 제거와 `static_assert`를 API 오류 표현으로 선택할 때 사용자 경험은 어떻게 달라지나요?

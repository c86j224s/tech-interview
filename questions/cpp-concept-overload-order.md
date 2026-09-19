---
id: cpp-concept-overload-order
title: 두 constrained overload가 모두 조건을 만족합니다. constraints subsumption은 어떤 후보를 선택하나요?
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - concepts
  - overload-resolution
  - subsumption
related:
  - cpp-move-semantics
---
# 두 constrained overload가 모두 조건을 만족합니다. constraints subsumption은 어떤 후보를 선택하나요?

## 구두 답변

두 requires가 모두 true라고 해서 텍스트가 긴 overload나 사람이 더 구체적이라고 느끼는 overload가 자동 선택되지는 않습니다. C++20은 constraint를 정규화하고 atomic constraint의 동일성과 parameter mapping으로 subsumption을 판단합니다. 공통 조건을 같은 concept-id로 재사용해 더 강한 concept을 만들면 부분순서를 표현할 수 있지만, 뜻이 같은 requires 표현식을 두 곳에 복사하면 원자 identity가 자동으로 공유되지 않아 모호할 수 있습니다.

```cpp
template<class T> concept HasSize = requires(T const& x) { x.size(); };
template<class T> concept HasCapacity = HasSize<T> &&
  requires(T const& x) { x.capacity(); };
template<HasSize T> void inspect(T const&);
template<HasCapacity T> void inspect(T const&);
```

`size()`와 `capacity()`가 모두 있는 타입은 `HasCapacity` 후보가 `HasSize` 후보를 subsume하는 구조를 갖습니다. 반대로 A와 B에 같은 `x.size()` 문장을 복사하면 논리적으로 같아 보여도 같은 source-level atomic constraint라는 연결이 없습니다. subsumption은 임의의 논리 함의 정리가 아닙니다. 모호성이 남으면 명시적 tag나 함수 이름으로 선택을 드러내는 편이 낫습니다.

## 득점 포인트

- viable 여부와 viable 후보 사이의 partial ordering을 별도 단계로 설명합니다.
- named concept 공유가 atomic identity와 subsumption을 만드는 이유를 코드로 보여 줍니다.
- 논리적으로 함의해 보여도 복제된 표현식은 자동으로 같은 원자가 아니라고 말합니다.

## 감점 포인트

- requires 절이 긴 함수가 항상 선택된다고 말합니다.
- 의미상 함의만으로 compiler가 arbitrary theorem proving을 한다고 설명합니다.
- 같은 텍스트를 복사하면 반드시 atomic constraint가 같다고 단정합니다.

## 더 파고들 거리

- concept-id와 직접 conjunction의 normalization 차이를 compiler의 후보 진단에서 어떻게 확인하나요?
- constrained template과 비템플릿 overload가 함께 있을 때 constraint ordering은 변환 순위와 어떻게 결합하나요?

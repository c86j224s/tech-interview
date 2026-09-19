---
id: cpp-span-static-extent
title: 고정 extent와 동적 extent의 span을 선택할 때 크기 검사의 시점과 비용은 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - span
  - extent
  - API-design
related:
  - cpp-object-lifetime-aliasing
  - cpp-coroutine-frame-lifetime
---
# 고정 extent와 동적 extent의 span을 선택할 때 크기 검사의 시점과 비용은 무엇인가요?

## 구두 답변

`span<T, N>`의 extent는 타입에 들어가고 `span<T>`는 `dynamic_extent`와 runtime size를 사용합니다. 고정 header라면 `span<const byte, 4>`가 API의 불변식을 드러내지만, static extent mismatch가 언제 거절되는지는 source가 중요합니다. C 배열·`std::array`·static span처럼 크기가 타입에 있는 source는 변환 단계에서 compile-time constraint로 거절할 수 있습니다. 반면 dynamic span이나 일반 range를 `span<T, 4>`로 만들 때 `source.size() == 4`는 runtime precondition이며, 자동 예외나 runtime 검사로 바뀐다고 일반화할 수 없습니다. C++26 hardened contract wording은 표준 모드별로 따로 확인해야 합니다.

```cpp
void header(std::span<const std::byte, 4>);
std::array<std::byte, 4> a{};
header(a); // source type에 4가 있음
std::span<const std::byte> d = /* size가 runtime */;
// static span 변환 시 d.size()==4는 runtime 전제
```

dynamic extent는 길이가 다양한 packet body에 적합하고 static extent는 header의 의미를 타입에 담습니다. static이 항상 빠르거나 dynamic이 반드시 추가 할당을 하는 것은 아닙니다. pointer·size 저장, ABI, 인라이닝, 최적화 여부를 같은 compiler 설정에서 측정해야 합니다. 어느 쪽도 backing storage의 lifetime이나 주소 안정성을 고정하지 않으므로 vector 재할당과 endian·값 범위 검사는 별도입니다.

## 득점 포인트

- static source의 compile-time constraint와 dynamic/general source의 runtime precondition을 구분합니다.
- 고정 header와 가변 body의 API 선택을 실제 타입으로 보여 줍니다.
- extent, storage lifetime, 내용 검증, 최적화 비용을 서로 독립적인 계약으로 설명합니다.

## 감점 포인트

- static extent가 모든 source mismatch를 compile-time에 자동 거절한다고 말합니다.
- dynamic extent가 항상 allocation을 추가하거나 static이 항상 zero-cost라고 단정합니다.
- extent만으로 lifetime·endian·최대 길이가 검증된다고 설명합니다.

## 더 파고들 거리

- static span 생성에서 배열·dynamic span·일반 range가 각각 어떤 overload 조건을 통과하나요?
- 고정 prefix와 가변 payload를 parser의 extent와 남은 범위로 어떻게 모델링할까요?

---
id: cpp-concept-requires-expression
title: requires 표현식이 컴파일되면 연산의 의미나 복잡도도 보장되나요?
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - concepts
  - requires
  - semantic-requirement
related:
  - cpp-move-semantics
---
# requires 표현식이 컴파일되면 연산의 의미나 복잡도도 보장되나요?

## 구두 답변

보장 범위는 작성한 형식 조건까지입니다. 다음 concept은 `size()`가 존재하고 반환값이 `size_t`로 변환 가능한지만 검사합니다.

```cpp
template<class T>
concept Sized = requires(T const& x) {
  { x.size() } -> std::convertible_to<std::size_t>;
};
```

이 조건을 만족해도 사용자 타입이 `size()` 안에서 매번 선형 순회를 할 수 있으므로 O(1)이 자동 증명되지 않습니다. compound requirement에 `noexcept`를 붙이면 예외 명세 조건을 추가할 수 있지만, thread safety, 반환 참조의 수명, 호출 결과의 논리적 의미는 별도 계약입니다. 표준 concept의 semantic requirement도 컴파일러가 자연어 조건을 실행해 증명하는 것은 아닙니다. 따라서 `HasSize`는 형식 조건으로 이름을 좁히고, 알고리즘이 constant-time을 필요로 하면 문서·구현 불변식·프로파일링을 별도로 둡니다.

예를 들어 `Fast`는 저장한 원소 수를 반환하고 `Slow`는 연결 리스트 전체를 세어 반환한다고 하겠습니다. 두 타입 모두 위 Sized를 만족하지만 백만 번의 호출 비용은 전혀 다릅니다. 호출 결과가 음수가 되지 않는지, 컨테이너 변경 후 정확한 수를 반환하는지 역시 `convertible_to`만으로 확인할 수 없습니다. 따라서 요구사항을 형식·의미·복잡도로 나누고, 이름이 `ConstantTimeSize`라고 해서 마지막 항목까지 컴파일러가 증명한다고 설명하지 않겠습니다.

또한 `{ x.size() } noexcept -> std::convertible_to<std::size_t>;`처럼 compound requirement에 `noexcept`를 써야 비투척 조건을 실제 제약으로 검사합니다. requires 블록에 `noexcept(x.size());`를 단순 표현식으로 넣으면 그 표현식을 쓸 수 있는지만 검사할 수 있어 의미가 다릅니다. 이 차이는 throwing/noexcept 메서드 두 개로 컴파일 행렬을 만들면 드러납니다. concept은 좋은 진단과 후보 선택 경계를 제공하지만 업무 불변식·시간 상한·다른 스레드와의 경쟁은 여전히 구현과 테스트의 책임입니다.

## 득점 포인트

- syntactic/type satisfaction과 semantic requirement를 나눕니다.
- O(1), `noexcept`, thread safety, lifetime을 각각 어떤 추가 조건으로 확인할지 말합니다.
- concept의 이름이 약속하는 범위를 좁히고 실행 검증을 분리합니다.

## 감점 포인트

- requires가 성공하면 알고리즘 복잡도가 고정된다고 단정합니다.
- 반환 형식 검사를 thread-safe 또는 예외 없음의 증거로 사용합니다.
- benchmark 한 번을 언어 차원의 semantic 보장으로 바꿔 말합니다.

## 더 파고들 거리

- `noexcept`를 concept에 넣어야 하는 API와 넣으면 지나치게 강해지는 API를 어떻게 구분하나요?
- ranges concept의 semantic requirement를 사용자 정의 concept 문서와 테스트로 어떻게 연결하나요?

---
id: cpp-concepts-constraints-diagnostics
title: C++ Concepts·제약·진단
topic: 언어·런타임
summary: >-
  C++20 constraints와 requires 표현식의 후보 제거, atomic constraint 정규화, short-circuit와
  의미적 요구사항의 경계를 실제 호출로 추적합니다.
questionIds: []
prerequisites:
  - cpp-move
related:
  - cpp-move
reviewedAt: '2026-09-19'
---
# C++ Concepts·제약·진단

C++20 constraint는 템플릿 본문을 미리 실행하는 장치가 아닙니다. `requires` 표현식은 substitution 후 특정 표현식이 형식상 유효한지를 검사하고, requires-clause는 그 결과를 후보 선택의 associated constraints로 사용합니다. 조건이 false이면 해당 후보를 제거할 수 있지만, 성공이 O(1), thread-safe, 예외 없음 같은 실행 의미를 증명하지는 않습니다. overload 순서는 긴 텍스트나 사람의 논리적 함의가 아니라 정규화된 atomic constraint와 subsumption 구조로 결정됩니다.

## 후보 집합과 제약 단계

```cpp
template<class T>
requires requires(T const& x) { x.size(); }
int measure(T const& x) { return static_cast<int>(x.size()); }

template<class T>
requires requires(T const& x) { x.begin(); x.end(); }
long measure(T const& x) { return x.end() - x.begin(); }
```

`std::vector<int>`는 두 후보의 요구식을 모두 만족할 수 있습니다. 그렇다고 둘째가 자동으로 더 구체적이라고 판단되지는 않습니다. 둘의 atomic 구조가 subsumption 관계를 만들지 않으면 호출은 모호합니다. 순서는 “조건 만족 여부”와 “만족한 후보 사이의 부분순서”를 나누어 읽어야 합니다.

## Requires 표현식과 의미

```cpp
template<class T>
concept Sized = requires(T const& x) {
    { x.size() } -> std::convertible_to<std::size_t>;
};
```

`Sized<T>`가 true인 것은 `size()`가 존재하고 반환값이 요구한 변환을 제공한다는 뜻입니다. `size()`가 내부에서 매번 선형 순회하는지, 호출마다 같은 값을 주는지, 예외를 던지지 않는지는 concept에 쓰지 않았다면 보장되지 않습니다. `{ x.size() } noexcept;`처럼 compound requirement에 붙인 `noexcept`는 비투척을 요구하지만 thread safety와 반환 참조 수명은 별도 계약입니다. 표준 concept의 semantic requirement도 자연어 요구사항까지 컴파일러가 실행해 증명하는 것은 아닙니다.

복잡도는 별도 문서와 측정으로 검증합니다. `HasSize`라는 이름은 존재와 형식만 약속하고, 알고리즘이 O(1)을 필요로 한다면 표준 concept, 구현 불변식, 테스트 또는 프로파일링을 추가합니다. benchmark 한 번으로 언어 보장을 만들 수 없습니다.

## 선언부와 본문 진단

```cpp
template<class T>
auto bytes_bad(T const& x) { return x.data(); }

template<class T>
requires requires(T const& x) { x.data(); }
auto bytes_good(T const& x) { return x.data(); }

void bytes_good(...);
```

`bytes_bad(7)`은 후보가 선택된 후 본문을 instantiate하다가 `data()` 오류가 됩니다. `bytes_good(7)`은 constrained candidate가 viable set에서 빠지고, 위의 ellipsis overload가 남으면 그 후보가 호출됩니다. constrained declaration만 있고 대체 overload가 없다면 “다른 함수를 선택”하는 것이 아니라 no matching function으로 거절됩니다. 이것이 진단 경계를 정확히 말하는 방법입니다.

비의존적인 이름 오류나 문법 오류는 constraint가 보호하지 않습니다. dependent requirement의 실패는 false와 후보 제거로 처리될 수 있지만, normalization 중 parameter mapping substitution이 invalid인 특정 경우에는 IFNDR이 될 수 있습니다. 이를 일반적인 잘못된 requires 표현식 전체의 운명으로 확대하면 안 됩니다.

## 정규화와 Subsumption

```cpp
template<class T> concept HasSize = requires(T const& x) { x.size(); };
template<class T> concept HasCapacity =
    HasSize<T> && requires(T const& x) { x.capacity(); };

template<HasSize T> void inspect(T const&);
template<HasCapacity T> void inspect(T const&);
```

`HasCapacity`는 같은 `HasSize<T>` concept-id를 포함하므로 더 제한된 후보라는 atomic 구조를 표현합니다. `size()` 요구식을 A와 B에 각각 복사한 경우, 뜻이 같다는 이유만으로 원자가 동일해지지 않습니다. subsumption은 임의의 명제 논리 함의 정리가 아닙니다. 공통 조건은 이름 있는 concept으로 공유하고, 더 강한 조건은 그 concept을 조합해야 합니다.

검토 순서는 (1) 두 후보가 모두 viable인지, (2) 공통 atomic constraint가 같은 source expression과 parameter mapping에서 유래하는지, (3) 어느 쪽이 다른 쪽을 subsume하는지, (4) 그래도 남는 변환 순위가 있는지입니다. 도메인 조건이 너무 복잡해 partial ordering이 불분명하면 tag type이나 별도 함수 이름이 더 읽기 쉽습니다.

## Short-circuit 경계

```cpp
template<class T>
concept HasValueTypeAndSize =
  requires { typename T::value_type; } &&
  requires(T const& x) { x.size(); };
```

`T=int`이면 왼쪽 type requirement가 false이므로 오른쪽 dependent requirement를 평가하지 않는 경로가 열립니다. 반대로 이것은 파서 오류와 비의존 오류를 숨기는 장치가 아닙니다. 존재하지 않는 이름을 비의존적으로 적었거나 괄호가 맞지 않으면 constraint short-circuit 전에 프로그램이 잘못됩니다. `||`도 한 분기가 true이면 뒤 분기를 검사하지 않을 수 있지만, 두 API 경로의 반환 타입과 의미가 실제로 같은 계약인지 별도로 설계해야 합니다.

단계별 concept을 만들면 실패 지점이 드러납니다. `HasValueType`, `HasSize`, `SizedRange`를 차례로 정의하고 각 이름이 보장하는 것을 문서화합니다. 한 줄에 모든 조건을 넣으면 컴파일러가 후보를 제거해도 호출자의 진단이 복잡해질 수 있습니다.

## 검증 행렬

|입력 타입|첫 단계|후속 단계|예상 후보 상태|
|---|---|---|---|
|`int`|`value_type` false|검사하지 않음|제약 후보 제거|
|`value_type`만 제공|true|`size` false|제약 후보 제거|
|둘 다 제공|true|true|viable, 추가 순서 평가|
|둘 다 제공하지만 size가 선형|true|true|컴파일 통과, 복잡도는 별도 문제|

이 표의 후보 변화는 표준 구조 설명입니다. 특정 compiler의 진단 문구는 버전에 따라 다릅니다. 실제 프로젝트에서는 지원하지 않는 타입과 semantic requirement를 어기는 타입을 모두 넣어 concept의 이름이 약속하는 범위가 충분한지 확인합니다.

## 비용과 실패

constraint 평가는 컴파일 시간과 진단 출력량을 늘릴 수 있고, 깊은 concept 조합은 normalization 비용과 오류 메시지 길이를 키울 수 있습니다. 그러나 잘못된 후보를 body까지 인스턴스화하지 않는 이점이 있어 라이브러리 경계에서는 유지보수 비용을 줄입니다. 런타임 호출 비용은 requires가 존재한다는 사실만으로 결정되지 않습니다. 인라이닝, ABI, body 구현을 별도로 측정해야 합니다.

실패는 세 종류로 나눕니다. 표현식이 dependent context에서 무효라 후보가 제거되는 경우, body가 선택된 뒤 hard error가 나는 경우, semantic 계약을 어겨 컴파일은 되지만 알고리즘이 잘못되는 경우입니다. IFNDR은 이 중 “일반적인 requires 실패”라는 분류가 아니라 normalization parameter mapping의 좁은 표준 경계로 기록해야 합니다.

## 설계 선택

API가 `data()`와 `size()`를 요구한다면 declaration에 최소 문법 조건을 넣고, 반환된 포인터의 범위와 수명은 별도 concept 또는 문서 계약으로 명시합니다. O(1) 같은 속성이 실제로 필수이면 이름만 `ConstantTime`으로 바꾸지 말고 검증 방법을 함께 제공합니다. overload가 모호해졌을 때 조건을 길게 복사하는 대신 공통 concept을 추출하고, partial ordering이 사용자에게 중요하지 않다면 함수 이름을 분리합니다.

```diagram
{"title":"제약에서 본문까지의 경계","caption":"dependent constraint failure는 후보 제거가 될 수 있지만 semantic requirement와 normalization의 좁은 IFNDR 경계는 별도로 설명해야 합니다.","rows":[[{"id":"call","label":"호출 · 타입 추론"}],[{"id":"norm","label":"constraint 정규화","detail":["atomic 구조"]}],[{"id":"reject","label":"후보 제거","detail":["요구식 false"]},{"id":"keep","label":"viable 후보","detail":["요구식 true"]}],[{"id":"order","label":"subsumption · overload"}],[{"id":"body","label":"본문 인스턴스화"}]],"edges":[{"from":"call","to":"norm","label":"associated constraints"},{"from":"norm","to":"reject","label":"dependent failure"},{"from":"norm","to":"keep","label":"satisfaction"},{"from":"keep","to":"order","label":"atomic identity"},{"from":"order","to":"body","label":"선택 후보만 생성"}]}
```

## 참고자료와 적용 범위

- https://en.cppreference.com/w/cpp/language/constraints — C++20 requires, normalization, atomic constraint identity, subsumption, short-circuit를 확인했습니다. 이 페이지가 상세 근거입니다.
- https://en.cppreference.com/w/cpp/language/templates.html — requires-clause와 템플릿 후보 관계의 보조 근거입니다. normalization 세부를 이 페이지 하나로 주장하지 않습니다.
- C++ 표준 모드와 compiler 버전에 따라 진단 문구와 구현 비용은 달라집니다. 이 배치에서는 개념 예시를 Apple Clang으로 일부 확인했지만, 특정 메시지나 최적화 결과를 표준 보장으로 제시하지 않습니다.

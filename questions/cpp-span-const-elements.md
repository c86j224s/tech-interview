---
id: cpp-span-const-elements
title: 'const std::span<int>와 std::span<const int>는 원소 수정에서 무엇이 다른가요?'
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - span
  - const
  - view
related:
  - cpp-object-lifetime-aliasing
  - cpp-coroutine-frame-lifetime
---
# const std::span<int>와 std::span<const int>는 원소 수정에서 무엇이 다른가요?

## 구두 답변

const의 위치가 다릅니다. `const std::span<int>`는 span 객체를 다른 범위로 대입하지 못하게 하지만 원소 타입은 `int`이므로 `fixed[0] = 9`가 가능합니다. `std::span<const int>`는 view 객체 자체는 재지정할 수 있어도 `operator[]`가 `const int&`를 반환하므로 원소 수정이 막힙니다. `const std::span<const int>`는 두 층을 모두 제한합니다. 이는 `int* const`와 `const int*`의 차이입니다. 원소 const는 원본의 lifetime, vector 재할당, 다른 alias의 동시 쓰기까지 해결하지 않습니다.

```cpp
int a[] = {1, 2};
const std::span<int> fixed(a);
std::span<const int> read_only(a);
fixed[0] = 9;       // 허용
// read_only[0] = 8; // 컴파일 거절
```

위 코드 뒤 a의 내용은 `[9,2]`이고 read_only[0]으로 읽어도 9가 보입니다. 읽기 전용 view가 원본을 복사하거나 snapshot으로 고정한 것이 아니기 때문입니다. 다른 함수가 a[0]을 10으로 바꾸면 같은 read_only는 10을 읽습니다. 데이터가 바뀌지 않아야 하는 계약이라면 span의 const만으로 부족하고 소유자의 변경을 제한하거나 별도 복사를 해야 합니다.

시그니처에서는 `process(std::span<const int>)`가 그 경로를 통한 원소 수정을 금지하는 읽기 API를 나타냅니다. `process(const std::span<int>)`의 top-level const는 함수 안에서 매개변수 view를 재지정하지 않는다는 뜻일 뿐 호출자의 원소 보호가 아닙니다. 함수 값 매개변수의 top-level const만 다르게 적어 별도 overload를 만들 수도 없습니다. 원본을 다른 스레드가 동시에 쓴다면 어느 const 형태든 데이터 경쟁을 막지 않으므로 잠금·불변 소유권 등 동기화 계약을 따로 적용하겠습니다.

## 득점 포인트

- view const와 element const를 선언과 대입 예제로 구분합니다.
- 읽기 전용 API 매개변수에 `span<const T>`를 쓰는 이유를 설명합니다.
- lifetime과 synchronization이 const와 독립이라는 점을 실제 vector 사례로 말합니다.

## 감점 포인트

- `const span<int>`이면 원소도 자동 const가 된다고 말합니다.
- `span<const int>`가 원본 배열 자체를 immutable로 만든다고 설명합니다.
- const view가 재할당이나 data race를 막는다고 가정합니다.

## 더 파고들 거리

- 값으로 받는 span 매개변수에서 객체 const를 붙이는 것이 호출자에게 어떤 의미를 주나요?
- 읽기 전용 접근과 실제 immutable storage를 구분해야 하는 사례는 무엇인가요?

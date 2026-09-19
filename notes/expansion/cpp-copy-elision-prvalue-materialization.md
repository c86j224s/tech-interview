---
id: cpp-copy-elision-prvalue-materialization
title: C++ Copy Elision과 Prvalue Materialization
topic: 언어·런타임
summary: >-
  C++17의 prvalue 직접 구성, 선택적인 NRVO, temporary materialization과 수명 연장의 경계를 코드 흐름으로
  추적합니다.
questionIds: []
prerequisites:
  - cpp-move
related:
  - cpp-move
reviewedAt: '2026-09-19'
---
# C++ Copy Elision과 Prvalue Materialization

C++의 복사 생략을 “복사 생성자를 호출하지 않도록 최적화한 것”으로만 설명하면 C++17의 핵심 경계를 놓칩니다. `return T{};` 같은 순수 prvalue 반환은 중간 임시를 만들고 다시 옮기는 실행 모델을 전제로 하지 않습니다. 반대로 이름이 있는 지역 객체의 반환은 NRVO라는 선택적 생략이며, 참조가 객체를 요구하는 순간에는 별도의 temporary materialization이 일어납니다. 이 글은 세 경로를 같은 “elision”이라는 말로 섞지 않고, 객체가 언제 생기고 어떤 생성자와 소멸자가 형식적으로 필요한지 추적합니다.

## 문제 지형

C++11식 설명에서는 `T make() { return T{}; }`를 “임시 `T` 생성 → 반환 객체로 이동”이라고 그린 뒤 컴파일러가 두 생성자를 생략한다고 말하기 쉽습니다. C++17의 prvalue 모델에서는 이 설명이 부정확합니다. `T{}`는 특정 객체를 가리키는 glvalue가 아니라 값 계산이고, `T value = make();`가 요구하는 최종 객체가 있을 때 그 목적지에서 `T`가 직접 구성되는 경로가 언어에 들어왔습니다. 따라서 이동 생성자가 삭제된 타입도 이 경로에서는 통과할 수 있습니다.

다만 이것은 모든 임시 객체가 사라진다는 뜻이 아닙니다. `const T& r = T{};`처럼 참조가 객체를 필요로 하는 문맥에서는 prvalue를 materialize하여 실제 객체를 만든 다음 참조를 연결합니다. 그 객체의 수명은 참조 바인딩 문맥에 따라 연장될 수도 있고, 함수 반환이나 `new` 초기화 같은 문맥에서는 연장되지 않을 수도 있습니다. 먼저 표현식의 값 범주와 목적지를 고정해야 합니다.

## 값 범주와 목적지

### 직접 초기화 경로

```cpp
struct Token {
    Token() = default;
    Token(const Token&) = delete;
    Token(Token&&) = delete;
    ~Token() = default;
};

Token make() { return Token{}; }
Token value = make();
```

C++17에서 `Token{}`의 prvalue는 반환 객체와 `value`의 초기화 경로를 따라 최종 목적지에 직접 구성됩니다. “이동 생성자 호출이 실행되었지만 최적화로 관찰되지 않았다”가 아니라, 해당 경로에 이동 생성자 호출을 요구하는 중간 객체가 없는 것이 핵심입니다. `Token()`은 호출 가능해야 하고 `~Token()`은 결과 객체를 파괴할 수 있도록 접근 가능해야 합니다. 생성자와 소멸자를 전부 없애도 된다는 결론은 아닙니다.

반면 `Token local; return local;`에서는 `local`이 이미 함수 프레임 안에서 생성되어 있습니다. 컴파일러가 반환 객체와 같은 객체로 합치면 NRVO이고, 합치지 않으면 반환용 복사나 암시적 이동 후보가 남습니다. 복사·이동 생성자를 모두 삭제한 타입에서는 NRVO에 의존하는 코드를 이식 가능한 보장으로 사용할 수 없습니다.

## NRVO 선택성

NRVO는 이름 있는 자동 저장 기간의 비휘발성 지역 객체를 반환하는 특정 형태에서 고려됩니다. 다음 세 표현식은 겉보기에는 모두 “T 반환”이지만 언어 계약이 다릅니다.

| 반환식 | 반환 시점의 상태 | 생략 성격 | 생성자 요구 |
| --- | --- | --- | --- |
| `return T{};` | 아직 특정 객체가 아닌 prvalue 값 계산 | C++17 목적지 직접 구성 | 선택한 생성자와 접근 가능한 소멸자 |
| `return local;` | 함수 안에 `local` 객체가 이미 존재 | 선택적 NRVO | 생략되지 않을 때 복사/암시적 이동 |
| `return std::move(local);` | `local`을 xvalue로 변환 | NRVO 후보에서 벗어남 | 이동 생성자 경로 |

`if (ok) return first; return second;`처럼 서로 다른 지역을 반환하면 어느 하나에만 의존하는 설계가 더 취약해집니다. 컴파일러가 특정 빌드에서 모두 생략해도 표준 보장이 아닐 수 있습니다. `-fno-elide-constructors`는 생략된 경로를 관찰하기 위한 실험 옵션이지, 표준이 보장한 직접 구성까지 취소하여 언어 의미를 바꾸는 만능 판정기가 아닙니다.

## Materialization 과정

C++17의 temporary materialization conversion은 prvalue의 결과를 객체로 만들어야 하는 문맥에서 발생합니다. 다음 두 문장을 대비하면 중간 상태가 보입니다.

```cpp
Token make();
Token x = make();          // 반환 prvalue가 x의 목적지를 직접 초기화
const Token& r = Token{};  // 참조 바인딩을 위해 Token{} 결과가 materialize
```

첫째 문장은 값 반환과 목적지 초기화의 관계를 분석하는 문제입니다. 둘째 문장은 `Token` 객체가 실제로 있어야 하므로 임시 객체가 생기고, 지역 참조 초기화라는 문맥에서는 `r`의 수명까지 연장됩니다. 참조는 소유권을 넘겨받는 핸들이 아니며, 수명 연장은 “rvalue이면 항상 안전하다”는 규칙도 아닙니다.

```cpp
const Token& bad() {
    return Token{};
}
```

`bad`가 반환하는 참조는 함수 반환 시점에 임시가 소멸하므로 dangling reference가 됩니다. 호출자가 `const Token& again = bad();`이라고 새 참조를 선언해도 이미 끝난 수명을 되살리지 못합니다. 실제로 `again`을 역참조하면 정의되지 않은 동작이므로, 검증용 예제에서는 그 값을 읽지 않고 “반환 직후 dangling 상태”만 기록해야 합니다. 반대로 `const Token& safe = make();`처럼 호출자에서 값 반환 결과에 직접 참조를 바인딩하는 문맥은 별도로 수명 연장 규칙을 분석합니다.

## 소멸자와 형식 검사

보장된 복사 생략에서도 소멸자의 접근 가능성은 사라지지 않습니다.

```cpp
struct Hidden {
    Hidden() = default;
    Hidden(const Hidden&) = delete;
    Hidden(Hidden&&) = delete;
private:
    ~Hidden() = default;
};
Hidden make_hidden() { return Hidden{}; }
```

구현이 중간 임시를 실제로 만들지 않는다고 해도 호출자가 반환 결과를 파괴할 수 있어야 하므로 `make_hidden()` 사용 지점은 소멸자 접근 오류로 거부될 수 있습니다. 이 검사는 실행 중 소멸자 호출 횟수와 다른 층위입니다. 생성자 로그가 한 번만 찍혔다는 관찰이 소멸자 접근 규칙을 증명하지 않습니다.

또한 `return T{};`와 `return Other{};`를 `T`로 받는 경우는 다릅니다. 변환 생성자, 사용자 정의 변환, 참조 반환이 끼어들면 선택되는 생성자와 materialization 지점이 달라집니다. “C++17이면 복사·이동이 모두 필요 없다”는 문장은 목적지와 반환식의 타입이 같은 직접 구성 경로라는 조건을 붙여야 정확합니다.

## 구현 판단

값을 반환하는 API는 가능하면 `T make()`와 `return local;`을 자연스럽게 작성하고, 근거 없이 `std::move(local)`을 붙이지 않습니다. 반환 타입이 비복사·비이동이어야 한다면 `return T{};` 같은 보장된 prvalue 경로를 사용하되, 조건부 지역 반환과 예외 경로가 생기는 순간 생성자 요구를 다시 확인해야 합니다. 참조를 반환해야 하는 API는 반환 객체의 소유자와 수명을 문서에 직접 적고, 함수 내부 임시를 참조로 노출하지 않습니다.

검증은 표준 모드, 반환 타입, 목적지 타입, 생성자 삭제 여부, 소멸자 접근성, 참조 저장 위치의 여섯 항목으로 나눕니다. 컴파일러 실험에서는 C++17과 C++14를 분리하고, `return T{}`, `return local`, `return std::move(local)`을 각각 syntax-only로 확인합니다. Apple Clang에서 성공했다고 다른 ABI나 표준 모드의 보장으로 확대하지 않습니다.

## 실패 추적

실패 원인은 세 종류로 분리해야 합니다. 첫째, C++14에서 삭제된 이동·복사로 `return T{}`가 거부되는 것은 직접 구성 규칙의 버전 경계입니다. 둘째, C++17에서도 `return local;`이 거부되는 것은 NRVO가 선택되지 않아 사용할 생성자가 없기 때문입니다. 셋째, 컴파일은 되지만 함수가 임시의 참조를 반환하는 것은 수명 규칙 위반으로 dangling reference를 만드는 실행 결함입니다.

작은 추적표를 만들면 판단이 흔들리지 않습니다.

| 단계 | `return T{}` | `return local` | `return std::move(local)` |
| --- | --- | --- | --- |
| 함수 내부 | prvalue 값 계산 | `local` 객체 생성 | `local` 객체 생성 |
| 반환 연결 | 목적지 직접 구성 | NRVO 선택 또는 이동/복사 | xvalue에서 이동 |
| 호출자 참조 | 필요 시 별도 materialization | 결과 문맥에 따라 분석 | 이동 결과 수명 분석 |
| 실패 지점 | 생성자/소멸자 접근 | 생략 실패 시 생성자 | 이동 생성자 삭제/접근 |

## 비용과 한계

NRVO를 기대하면 성공 빌드에서 생성자 호출 하나를 줄일 수 있지만, 복사 불가능 타입의 correctness를 선택적 생략에 걸면 컴파일러·빌드 옵션 차이에 취약해집니다. `std::move`를 추가하면 이동 생성자 비용과 `noexcept` 선택, 자원 상태 이전을 명시적으로 떠안습니다. 참조 수명 연장은 복사를 피할 수 있지만 소유권을 제공하지 않으므로 저장 구조가 바뀌면 dangling 가능성이 커집니다.

이 문서는 특정 컴파일러 실행 결과를 보고하는 것이 아니라 C++17 언어 규칙에 대한 설명입니다. 규범 텍스트와 구현 관찰을 구분하려면 [cppreference Copy elision](https://en.cppreference.com/w/cpp/language/copy_elision.html)의 C++17 prvalue, NRVO, temporary materialization 절을 읽고, 실제 프로젝트의 표준 모드로 별도 컴파일 행렬을 실행해야 합니다. 이 출처는 교육·참조 자료이며 최신 컴파일러의 주소나 호출 횟수를 보증하는 자료는 아닙니다.

```diagram
{"title":"C++ 반환과 materialization","caption":"prvalue 직접 구성, NRVO 선택, 참조 바인딩의 materialization을 분리한 설명용 흐름입니다.","rows":[[{"id":"expr","label":"반환 표현식"}],[{"id":"pr","label":"T{} prvalue"},{"id":"named","label":"이름 있는 local"}],[{"id":"dest","label":"목적지 직접 구성"},{"id":"nrvo","label":"NRVO 선택"},{"id":"mat","label":"참조용 materialize"}]],"edges":[{"from":"expr","to":"pr","label":"값 계산"},{"from":"expr","to":"named","label":"기존 객체 이름"},{"from":"pr","to":"dest","label":"C++17 직접 구성"},{"from":"pr","to":"mat","label":"참조가 객체 요구"},{"from":"named","to":"nrvo","label":"선택적 생략"}]}
```

### 참고자료

- [cppreference: Copy elision](https://en.cppreference.com/w/cpp/language/copy_elision.html), 2026-09-19 확인. C++17 prvalue 직접 구성, NRVO와 temporary materialization 설명에 사용했습니다.
- [C++ draft working area](https://eel.is/c++draft/), 특정 초안 절 번호를 최신성으로 단정하지 않고 언어 규칙 원문 대조 경로로 남깁니다.

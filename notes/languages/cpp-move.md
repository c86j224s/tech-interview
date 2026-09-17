---
id: cpp-move
title: C++ 값 범주와 실제 이동 비용
topic: 언어·런타임
summary: std::move·forward·const의 오버로드 선택을 추적하고 noexcept 재할당·allocator 전파·이동 후 원본·복사 생략을 설명합니다.
questionIds: [cpp-move-semantics, cpp-forwarding-reference-category, cpp-allocator-move-propagation, cpp-noexcept-move-container]
---

# C++ 값 범주와 실제 이동 비용

## std::move의 값 범주 변환과 실제 이동

큰 문자열 source를 target으로 옮기려 `std::move(source)`를 썼다고 합시다. 이 함수는 source를 이동 가능한 값 범주인 xvalue로 변환할 뿐입니다. 실제 생성자·대입 연산자가 무엇을 하는지는 타입과 오버로드 선택에 달렸습니다. 이 표현식만 평가했다고 원본 버퍼가 비워지지 않습니다.

`const std::string source`에 move를 적용하면 const가 남습니다. 일반적인 `std::string&&` 이동 생성자는 const rvalue를 받을 수 없어 해당 구성에서는 `const std::string&` 복사가 선택됩니다. 이동 연산이 없을 때 복사로 이어지는 경우와, 명시적으로 삭제된 이동 오버로드가 최적 후보여서 컴파일 오류가 나는 경우도 구분해야 합니다.

## 선언 타입과 표현식 값 범주의 구분

```cpp
void consume(const std::string&); // 관찰 또는 복사 경로
void consume(std::string&&);      // 이동 가능한 입력 경로

void relay(std::string&& value) {
    consume(value);               // 이름으로 쓴 표현식은 lvalue
    consume(std::move(value));    // xvalue로 전달
}

template<class T>
void forwardToConsume(T&& value) {
    consume(std::forward<T>(value));
}
```

필요한 헤더는 `<string>`과 `<utility>`입니다. 두 consume 구현이 실제로 자원을 소비하는지는 별도 계약입니다. forwarding reference는 위처럼 타입 추론에 참여하는 형태에서 성립하며 모든 `T&&`가 자동으로 forwarding reference인 것은 아닙니다.

| 원래 인자 | 추론된 T | 매개변수 타입의 collapse | forward 결과 |
| --- | --- | --- | --- |
| `std::string` lvalue | `std::string&` | `std::string&` | lvalue |
| `std::string` rvalue | `std::string` | `std::string&&` | rvalue |
| const lvalue | `const std::string&` | `const std::string&` | const lvalue |

여기서 무조건 move를 쓰면 lvalue 호출자의 객체도 소비 가능한 입력으로 바뀝니다. forward는 원래 범주를 보존하지만 참조 대상의 수명을 연장하지 않습니다. 전달받은 참조를 비동기 콜백에 저장하려면 별도 소유 계약이 필요합니다.

## Vector 재할당의 복사 선택과 예외 후 상태

vector가 새 저장소를 확보한 뒤 기존 원소 세 개를 옮긴다고 합시다. 이동이 첫 두 원소의 자원을 가져간 후 세 번째에서 예외를 던지면 원본 두 원소를 정확히 되돌리기 어려울 수 있습니다. 복사 가능한 타입이라면 원본을 유지한 채 새 저장소를 만들기 위해 복사를 선택할 수 있습니다.

```diagram
{"title":"재할당은 원소 이전의 실패 보장을 고려합니다","caption":"화살표는 선택 관계입니다. 실제 표준 라이브러리 연산의 요구와 타입 trait을 확인해야 하며 이동이 있다는 사실만으로 항상 이동하는 것은 아닙니다.","rows":[[{"id":"grow","label":"vector 새 저장소 준비"}],[{"id":"safe","label":"던지지 않는 이동 가능"},{"id":"throw","label":"이동은 던질 수 있음"}],[{"id":"move","label":"원소 이동 가능"},{"id":"copy","label":"복사 가능하면 원본 보존"}]],"edges":[{"from":"grow","to":"safe","label":"타입 계약 확인"},{"from":"grow","to":"throw","label":"예외 가능성"},{"from":"safe","to":"move","label":"이전 실패 없음"},{"from":"throw","to":"copy","label":"강한 보장 고려"}]}
```

복사가 불가능하고 이동이 던질 수 있는 타입이면, vector가 이전 중 예외를 만났을 때 해당 연산의 강한 예외 보장이 제한될 수 있습니다. 실제로 사용하는 타입과 vector 연산의 표준 계약에서 예외 뒤 원본과 컨테이너 상태를 확인해야 합니다. 이동이 예외를 던질 수 있는데 성능 때문에 `noexcept`만 붙이면 예외가 `terminate`로 끝날 수 있으므로, `noexcept`는 최적화 힌트가 아니라 지켜야 할 계약입니다.

## Allocator 불일치와 버퍼 이전 제약

컨테이너 이동 대입에서 allocator가 전파되지 않고 두 allocator가 동등하지 않다면 대상은 원본 allocator로 할당한 메모리를 자기 allocator로 해제할 수 없습니다. 이때 새 저장소의 원소별 이동이 필요할 수 있어 전체 비용이 선형이 됩니다.

기본 이동 생성, 명시 allocator를 받는 이동 생성, 이동 대입의 조건은 다릅니다. `propagate_on_container_move_assignment`, 동등성, `is_always_equal` 등 실제 allocator trait과 컨테이너 계약을 확인합니다. swap도 allocator 조건을 무시한 범용 무예외 커밋이 아닙니다. 작은 고정 저장 공간이나 small-string 최적화를 쓰는 타입도 이동이 항상 포인터 교환 하나라고 볼 수 없습니다.

## 표준 라이브러리 moved-from 객체의 유효하지만 내용이 미지정된 상태

표준 라이브러리의 moved-from 객체는 별도 규정이 없으면 유효하지만 내용이 미지정인 상태로 다룹니다. 무조건 비었다거나 옛 값이 남았다고 기대하지 않습니다. 파괴·새 값 대입처럼 전제 없는 연산은 가능하지만 front 같은 연산에는 비어 있지 않다는 조건을 다시 확인해야 합니다. 사용자 타입도 자체 moved-from 불변식을 명시합니다.

반환 시 `return local;`의 NRVO 가능성과 C++17 이후 특정 prvalue의 보장된 복사 생략을 구분합니다. 모든 반환에 `std::move`를 붙이면 오히려 NRVO를 막을 수 있습니다. 복사·이동 카운터를 넣은 실험도 컴파일러·표준 모드·최적화·관측 코드의 영향을 함께 기록합니다.

## 이동·복사 횟수와 실패 상태의 동시 검증

관찰용 타입으로 const 이동 요청, lvalue forwarding, rvalue forwarding, vector capacity 경계를 시험합니다. 복사 가능·불가능과 noexcept 여부를 바꾸고 이동·복사·할당 수를 따로 기록합니다. allocator가 다른 이동 대입에서는 어느 allocator가 해제하는지도 추적합니다.

이동 후 원본의 유효성·self-move 계약·예외 주입 뒤 컨테이너 상태도 검사합니다. `scripts/verify-cpp-study.cpp`를 Apple Clang 21.0.0, C++20, ASan·UBSan으로 실행해 lvalue·rvalue·const·forwarding 선택을 확인했습니다. noexcept 원소 두 개를 vector 재할당으로 옮긴 작은 예에서는 복사 0회·이동 2회를 관찰했습니다. allocator 불일치·던지는 이동·self-move의 실패 경로는 이 실행에서 시험하지 않았으며 이 관찰을 모든 컨테이너 계약으로 일반화하지 않습니다.

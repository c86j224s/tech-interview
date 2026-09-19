---
id: cpp-span-string-view-borrowed-views
title: C++ span·string_view Borrowed View
topic: 언어·런타임
summary: >-
  non-owning view의 주소·길이·수명 계약과 string_view의 C 문자열 경계, span의 const·extent 선택을 실제
  저장소 상태로 설명합니다.
questionIds: []
prerequisites:
  - cpp-storage-validity
  - cpp-coroutine-lifetime
related:
  - cpp-storage-validity
  - cpp-coroutine-lifetime
reviewedAt: '2026-09-19'
---
# C++ span·string_view Borrowed View

`std::span`과 `std::string_view`는 원본을 소유하지 않고 연속 저장소의 주소와 길이를 빌리는 객체입니다. view를 복사해도 원소 수명은 연장되지 않습니다. 안전성은 (1) 원본 객체가 살아 있는가, (2) 주소가 재배치되지 않는가, (3) view의 const가 원소 접근을 제한하는가, (4) 소비 API가 길이를 보존하는가로 나누어 확인합니다. 같은 “작은 wrapper”라도 string_view와 span의 원소 타입·extent·문자열 종료 조건은 서로 다릅니다.

## 주소와 길이 구조

```cpp
void sum(std::span<const int> values) {
    long total = 0;
    for (int x : values) total += x;
}
std::vector<int> values{10, 20, 30};
sum(values);
```

호출 시 span은 vector를 복사하지 않고 `(data, 3)`을 빌립니다. `sum`이 끝나면 view는 사라지지만 vector가 소유한 원소는 남습니다. 반대로 span을 캐시에 저장한 뒤 vector가 파괴되거나 capacity를 넘어 재할당되면 주소와 길이 숫자는 남아도 유효한 범위가 아닙니다. 지역 string에서 view를 반환하는 것도 같은 이유로 dangling입니다.

## 임시 객체와 수명

```cpp
std::string_view view = std::string("abc");
// full-expression 종료: 임시 string 파괴, view dangling
```

view는 임시 string의 lifetime을 연장하지 않습니다. `view.size()`가 3을 반환할 수 있다는 관찰이나 debugger의 포인터 값은 문자를 읽을 수 있다는 증거가 아닙니다. 지역 `std::string`의 일부를 반환하는 함수도 함수 종료 시 원본이 파괴됩니다. 장기 보관이 필요하면 `std::string(view)`로 복사하거나 애초에 소유 string을 반환합니다. 즉시 소비 API는 호출자가 원본을 유지한다는 조건을 문서화할 수 있지만, callback·cache·task 경계를 넘을 때는 소유 타입이 기본값입니다.

`string_view`가 range 분류에서 borrowed로 다뤄지는 경우는 iterator 결과를 허용하는 library 규칙과 관련됩니다. 이것이 원본 string 수명을 연장한다는 뜻은 아닙니다.

## C 문자열과 길이

```cpp
std::string text = "prefix|payload|tail";
std::string_view part(text.data() + 7, 7);
```

`part`의 논리 내용은 `payload`지만 `part.data()` 뒤에는 `|tail`과 원본의 종료 null이 있을 수 있습니다. `%s`나 `strlen`은 `part.size()`를 모릅니다. 우연히 뒤쪽의 null을 만나면 view 밖까지 읽고 `payload|tail`처럼 보일 수 있습니다. 접근 가능한 null이 없으면 종료를 찾기 위해 범위를 넘어서 읽는 정의되지 않은 동작이 됩니다. 이는 단순한 “출력이 조금 길어질 수 있음”으로 축소할 문제가 아닙니다.

길이 기반 API에는 `part.data(), part.size()`를 함께 넘깁니다. null-terminated API만 받을 수 있으면 `std::string owned(part); owned.c_str()`처럼 경계를 복사로 재구성합니다. copy 비용을 없애기 위해 data 포인터만 넘기는 것은 문자열 계약을 위반합니다.

## const 접근 권한

```cpp
int a[] = {1, 2};
std::span<int> writable(a);
const std::span<int> fixed_view = writable;
std::span<const int> read_only(a);
fixed_view[0] = 7;     // 원소 타입 int: 허용
// read_only[0] = 8;   // const int: 거절
```

`const std::span<int>`의 const는 view 객체의 재지정과 멤버 상태 변경을 막습니다. 원소 타입은 여전히 int이므로 다른 alias뿐 아니라 fixed_view 자체를 통한 대입도 가능합니다. `std::span<const int>`는 view를 다른 범위로 대입할 수 있지만, `operator[]` 결과가 const int라 원소 수정이 불가능합니다. `const std::span<const int>`는 둘 다 적용합니다. 이는 `int* const`와 `const int*`의 차이와 같습니다.

원소 const는 lifetime이나 thread synchronization을 제공하지 않습니다. 다른 int*가 동시에 쓰는 동안 read_only를 읽으면 data race 문제는 그대로 남고, vector 재할당도 막지 못합니다.

## Static과 Dynamic Extent

`std::span<T, N>`의 `N`은 타입에 들어가고 `std::span<T>`는 `dynamic_extent`와 runtime size를 사용합니다. 고정 header라면 `span<const byte, 4>`로 API 의미를 드러낼 수 있지만, 크기 검사가 언제 일어나는지는 source 종류에 따라 다릅니다.

```cpp
void header(std::span<const std::byte, 4> h);
std::array<std::byte, 4> exact{};
header(exact); // 배열의 타입이 4이므로 생성 조건을 표현

std::span<const std::byte> dynamic = /* size=4 또는 5 */;
// static span으로 변환할 때 dynamic source의 exact-size는 runtime precondition
```

C 배열·`std::array`·이미 static extent인 span처럼 source 타입에 크기가 있는 경우 불일치를 compile-time constraint로 거절할 수 있습니다. 반면 dynamic span이나 일반 range에서 `span<T, 4>`를 만드는 경우 `source.size() == 4`는 runtime precondition입니다. 자동 예외나 검사가 생긴다고 단정할 수 없습니다. C++26 hardened contract wording은 표준 버전과 구현 모드에 따라 별도로 확인해야 합니다.

정적 extent는 pointer 저장만 필요하게 만들 여지가 있고 dynamic extent는 size를 저장하지만, 실제 ABI와 최적화 비용은 compiler·호출 형태·인라이닝에 달렸습니다. static이 항상 빠르거나 dynamic이 반드시 느리다고 말하지 않습니다. 어느 extent도 backing storage의 수명과 주소 안정성을 보장하지 않습니다.

## 컨테이너 무효화

```text
vector capacity=3, span=(old_data,3)
push_back(4) -> allocation 변경, 원소 이동
old_data -> 해제된 저장소, span 역참조 금지
```

capacity를 넘는 `push_back`은 vector 저장소를 재배치할 수 있습니다. capacity가 남아 있어도 erase·중간 insert는 원소의 논리 위치를 바꿉니다. `reserve`는 특정 구간의 재할당을 줄일 뿐 영구 주소 안정성 계약이 아닙니다. `vector<unique_ptr<T>>`는 vector 원소가 재배치되어도 각 `T`의 별도 allocation 주소가 유지될 수 있지만, unique_ptr 원소 삭제 시 `T`는 파괴됩니다. 어느 allocation이 소유되는지를 끝까지 추적해야 합니다.

## Borrowed View API

즉시 소비하는 함수에는 `span<const T>`와 `string_view`가 복사 없이 범위를 표현하기 좋습니다. 저장·비동기·캐시에는 소유 string/vector 또는 명시적 shared ownership을 사용합니다. 고정 prefix와 가변 body를 함께 처리하는 parser라면 header는 static extent, payload는 dynamic extent와 최대 길이 검사를 조합합니다. extent가 네 바이트라고 해도 endian, 값 범위, 원본 lifetime은 자동으로 검증되지 않습니다.

API 리뷰에서는 반환 type과 callback capture를 특히 봅니다. 매개변수 view는 호출 중에만 쓰고, task가 저장해야 한다면 소유 복사로 변환합니다. C API 경계에서는 “size 인자를 받는가, null 종료를 요구하는가”를 함수별로 확인합니다. `data()`는 null 종료를 추가하지 않습니다.

## 실패 비용과 검증

dangling view를 sanitizer가 특정 실행에서 잡을 수는 있지만, 검출되지 않았다는 사실은 정의된 동작의 증명이 아닙니다. 안전한 검증은 (1) 임시 string view를 static analysis/코드 리뷰로 거절, (2) vector 재할당 전후 주소를 관찰하되 old view를 역참조하지 않음, (3) `const span<int>`의 원소 대입과 재지정을 각각 compile check, (4) static source와 dynamic source의 extent mismatch를 별도 compile/runtime contract로 확인하는 순서입니다.

```diagram
{"title":"view와 저장소의 단절","caption":"view는 주소와 길이만 빌립니다. 원본 종료·재할당·범위 손실은 각각 다른 실패이며 const와 extent가 이를 대신 고쳐 주지 않습니다.","rows":[[{"id":"owner","label":"원본 저장소","detail":["수명 · allocation"]}],[{"id":"view","label":"view","detail":["pointer + length"]}],[{"id":"event","label":"임시 종료·재할당·data만 전달"}],[{"id":"safe","label":"즉시 길이 소비","detail":["소유자 유지"]},{"id":"bad","label":"dangling·overread","detail":["계약 단절"]}]],"edges":[{"from":"owner","to":"view","label":"범위 대여"},{"from":"view","to":"event","label":"원본 변화와 결합"},{"from":"event","to":"safe","label":"수명·길이 유지"},{"from":"event","to":"bad","label":"경계 손실"}]}
```

## 참고자료와 적용 범위

- https://en.cppreference.com/w/cpp/container/span — span의 non-owning 연속 범위, static/dynamic extent, 무효화 관점을 확인했습니다.
- https://en.cppreference.com/w/cpp/container/span/span — static source의 compile-time constraint와 dynamic/general source의 exact-size runtime precondition을 확인했습니다.
- https://en.cppreference.com/w/cpp/string/basic_string_view — 임시 string이 수명을 연장하지 않는다는 점을 확인했습니다.
- https://en.cppreference.com/w/cpp/string/basic_string_view/data — `data()`가 반드시 null-terminated가 아니며 C 문자열 함수와 길이 경계가 다름을 확인했습니다.

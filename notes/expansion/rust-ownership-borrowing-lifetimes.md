---
id: rust-ownership-borrowing-lifetimes
title: Rust 소유권·Borrowing·Lifetime
topic: 언어·런타임
summary: Rust 소유권·Borrowing·Lifetime의 핵심 메커니즘·실패 조건·적용 경계를 다루는 제안입니다.
questionIds: []
prerequisites:
  - cpp-storage-validity
  - cpp-move
related:
  - cpp-storage-validity
  - cpp-move
reviewedAt: '2026-09-19'
---
# Rust 소유권·Borrowing·Lifetime

Rust의 소유권 규칙은 “메모리를 자동으로 치운다”는 한 문장으로는 설명되지 않습니다. 값마다 하나의 소유자가 있고, 소유권을 옮기거나 빌린 동안에는 그 값의 파괴 시점과 접근 권한이 컴파일 시점에 결정됩니다. `String`처럼 힙 버퍼를 가리키는 값과 `i32`처럼 비트 복사가 허용된 값은 같은 대입 문법을 써도 계약이 다릅니다. 빌림과 lifetime 표기는 저장 공간을 만들어 주는 장치가 아니라 이미 존재하는 저장 공간을 얼마나 오래 참조해도 되는지 증명하는 표기입니다.

## 소유권과 저장 표현

`String`은 대략 포인터·길이·capacity를 담은 소유 핸들입니다. `let a = String::from("rust"); let b = a;`에서 세 필드를 복제하면 두 핸들이 같은 버퍼를 해제하려는 문제가 생기므로 Rust는 `a`를 이동된 상태로 취급합니다. 실제 구현이 항상 단순한 비트 복사인지 여부보다 중요한 것은, 이동 뒤 원래 바인딩을 값으로 사용할 수 없다는 언어 계약입니다. `b`가 버퍼의 유일한 소유자가 되고 스코프를 벗어날 때 버퍼를 해제합니다.

반대로 `i32`, `bool`, `char`처럼 `Copy`인 타입은 대입할 때 값이 복사됩니다. 따라서 `let x = 7; let y = x; println!("{x}");`가 허용됩니다. `Copy`는 임의로 붙이는 최적화 힌트가 아니며, 값이 복사되어도 의미가 안전하고 복사 비용을 감당할 수 있다는 타입 계약입니다. `String`을 계속 사용하려면 `clone()`을 호출해 새 버퍼를 만드는 선택을 코드에 명시해야 합니다. 이동·Copy·clone은 각각 소유권 이전, 값 복제, 명시적 복제라는 서로 다른 비용을 나타냅니다.

## Move와 Copy의 상태 전이

다음 코드는 컴파일 오류와 실행 결과를 구분해 보여 줍니다.

```rust
let original = String::from("abc");
let moved = original;
// println!("{original}"); // error: borrow of moved value
println!("{moved}");       // abc

let n = 7_i32;
let copied = n;
println!("{n} {copied}");   // 7 7

let cloned = moved.clone();
println!("{moved} {cloned}"); // abc abc
```

이 예제의 중간 상태를 표로 추적하면 차이가 명확합니다.

| 시점 | `original` | `moved` | 힙 버퍼 | 판정 |
| --- | --- | --- | --- | --- |
| 생성 직후 | 소유 | 미생성 | 1개, `abc` | `original` 사용 가능 |
| 이동 직후 | 이동됨 | 소유 | 같은 1개 | `original` 값 사용 금지 |
| clone 직후 | 이동됨 | 소유 | 2개 | 복제 비용 발생 |
| 종료 | 없음 | 파괴 | 두 버퍼 각각 해제 | 이중 해제 없음 |

```diagram
{"title":"소유권 이동과 빌림의 경계","caption":"이동은 소유자를 바꾸고, 빌림은 소유자를 유지한 채 접근 기간을 제한합니다.","rows":[[{"id":"owner","label":"String 소유자","detail":["힙 버퍼의 해제 책임"]}],[{"id":"move","label":"소유권 이동","detail":["이전 이름은 값 사용 불가"]}],[{"id":"borrow","label":"참조 빌림","detail":["원래 소유자는 유지"]}],[{"id":"drop","label":"수명 종료","detail":["유효한 소유자가 해제"]}]],"edges":[{"from":"owner","to":"move","label":"대입·인자 전달"},{"from":"move","to":"borrow","label":"새 소유자에서 대여"},{"from":"borrow","to":"drop","label":"참조 종료 뒤 해제"}]}
```

## Borrowing과 별칭 규칙

`&T`는 읽기 참조이고 `&mut T`는 배타적 가변 참조입니다. 하나의 값에 대해 여러 불변 참조는 동시에 허용할 수 있지만, 가변 참조가 존재하는 동안에는 다른 읽기·쓰기 접근을 허용하지 않습니다. 이 규칙은 데이터 경합뿐 아니라 참조가 가리키는 저장 위치가 바뀌는 동안의 논리적 혼란도 막습니다. 참조 자체가 소유권을 갖지 않으므로 `&String`을 반환할 때 문자열 저장 공간은 호출자나 다른 소유자가 계속 살아 있어야 합니다.

```rust
fn length(s: &String) -> usize { s.len() }
fn append_mark(s: &mut String) { s.push('!'); }

let mut text = String::from("ok");
let size = length(&text);
append_mark(&mut text);
assert_eq!(size, 2);
assert_eq!(text, "ok!");
```

`size`가 `text`를 다시 쓰지 않으므로 불변 빌림의 사용이 끝난 뒤 가변 빌림이 시작됩니다. 핵심은 중괄호의 끝이 아니라 참조의 마지막 실제 사용입니다. 다만 참조를 컬렉션에 저장하거나 이후 분기에서 사용하면 컴파일러가 그 지점까지 빌림을 유지합니다.

## Vec 재할당과 마지막 사용

`Vec<T>`는 연속 저장소를 사용할 수 있으므로 `push`가 capacity를 넘으면 새 버퍼를 할당하고 원소를 옮깁니다. 그 순간 기존 원소를 가리키는 참조는 새 저장소를 가리키지 않으므로, 참조가 살아 있는 동안 같은 `Vec`을 가변적으로 변경할 수 없습니다.

```rust
let mut values = vec![10, 20];
let first = &values[0];
println!("{first}");
values.push(30); // 설명용: 참조의 마지막 사용 뒤에는 허용될 수 있음

let mut values = Vec::with_capacity(2);
values.extend([10, 20]);
let first = &values[0];
// values.push(30); // first가 이후 사용될 수 있는 구간이면 컴파일 거절
println!("{first}");
```

위 코드는 capacity가 충분하다는 사실만으로 모든 참조가 안전해지는 것은 아닙니다. capacity를 초과하면 재할당 가능성이 있기 때문에 언어는 포인터 안정성을 가정하지 않습니다. 참조를 먼저 정수 인덱스나 소유 값으로 바꾸고, 변경 뒤 새로 빌리거나, 필요한 값을 복사해 빌림을 끝내는 방식으로 구조를 나눕니다. 설명용 계산에서 `[10,20]`에 capacity 2로 `30`을 추가하면 길이는 3이 되고 새 주소로 옮겨질 수 있습니다. 이는 특정 allocator의 실제 주소를 측정한 결과가 아닙니다.

## Lifetime 표기와 반환 계약

lifetime 매개변수는 참조 사이의 관계를 표시할 뿐 저장 공간을 연장하지 않습니다. 다음 함수는 내부에서 만들어진 `String`의 버퍼를 지역 변수로 소유하므로 반환 시점에 파괴됩니다.

```rust
fn bad() -> &str {
    let local = String::from("temporary");
    &local // error: returns a reference to data owned by the current function
}
```

`fn bad<'a>() -> &'a str`라고 고쳐도 해결되지 않습니다. `'a`는 호출자가 제공한 실제 입력 수명과 연결되어 있지 않고, 지역 버퍼의 수명을 늘릴 권한도 없기 때문입니다. 가장 직접적인 대안은 `String`을 소유 값으로 반환하는 것입니다. 호출자가 이미 가진 문자열을 빌려 변환하는 함수라면 입력 참조를 반환하고, 두 입력 중 하나를 선택한다면 반환 참조의 유효 기간을 두 입력이 동시에 유효한 교집합으로 제한합니다.

```rust
fn longer<'a>(left: &'a str, right: &'a str) -> &'a str {
    if left.len() >= right.len() { left } else { right }
}

let a = String::from("short");
let result;
{
    let b = String::from("longer");
    result = longer(&a, &b);
    println!("{result}"); // b가 살아 있는 동안만 사용 가능
}
// println!("{result}"); // b가 사라진 뒤라면 컴파일 거절
```

이 함수는 새 문자열을 할당하지 않습니다. 반환값은 두 입력 중 하나의 slice일 뿐이며, 어느 입력이 더 긴지와 별개로 두 입력 모두 반환 사용 시점까지 살아 있어야 합니다.

## 함수 경계와 소유권 선택

API를 설계할 때 값의 소유권이 호출 경계를 넘어야 하는지부터 정합니다. 읽기만 필요하면 `&str`나 `&[T]`, 호출자가 버퍼를 재사용해야 하면 `&mut [T]`, 비동기 작업이 이후에도 보관해야 하면 `String`·`Vec<T>`·`Arc<T>`처럼 소유 가능한 형태가 적합합니다. `&'static str`는 프로그램 전체 수명을 가진 문자열 리터럴 등 제한된 저장 공간을 뜻하며, 일반 문자열을 leak해 모든 문제를 해결하는 표기가 아닙니다.

구조체가 참조를 저장하면 구조체 자체의 lifetime 관계도 함께 표현해야 합니다. 참조 필드의 수명이 소유 객체보다 길어지지 않도록 하고, 단순히 “오래 살아야 하니 `'static`”을 붙이지 않습니다. 특히 스레드·비동기 작업으로 넘기는 값은 작업이 끝날 때까지 소유권이 유지되는지, 참조가 스택 프레임이나 재할당 가능한 버퍼를 가리키지 않는지 확인해야 합니다.

## 실패 조건과 검증 순서

첫째, 컴파일 거절과 런타임 오류를 구분합니다. 이동 후 원래 변수 사용, 살아 있는 참조 중 가변 접근, 지역 참조 반환은 안전성을 위해 컴파일 단계에서 거절됩니다. 반면 `unwrap()` 실패나 인덱스 범위 오류는 실행 중 panic이 될 수 있습니다. 둘째, borrow checker가 허용했다고 해서 업무 논리까지 맞는 것은 아닙니다. 인덱스는 값 이동 뒤 바뀐 원소를 가리킬 수 있고, `clone()`은 일관성 비용을 숨길 수 있습니다.

검증은 작은 컴파일 예제로 수행합니다. stable Rust의 목표 toolchain과 `cargo check` 결과를 기록하고, 오류가 나는 줄은 주석 처리한 정상 예제와 분리합니다. `Vec` 재할당 주소가 실제로 바뀌었는지를 성공 조건으로 삼지 않습니다. allocator가 같은 주소를 재사용할 수도 있기 때문에, 검증할 대상은 참조 규칙과 컴파일 계약입니다. 이 장의 코드는 설명용이며 이 환경에서 Rust 실행 결과를 측정했다고 주장하지 않습니다.

## 비용과 적용 한계

소유권은 GC pause를 없애는 대신 데이터 흐름과 수명을 타입으로 명시하게 합니다. 큰 값을 무조건 borrow하면 lifetime 관계가 복잡해지고, 반대로 모든 경계에서 `clone()`하면 메모리와 복사 비용이 커집니다. `Rc`나 `Arc`는 공유 소유를 표현하지만 내부 변경의 동기화나 순환 참조까지 자동으로 해결하지 않습니다. `RefCell`의 borrow 검사처럼 일부 계약을 런타임으로 옮기는 도구도 있습니다.

실무에서는 “컴파일이 되면 안전”을 “성능과 의미가 최적”으로 확대하지 않습니다. 데이터 소유자가 명확한 파이프라인에는 이동을 사용하고, 짧은 읽기에는 borrow를 사용하며, 저장·비동기 경계를 넘을 때만 복제나 공유 소유를 선택합니다. 각 선택의 근거는 참조가 언제 마지막으로 쓰이는지, 저장소가 이동 가능한지, 호출자가 결과를 얼마나 오래 보관하는지로 남깁니다.

## 참고 자료와 검증 범위

- The Rust Book, “Understanding Ownership”, <https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html> 및 <https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html>, 2026-09-19 확인. 소유권 이동, Copy/clone, 참조와 가변 borrow의 본문·예제를 대조했습니다. 페이지의 특정 release version은 확인하지 못했습니다.
- Rust Reference, “Lifetime elision” 및 borrowing 관련 항목, <https://doc.rust-lang.org/reference/lifetime-elision.html>, 2026-09-19 확인. lifetime 표기가 저장 수명을 연장하지 않는다는 설명 범위를 확인했습니다. 전체 Reference의 모든 버전 경계까지 검증한 것은 아닙니다.
- 이 장의 `Vec` 주소 변화와 코드 결과는 설명용 추적입니다. 대상 toolchain에서 실행한 성공 결과가 아니며, 실제 검증 시에는 고정된 Rust toolchain과 `cargo check`를 별도로 기록해야 합니다.

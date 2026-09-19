---
id: rust-trait-objects-generics-monomorphization
title: Rust Trait Object와 Generic Monomorphization
topic: 언어·런타임
summary: Rust Trait Object와 Generic Monomorphization의 핵심 메커니즘·실패 조건·적용 경계를 다루는 지식 장입니다.
questionIds: []
prerequisites:
  - java-dispatch-erasure
related:
  - java-dispatch-erasure
reviewedAt: '2026-09-19'
---
# Rust Trait Object와 Generic Monomorphization

Rust의 trait은 공통 동작의 경계를 표현하지만, 그 경계를 호출하는 방식은 제네릭 정적 디스패치와 trait object 동적 디스패치로 나뉩니다. `fn draw<T: Draw>(x: &T)`는 호출에 사용된 구체 타입별 코드 인스턴스를 만들 수 있고, `&dyn Draw`는 런타임에 데이터 포인터와 vtable을 통해 구현을 선택합니다. `impl Trait` 반환은 호출자에게 구체 타입 이름을 숨길 뿐, 분기마다 서로 다른 타입을 한 값으로 합치는 기능은 아닙니다.

## Trait bound와 정적 디스패치

제네릭 함수의 `T: Trait` bound는 컴파일러가 호출에 필요한 메서드와 타입 조건을 확인하게 합니다. `Vec<T>` 안의 모든 원소는 하나의 동일한 T여야 하므로 각 호출의 레이아웃과 메서드 선택을 컴파일 시점에 구체화할 수 있습니다. 이를 monomorphization이라고 부르며, 타입별 전문화가 인라이닝과 최적화를 도울 수 있는 대신 사용한 타입 수만큼 코드가 늘어날 가능성이 있습니다.

```rust
trait Render { fn render(&self) -> String; }
struct Text(String);
struct Number(i32);
impl Render for Text { fn render(&self) -> String { self.0.clone() } }
impl Render for Number { fn render(&self) -> String { self.0.to_string() } }

fn show<T: Render>(value: &T) -> String { value.render() }
let a = show(&Text("hi".into()));
let b = show(&Number(7));
```

설명용으로 보면 `show::<Text>`와 `show::<Number>`라는 두 구체 인스턴스가 생길 수 있습니다. 실제 최종 바이너리에서 인라이닝·중복 제거·LTO가 어떻게 적용되는지는 toolchain과 빌드 설정의 결과이므로 소스만 보고 정확한 바이트 수를 단정할 수 없습니다. “제네릭이면 반드시 인라이닝된다”도 언어 보장이 아닙니다.

## Monomorphization의 비용 추적

타입이 `Text`, `Number`, `Image` 세 개이고 각 instantiation의 기계 코드가 최적화 전 1.5KB라고 가정하면 설명용 코드 영역은 약 `3 × 1.5KB = 4.5KB`입니다. 공통 helper가 0.5KB 공유되고 각 타입별 부분이 1.0KB라면 실제 중복은 `0.5 + 3 × 1.0 = 3.5KB`처럼 달라집니다. 이는 측정값이 아니라 비용 구조를 설명하는 계산입니다.

정적 디스패치는 호출 간접 비용을 줄일 여지가 있고, 컴파일러가 T의 필드와 분기를 알 수 있습니다. 그러나 타입 수가 많거나 큰 제네릭 함수가 여러 crate 경계를 통과하면 컴파일 시간과 instruction cache 압력이 커질 수 있습니다. 반대로 trait object는 하나의 호출 경로를 공유할 수 있지만 vtable 간접 호출과 객체 배치·할당 비용을 고려해야 합니다.

## Trait object의 데이터와 vtable

`Box<dyn Render>`는 소유된 구체 값을 heap에 보관하고, fat pointer에 데이터 주소와 vtable 주소를 함께 담습니다. vtable에는 해당 구체 구현의 `render` 함수와 drop·size·alignment 같은 메타데이터가 연결됩니다. 정확한 ABI 레이아웃을 애플리케이션의 영속 포맷처럼 취급해서는 안 되지만, “타입 정보가 모두 지워진 단순 포인터”라고 설명하는 것도 부정확합니다.

```rust
let items: Vec<Box<dyn Render>> = vec![
    Box::new(Text("hello".into())),
    Box::new(Number(42)),
];
for item in &items {
    println!("{}", item.render());
}
```

이 벡터의 원소는 서로 다른 concrete type이지만 같은 `dyn Render` 계약과 heap 소유권을 가집니다. `Vec<Text>`에는 `Number`를 넣을 수 없습니다. `Box`를 사용하지 않고 `Vec<&dyn Render>`를 만들 수도 있지만, 참조가 가리키는 원본 값들이 벡터보다 오래 살아야 하고 소유권을 벡터로 넘길 수 없습니다.

```diagram
{"title":"정적 디스패치와 동적 디스패치","caption":"제네릭은 구체 타입별 호출을 만들고, trait object는 공통 vtable 경로로 서로 다른 값을 다룹니다.","rows":[[{"id":"bound","label":"T: Trait","detail":["구체 타입이 컴파일 시 결정"]},{"id":"object","label":"dyn Trait","detail":["데이터 포인터 + vtable"]}],[{"id":"specialized","label":"전문화된 함수","detail":["타입별 코드 인스턴스"]},{"id":"vcall","label":"vtable 호출","detail":["실행 시 구현 선택"]}],[{"id":"policy","label":"선택 기준","detail":["동질성·성능·이진 크기"]}]],"edges":[{"from":"bound","to":"specialized","label":"monomorphization"},{"from":"object","to":"vcall","label":"dynamic dispatch"},{"from":"specialized","to":"policy","label":"코드 크기 비용"},{"from":"vcall","to":"policy","label":"간접 호출·소유 비용"}]}
```

## Dyn compatibility와 메서드 조건

모든 trait이 `dyn Trait`로 사용 가능한 것은 아닙니다. 동적 dispatch가 가능한 메서드는 런타임 vtable에 하나의 호출 규격으로 들어갈 수 있어야 합니다. 메서드가 자체 제네릭 타입 매개변수를 가지면 호출마다 임의 타입을 받아야 하므로 일반적인 vtable 항목으로 만들기 어렵습니다. `Self`를 반환하거나 매개변수로 사용해 객체 크기·구체 타입을 요구하는 메서드도 제약을 받습니다.

```rust
trait Factory {
    fn make(&self) -> Self;              // dyn Factory 사용에 제약
    fn convert<T>(&self, value: T) -> T; // 제네릭 메서드
}
```

이런 메서드가 trait 전체에 포함되어 있으면 `Box<dyn Factory>`를 바로 만들 수 없습니다. 객체로 쓸 필요가 없는 메서드에는 `where Self: Sized` 같은 조건을 두어 trait object의 dispatchable 집합에서 제외하는 설계를 검토할 수 있습니다. 이 경우 `dyn Trait`에서 해당 메서드를 호출할 수 없다는 사실이 API 문서에 드러나야 합니다. `Self: Sized`를 붙인다고 모든 메서드가 동적 호출 가능해지는 것은 아닙니다.

## impl Trait의 불투명 반환

`fn source(flag: bool) -> impl Iterator<Item = i32>`에서 `impl Trait`는 반환 타입의 이름을 숨기지만 함수 호출마다 하나의 구체 반환 타입을 약속합니다. 다음처럼 분기마다 `Range`와 `Once`를 반환하면 두 타입을 하나로 추론할 수 없어 컴파일이 거절됩니다.

```rust
fn source(flag: bool) -> impl Iterator<Item = i32> {
    if flag {
        0..3
    } else {
        std::iter::once(9) // error: incompatible types
    }
}
```

대안은 동일한 enum으로 두 경우를 감싸고 `Iterator`를 구현하거나, `Box<dyn Iterator<Item=i32>>`로 동적 디스패치와 heap 소유를 명시하는 것입니다. 호출자가 단순히 결과를 소비하고 분기 집합이 닫혀 있다면 enum이 allocation과 vtable을 피할 수 있습니다. 플러그인처럼 외부 구현이 확장되고 목록을 동질적으로 저장해야 하면 `Box<dyn Trait>`가 더 적합할 수 있습니다.

## Vec와 이종 값의 메모리 경계

`Vec<T>`는 원소 크기와 정렬이 하나로 고정되어야 하므로 직접 이종 값을 담을 수 없습니다. `enum Shape { Text(Text), Number(Number) }`는 최대 variant 크기를 기준으로 한 homogeneous vector를 만들고 match로 dispatch합니다. variant 종류가 소스 코드에 고정되어 있고 각 경우를 모두 처리해야 한다면 enum은 누락을 컴파일러가 드러내는 장점이 있습니다.

`Vec<Box<dyn Render>>`는 원소가 포인터 크기로 고정되고 실제 객체가 별도 할당됩니다. 이 때문에 각 객체 allocation, 포인터 추적, cache locality, drop 경로가 비용이 됩니다. 반면 큰 객체를 벡터 안에서 매번 이동하지 않고 소유권을 균일하게 관리할 수 있습니다. `Arc<dyn Trait>`로 공유하면 refcount 비용과 `Send`·`Sync` 조건이 추가됩니다.

## 실패 조건과 검증

첫째, trait bound 실패와 dyn compatibility 실패를 분리합니다. `T: Render`가 누락된 제네릭 호출은 해당 호출의 bound 오류이고, `Box<dyn Factory>` 오류는 trait object가 요구하는 dispatch 규칙 위반입니다. 둘째, `impl Trait`의 분기 오류는 반환 trait이 같다는 사실과 concrete type이 같다는 사실을 혼동해서 생깁니다. `Iterator<Item=i32>`라는 공통 인터페이스만 같아도 opaque 반환의 한 타입 계약을 만족하지 않습니다.

검증에서는 `cargo check`로 실패 위치를 기록하고, 정상 예제에서 `Vec<Box<dyn Render>>`를 순회해 출력 순서가 `[hello, 42]`인지 확인합니다. 바이너리 크기 비교는 `-C opt-level`, LTO, panic strategy, target을 고정하고 `size`나 linker map으로 비교해야 합니다. 이 장의 코드와 4.5KB 계산은 설명용이며 실제 컴파일·벤치마크를 실행한 결과가 아닙니다.

## 선택 비용과 적용 경계

구체 타입 집합이 닫혀 있고 hot path의 데이터 locality와 최적화가 중요하면 제네릭이나 enum을 우선 검토합니다. 구현이 런타임에 선택되고 서로 다른 크기의 객체를 저장해야 하거나 외부 확장이 필요하면 trait object를 고려합니다. `impl Trait`는 반환 API에서 이름을 숨기며 정적 디스패치 성질을 유지할 수 있지만, 호출자에게 그 concrete 타입의 identity를 비교·분기하게 하지는 않습니다.

동적 디스패치를 성능 문제로 단정하기 전에 실제 호출 빈도와 allocation을 측정합니다. 반대로 제네릭이 빠를 것이라는 이유만으로 수백 타입의 거대한 코드 복제를 허용하지 않습니다. public API에서는 trait object의 object safety 조건과 `Send + Sync` 같은 추가 bound를 명시하고, 반환값의 수명·소유권·취소 시 drop 동작까지 함께 설명해야 합니다.

## 참고 자료와 검증 범위

- The Rust Book, “Traits: Defining Shared Behavior”, <https://doc.rust-lang.org/book/ch10-02-traits.html> 및 <https://doc.rust-lang.org/book/ch18-02-trait-objects.html>, 2026-09-19 확인. generic bound·impl Trait과 trait object의 정적/동적 dispatch 입문 본문을 대조했습니다. 특정 release version은 확인하지 못했습니다.
- Rust Reference, trait object 항목, <https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility>, 2026-09-19 확인. dyn compatibility를 설명할 때 Rust Reference의 규범적 조건을 우선했습니다.
- Rust 표준 문서의 `impl Trait` 설명과 compiler 오류 메시지는 버전별 세부가 달라질 수 있습니다. 이 장에서는 확정 가능한 타입 관계만 적고, 특정 최신 규칙이라고 주장하지 않았습니다.
- 코드와 코드 크기 계산은 설명용입니다. 실제 monomorphization 수와 바이너리 크기는 고정 toolchain·빌드 플래그로 별도 측정해야 합니다.

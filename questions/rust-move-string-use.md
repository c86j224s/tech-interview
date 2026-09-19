---
id: rust-move-string-use
title: String을 다른 변수로 이동한 뒤 원래 변수를 읽으면 왜 컴파일 오류가 나며 정수 대입과는 무엇이 다른가요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-ownership-borrowing-lifetimes
related:
  - cpp-object-lifetime-aliasing
  - cpp-move-semantics
---
# String을 다른 변수로 이동한 뒤 원래 변수를 읽으면 왜 컴파일 오류가 나며 정수 대입과는 무엇이 다른가요?

## 구두 답변

`let original = String::from("abc"); let moved = original;` 뒤의 `original`은 값이 없는 빈 문자열이나 null이 된 것이 아니라 **이동된 바인딩**입니다. `String`은 포인터·길이·capacity로 힙 버퍼를 소유하는 값이므로 핸들을 비트 복사해 두 소유자가 같은 버퍼를 drop하게 둘 수 없습니다. Rust는 대입 시 소유권을 `moved`로 이전하고, `println!("{original}")` 같은 이후 값 사용을 컴파일 단계에서 거절합니다. 따라서 실행 중 double free를 막기 위해 null을 검사하는 문제가 아닙니다. 반면 `let n: i32 = 7; let copied = n;`은 `i32: Copy`라서 값이 복제되고 두 바인딩을 모두 읽을 수 있습니다. `Copy`는 모든 타입에 붙는 최적화 표지가 아니라, 암시적 복사가 안전하고 타입의 구성요소도 Copy라는 계약입니다. `String`을 계속 쓰려면 `let cloned = moved.clone()`처럼 새 버퍼를 명시적으로 만들어야 합니다. 예를 들어 길이 1,000바이트 문자열을 clone하면 대체로 그 데이터 복사와 별도 할당 비용을 치릅니다. 읽기만 하는 함수라면 `fn bytes(s: &str) -> usize { s.len() }`로 빌려 호출자가 소유권을 유지하게 하고, 함수 밖에 보관할 결과라면 `String`을 반환해 소유권을 전달하는 편이 맞습니다. 즉 판단 순서는 원본을 이후에도 소유해야 하는지, 잠시 읽기만 하는지, 독립 복제가 필요한지입니다.

API 경계에서는 이 차이가 바로 설계 선택으로 드러납니다. `fn take(s: String)`은 호출자의 바인딩을 소비해 함수가 보관·반환할 수 있지만 호출 뒤 원래 이름은 사용할 수 없습니다. `fn inspect(s: &str)`는 버퍼를 빌리므로 호출자가 계속 소유하고, `fn duplicate(s: &str) -> String`은 읽은 뒤 새 소유 결과를 만듭니다. 같은 텍스트라도 세 시그니처의 이동·수명·할당 비용이 다르므로 타입 이름만으로 성능을 단정하지 않습니다.

## 득점 포인트

- String의 move·Copy·clone을 힙 소유권과 복사 비용으로 구분하고 컴파일 거절과 런타임 오류를 나눕니다.
- borrow·소유 반환·clone을 호출자가 결과를 얼마나 오래 보관하는지에 맞춰 선택합니다.

## 감점 포인트

- move를 null 상태나 double free의 런타임 현상으로 설명하지 않습니다.
- clone·String 반환·borrow의 비용과 소유권 차이를 생략하지 않습니다.

## 더 파고들 거리

- 구조체·비동기 작업이 참조를 보관할 때 소유 값과 lifetime을 어떻게 설계할까요?
- API 경계가 바뀔 때 Send·Sync 또는 정적·동적 dispatch 요구를 어떻게 재검증할까요?

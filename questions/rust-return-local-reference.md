---
id: rust-return-local-reference
title: 함수 안에서 만든 String의 참조를 반환할 수 없는 이유와 소유 값을 반환하는 대안은 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-ownership-borrowing-lifetimes
related:
  - cpp-object-lifetime-aliasing
  - cpp-move-semantics
---
# 함수 안에서 만든 String의 참조를 반환할 수 없는 이유와 소유 값을 반환하는 대안은 무엇인가요?

## 구두 답변

`fn bad() -> &str { let local = String::from("temporary"); &local }`은 반환 순간 `local`의 소유권이 함수 프레임에 있고, 함수가 끝나면 `String`과 힙 버퍼가 drop되므로 거절됩니다. 호출자가 받을 `&str`가 가리킬 저장 공간이 이미 사라지기 때문입니다. `fn bad<'a>() -> &'a str`로 lifetime 이름만 추가해도 바뀌는 것은 참조 사이의 관계 표기뿐이며, 지역 버퍼의 실제 수명을 늘리거나 소유권을 호출자에게 이전하지 않습니다. 새 문자열을 만들고 호출자가 보관해야 한다면 `fn make() -> String { String::from("temporary") }`처럼 소유 값을 반환합니다. 이 경우 버퍼의 소유권이 반환값으로 이동하고 호출자가 drop을 책임집니다. 반대로 입력에 이미 있는 내용을 선택하는 함수라면 `fn first<'a>(a: &'a str, b: &'a str) -> &'a str`처럼 입력 borrow를 반환할 수 있습니다. 두 입력의 반환형은 두 입력이 함께 유효한 교집합 구간으로 제한됩니다. `Box::leak(String::from("x").into_boxed_str())`로 `'static` 참조를 만들 수는 있지만 메모리를 의도적으로 회수하지 않는 특수 선택이므로 일반적인 수명 해결책이 아닙니다. 결과가 입력 조합·정규화로 새 내용을 가져야 하면 `String`, 원본의 부분 선택이면 borrow를 선택하고, 비동기·스레드 경계를 넘어 보관한다면 스택이나 임시 버퍼를 가리키는 참조 대신 소유 형태를 검토합니다.

반환 형태를 결정할 때는 포인터의 출처를 먼저 묻습니다. `local`에서 나온 참조는 함수 프레임에 묶여 있어 밖으로 나갈 수 없고, 입력에서 나온 참조는 호출자가 storage를 유지하므로 가능하며, 계산으로 새로 생긴 문자는 소유 buffer가 필요합니다. `String` 반환은 allocation 가능성을 감수하는 대신 호출자에게 명확한 drop 책임을 넘기고, borrow 반환은 allocation을 줄이는 대신 입력 lifetime을 결과에 전파합니다.

## 득점 포인트

- 지역 저장 공간의 drop과 lifetime 표기의 역할을 연결해 소유 반환 대안을 제시합니다.
- borrow·소유 반환·clone을 호출자가 결과를 얼마나 오래 보관하는지에 맞춰 선택합니다.

## 감점 포인트

- lifetime annotation이나 static이 지역 저장 공간을 자동으로 연장한다고 말하지 않습니다.
- clone·String 반환·borrow의 비용과 소유권 차이를 생략하지 않습니다.

## 더 파고들 거리

- 구조체·비동기 작업이 참조를 보관할 때 소유 값과 lifetime을 어떻게 설계할까요?
- 입력 borrow와 새 결과 생성 사이에서 Cow 또는 enum을 선택하는 기준은 무엇일까요?

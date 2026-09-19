---
id: rust-lifetime-two-inputs
title: 두 문자열 중 긴 쪽의 참조를 반환합니다. 입력 두 개와 반환값의 lifetime 관계를 어떻게 표시하나요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-ownership-borrowing-lifetimes
related:
  - cpp-object-lifetime-aliasing
  - cpp-move-semantics
---
# 두 문자열 중 긴 쪽의 참조를 반환합니다. 입력 두 개와 반환값의 lifetime 관계를 어떻게 표시하나요?

## 구두 답변

두 입력 중 하나를 그대로 선택해 반환하는 함수는 다음처럼 같은 lifetime 매개변수로 관계를 표현합니다. `fn longer<'a>(left: &'a str, right: &'a str) -> &'a str { if left.len() >= right.len() { left } else { right } }`. `'a`는 두 문자열을 복사하거나 합치는 시간이 아니라, 반환 참조를 사용할 수 있는 공통 유효 구간을 뜻합니다. 호출부에서 `a`는 바깥에 있고 `b`는 내부 블록에 있다고 해 보겠습니다. `let result; { let b = String::from("longer"); result = longer(&a, &b); println!("{result}"); }`까지는 두 입력이 살아 있으므로 가능하지만 블록 밖에서 `result`를 읽으려 하면 `b`가 이미 drop될 수 있어 거절됩니다. 설령 실제 길이 비교 결과가 항상 `a`를 선택한다고 사람이 알고 있어도, 일반 함수 시그니처는 호출별 분기 결과를 컴파일 시점에 그 사실로 좁히지 않습니다. 두 입력 모두 반환 사용 시점까지 살아 있어야 한다는 보수적인 계약이 필요합니다. 반환값이 두 문자열의 연결이나 정규화 결과라면 기존 버퍼 하나의 `&str`로 표현할 수 없으므로 `String`을 새로 만들어 반환해야 합니다. 단순 선택·부분 slice·검색 결과라면 borrow가 allocation을 피하지만 호출자의 수명을 함께 끌고 갑니다. 따라서 lifetime annotation을 성능 장식으로 붙이지 말고 “어떤 저장 공간을 계속 빌리는가”를 API에 명시하는 도구로 판단합니다.

수명 구간을 시간축으로 쓰면 `a: [0, 10]`, `b: [4, 7]`, 반환값: `[4, 7]`처럼 이해할 수 있습니다. 함수가 6에서 `a`를 반환해도 시그니처가 약속한 안전한 사용 구간은 여전히 `[4, 7]`입니다. 더 긴 문자열을 골랐다는 값의 속성과 참조가 유효한 저장 공간의 속성은 별개이므로, 결과를 7 이후에도 보관해야 한다면 `to_owned()`나 `String` 생성으로 lifetime을 끊어야 합니다.

## 득점 포인트

- 동일 lifetime이 두 입력과 반환의 교집합을 뜻하며 새 문자열 생성과 다름을 설명합니다.
- borrow·소유 반환·clone을 호출자가 결과를 얼마나 오래 보관하는지에 맞춰 선택합니다.

## 감점 포인트

- lifetime annotation이나 static이 지역 저장 공간을 자동으로 연장한다고 말하지 않습니다.
- clone·String 반환·borrow의 비용과 소유권 차이를 생략하지 않습니다.

## 더 파고들 거리

- 구조체·비동기 작업이 참조를 보관할 때 소유 값과 lifetime을 어떻게 설계할까요?
- 입력 borrow와 새 결과 생성 사이에서 Cow 또는 enum을 선택하는 기준은 무엇일까요?

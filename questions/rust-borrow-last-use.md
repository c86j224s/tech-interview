---
id: rust-borrow-last-use
title: 불변 참조를 만든 뒤 같은 Vec에 push하려 합니다. 참조의 마지막 사용 위치가 컴파일 결과를 바꾸는 이유는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-ownership-borrowing-lifetimes
related:
  - cpp-object-lifetime-aliasing
  - cpp-move-semantics
---
# 불변 참조를 만든 뒤 같은 Vec에 push하려 합니다. 참조의 마지막 사용 위치가 컴파일 결과를 바꾸는 이유는 무엇인가요?

## 구두 답변

핵심은 참조 변수의 선언 범위가 아니라 **마지막 실제 사용까지의 borrow region**입니다. 예를 들어 capacity가 2인 `let mut v = vec![10, 20]; let first = &v[0]; println!("{first}"); v.push(30);`에서는 `first`가 출력된 순간 읽기 borrow가 끝났다고 판단할 수 있어 `push`가 허용됩니다. 이를 non-lexical lifetime이라고 부릅니다. 반대로 `let first = &v[0]; v.push(30); println!("{first}");`에서는 `push`가 실행되는 시점에도 `first`가 필요하므로, `&v[0]`의 불변 borrow와 `&mut v`가 겹쳐 컴파일이 거절됩니다. `push`가 capacity를 초과하면 새 버퍼를 할당하고 원소를 옮길 수 있어 기존 참조가 무효화되는 것이 물리적 이유입니다. 다만 capacity가 충분한 경우에도 Rust는 참조와 가변 접근이 겹치는 프로그램을 일반적으로 허용하지 않으며, 특정 allocator가 실제로 주소를 바꿨는지 실행 중 검사하지 않습니다. 안전한 수정은 `let value = v[0]; v.push(30); println!("{value}")`처럼 Copy 값을 먼저 꺼내 borrow를 끝내거나, `usize` 인덱스를 저장한 뒤 push 후 다시 조회하는 것입니다. 인덱스는 메모리 안전성을 해결할 뿐 삭제·정렬 뒤 다른 논리 원소를 가리킬 수 있으므로 의미 검증이 별도입니다. `reserve` 역시 주소 안정성을 영구 보장하는 표지가 아닙니다.

다만 마지막 사용 분석이 물리 저장소를 고정하는 것은 아닙니다. `let first = &v[0]; println!("{first}"); v.push(30);`이 허용되어도 이후 다른 참조를 만들어 오래 보관할 수 있다는 뜻은 아닙니다. `Vec<String>`의 원소 내부를 빌린 뒤 벡터 자체에 push하는 경우에는 바깥 컨테이너의 재배치와 내부 String 버퍼의 수명을 동시에 추적해야 하므로, 필요한 문자열을 clone하거나 작업을 두 단계로 나누는 편이 명확할 수 있습니다.

## 득점 포인트

- NLL의 마지막 실제 사용과 Vec 재할당 가능성을 분리해 설명합니다.
- 인덱스 저장, lock scope, heap allocation처럼 안전성 이후의 의미·비용 경계까지 언급합니다.

## 감점 포인트

- capacity가 충분하면 borrow 충돌이 항상 사라진다거나 주소를 실행 중 검사한다고 말하지 않습니다.
- 개별 원자성이나 컴파일 성공을 복합 상태 일관성·교착 부재로 확대하지 않습니다.

## 더 파고들 거리

- borrow를 index나 generation handle로 바꾸면 논리적 stale reference를 어떻게 검증할까요?
- Vec·Mutex·trait object를 실제 toolchain에서 어떤 최소 컴파일 예제로 확인할까요?

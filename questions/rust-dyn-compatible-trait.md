---
id: rust-dyn-compatible-trait
title: 제네릭 메서드나 Self 반환을 가진 trait을 dyn Trait로 만들 때 왜 제약이 생기나요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-trait-objects-generics-monomorphization
related:
  - java-overload-override
---
# 제네릭 메서드나 Self 반환을 가진 trait을 dyn Trait로 만들 때 왜 제약이 생기나요?

## 구두 답변

`Box<dyn Trait>`는 실행 시 concrete type을 모른 채 vtable의 고정된 호출 규격으로 dispatch합니다. 그런데 `trait Factory { fn make(&self) -> Self; fn convert<T>(&self, x: T) -> T; fn name(&self) -> &'static str; }`에서 `make`는 반환 크기와 구체 타입 identity를 호출자가 알아야 하고, `convert<T>`는 호출마다 임의의 T에 대한 별도 코드를 요구합니다. 이런 메서드는 하나의 일반 vtable 항목으로 만들 수 없어 trait 전체를 `dyn Factory`로 만드는 데 제약이 생깁니다. 객체로 호출할 필요가 없는 메서드라면 `fn make(&self) -> Self where Self: Sized`와 같이 메서드 수준에서 제외할 수 있습니다. 그러면 `Box<dyn Factory>`는 만들 수 있지만 `obj.make()`는 호출할 수 없고, `obj.name()`처럼 dispatchable한 메서드만 사용할 수 있습니다. `Self: Sized`가 generic method를 동적 dispatch로 바꾸는 것은 아니며 단지 해당 method를 trait object 호출 집합에서 빼는 장치입니다. 반환이 필요하면 `Box<dyn Factory>`처럼 크기가 알려진 소유 포인터로 타입을 지우거나, 가능한 구현 집합이 닫혀 있으면 enum을 반환합니다. 반대로 호출자가 구체 타입을 알고 최적화해야 한다면 `fn make<T: Factory>(x: &T) -> T` 같은 generic API가 자연스럽습니다. 현재 Reference는 이 규칙을 dyn compatibility라는 이름으로 설명하므로 목표 toolchain의 Reference와 오류 메시지를 함께 확인해야 합니다. 특히 trait 전체 `Sized` supertrait, dispatchable method의 generic parameter, `Self` 위치, opaque return 같은 조건을 한꺼번에 object-safe 여부로 뭉뚱그리면 안 됩니다.

## 득점 포인트

- vtable 고정 호출 규격과 generic·Self 메서드의 concrete type 요구를 구분합니다.
- 정적·동적 dispatch의 선택을 성능 단정이 아니라 고정 환경 측정과 API 요구로 결정합니다.

## 감점 포인트

- Self: Sized가 금지된 메서드를 동적 호출 가능하게 만든다고 설명하지 않습니다.
- vtable, enum, opaque type의 표현 차이를 단순히 “빠르다/느리다”로 결론내리지 않습니다.

## 더 파고들 거리

- associated type과 Self 제약이 dyn compatibility 판정을 어떻게 바꿀까요?
- Vec·Mutex·trait object를 실제 toolchain에서 어떤 최소 컴파일 예제로 확인할까요?

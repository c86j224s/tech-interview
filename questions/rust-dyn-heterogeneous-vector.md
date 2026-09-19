---
id: rust-dyn-heterogeneous-vector
title: 서로 다른 구현을 하나의 Vec에 담을 때 Box<dyn Trait>과 Vec<T>는 어떤 차이가 있나요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-trait-objects-generics-monomorphization
related:
  - java-overload-override
---
# 서로 다른 구현을 하나의 Vec에 담을 때 Box<dyn Trait>과 Vec<T>는 어떤 차이가 있나요?

## 구두 답변

`Vec<T>`는 원소마다 같은 concrete type, 크기, 정렬 규칙을 전제로 연속 메모리를 관리합니다. 따라서 `Text(String)`와 `Number(i32)`를 `Vec<T>`에 직접 섞을 수 없고, trait bound를 `T: Render`로 적는 것만으로 서로 다른 T가 합쳐지지 않습니다. 런타임에 서로 다른 구현을 한 목록으로 소유하려면 `Vec<Box<dyn Render>>`를 사용합니다. 각 `Box`는 heap의 실제 객체를 소유하고, 벡터에는 일정 크기의 trait-object 포인터가 들어갑니다. 이 포인터는 데이터 주소와 vtable 주소를 가진 fat pointer로 생각할 수 있으며 `render()` 호출은 vtable 경로를 통해 선택됩니다. 설명용 상태는 `items[0] → heap Text("hello")`, `items[1] → heap Number(42)`이고, 순회 결과는 삽입 순서대로 `hello`, `42`입니다. 대가는 객체별 allocation, 포인터 추적, 간접 호출, 분산된 저장으로 인한 locality 저하입니다. `Vec<&dyn Render>`는 heap 소유를 없앨 수 있지만 원본 `Text`와 `Number`가 벡터보다 오래 살아야 하고, 벡터가 객체를 반환하거나 비동기 작업에 보관할 수 없습니다. 구현 종류가 닫혀 있다면 `enum Shape { Text(Text), Number(Number) }`와 `Vec<Shape>`가 allocation과 vtable을 피하고 `match`의 누락을 컴파일러가 드러내는 장점이 있습니다. 외부 plugin이나 런타임 등록처럼 열린 집합이면 Box가 맞습니다. `Arc<dyn Render + Send + Sync>`로 공유 범위를 넓힐 때는 trait object 자체에도 스레드 조건이 필요해 표현 비용과 안전성 조건이 함께 증가합니다.

## 득점 포인트

- Vec의 homogeneous layout, Box trait object의 fat pointer와 enum의 폐쇄 집합을 비교합니다.
- 인덱스 저장, lock scope, heap allocation처럼 안전성 이후의 의미·비용 경계까지 언급합니다.

## 감점 포인트

- trait bound만으로 Vec에 서로 다른 T가 들어가거나 Box가 allocation 비용을 없앤다고 하지 않습니다.
- vtable, enum, opaque type의 표현 차이를 단순히 “빠르다/느리다”로 결론내리지 않습니다.

## 더 파고들 거리

- trait object를 Send·Sync 경계와 함께 반환할 때 lifetime·allocation을 어떻게 문서화할까요?
- API 경계가 바뀔 때 Send·Sync 또는 정적·동적 dispatch 요구를 어떻게 재검증할까요?

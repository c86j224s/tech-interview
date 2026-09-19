---
id: rust-generic-code-size
title: 제네릭 함수에 많은 타입을 사용하자 실행 파일이 커집니다. monomorphization의 비용과 이점은 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - rust-trait-objects-generics-monomorphization
related:
  - java-overload-override
---
# 제네릭 함수에 많은 타입을 사용하자 실행 파일이 커집니다. monomorphization의 비용과 이점은 무엇인가요?

## 구두 답변

제네릭 `fn show<T: Render>(x: &T)`를 `Text`와 `Number`에 호출하면 컴파일러는 설명상 `show::<Text>`와 `show::<Number>`라는 타입별 인스턴스를 만들 수 있습니다. 이를 monomorphization이라고 하며 각 필드와 구현을 구체적으로 알 수 있어 인라이닝, 분기 제거, 간접 호출 감소의 기회를 줍니다. 대신 큰 함수가 100개 타입에 적용되면 컴파일러가 분석·최적화할 코드 경로가 늘고, 최종 코드가 중복되어 instruction cache와 바이너리 크기에 부담을 줄 수 있습니다. 예를 들어 공통 helper가 0.5KB, 타입별 전용 코드가 1KB이고 세 타입이 모두 실제 호출된다는 가정이면 설명용 합계는 `0.5 + 3×1 = 3.5KB`입니다. 이것은 측정값이 아닙니다. 최적화 수준, 인라이닝, LTO, linker의 중복 제거로 최종 크기는 달라지며 “타입 수만큼 항상 완전히 복제된다”거나 “제네릭은 무조건 빠르다”고 단정할 수 없습니다. 재현 가능한 비교를 하려면 동일 target과 toolchain에서 `cargo build --release`를 고정하고 `opt-level`, LTO, panic strategy를 같은 값으로 둔 뒤 한 타입 호출·두 타입 호출·`dyn` 버전을 각각 `size`나 linker map으로 비교해야 합니다. 런타임 plugin처럼 구현이 열린 목록이면 `Box<dyn Render>`가 공통 호출 경로를 공유해 코드 복제를 줄일 수 있지만, vtable 간접 호출과 heap allocation을 지불합니다. 따라서 hot path의 호출 비용과 배포 크기 중 어떤 제약이 우선인지 측정으로 결정합니다.

호출 그래프를 구체화하면 `main → show::<Text>`, `main → show::<Number>`라는 두 정적 경로가 생기고, 각 경로에서 `render`의 concrete 구현을 바로 연결할 수 있습니다. `dyn Render` 버전은 하나의 `show_dyn` 경로가 vtable을 거치지만 객체 생성과 호출 간접성이 남습니다. 따라서 코드 영역만 줄어드는 선택이 실행 시간·메모리 locality에서 이득이라는 뜻은 아니며, 배포 크기와 hot path latency를 별도 지표로 측정해야 합니다.

## 득점 포인트

- monomorphization의 전문화 이점과 코드 크기·컴파일 비용을 측정 조건과 함께 설명합니다.
- 정적·동적 dispatch의 선택을 성능 단정이 아니라 고정 환경 측정과 API 요구로 결정합니다.

## 감점 포인트

- generic 인스턴스 수와 최종 바이너리 바이트를 동일시하거나 dyn이 항상 더 빠르다고 하지 않습니다.
- vtable, enum, opaque type의 표현 차이를 단순히 “빠르다/느리다”로 결론내리지 않습니다.

## 더 파고들 거리

- LTO와 linker map이 generic 코드 중복 관찰을 어떻게 바꿀까요?
- API 경계가 바뀔 때 Send·Sync 또는 정적·동적 dispatch 요구를 어떻게 재검증할까요?

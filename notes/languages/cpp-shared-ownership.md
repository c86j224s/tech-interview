---
id: cpp-shared-ownership
title: Shared Pointer의 수명·필드·논리 세대
topic: 언어·런타임
summary: 제어 블록·포인터 변수·대상 필드의 동기화를 분리하고 weak 관찰·순환·불변 snapshot·다중 writer·소멸 위치를 설명합니다.
questionIds: [cpp-shared-pointer-lifetime, cpp-weak-pointer-cycle, weak-lock-logical-generation, atomic-shared-pointer-snapshot]
---

# Shared Pointer의 수명·필드·논리 세대

## 객체 수명과 count 증가의 동시성

두 콜백이 각자의 shared_ptr 복사본으로 같은 객체를 소유하면 콜백 동안 객체의 강한 참조가 유지됩니다. 그러나 둘이 동시에 일반 정수 count를 증가시키면 데이터 레이스가 될 수 있습니다. 참조 카운트의 동기화는 대상 객체의 필드 접근까지 보호하지 않습니다.

같은 shared_ptr 변수 하나를 여러 스레드가 읽고 교체하는 경우도 별도입니다. 서로 다른 shared_ptr 인스턴스의 제어 블록 공유와 같은 변수에 대한 동시 변경을 혼동하면 안 됩니다.

## 제어 블록·루트 포인터·대상 객체의 안전성

| 층 | 보호할 것 | 가능한 수단 |
| --- | --- | --- |
| 제어 블록 | 강한·약한 참조 수명 | shared_ptr의 규정된 소유 연산 |
| 루트 포인터 변수 | 같은 변수의 동시 읽기·교체 | mutex 또는 C++20 atomic shared_ptr |
| 대상 객체 | 복합 필드 불변식·변경 순서 | mutex·직렬 소유·깊은 불변 snapshot |

소유자가 하나라면 unique_ptr가 더 명확할 수 있습니다. 실제로 여러 비동기 작업이 함께 수명을 유지해야 할 때 shared_ptr를 선택합니다. raw pointer 하나에서 shared_ptr 두 개를 각각 새로 만들면 서로 다른 제어 블록이 같은 객체를 삭제할 수 있습니다.

이미 공유 소유된 this를 또 `shared_ptr(this)`로 감싸지 않고 enable_shared_from_this의 준비된 소유 계약을 따릅니다. 생성자에서 공유 소유가 아직 형성되기 전 shared_from_this를 호출하는 것도 일반적인 안전 패턴이 아닙니다.

## Weak reference의 비소유 관찰

부모가 자식을 강하게 소유하고 자식이 부모를 단지 관찰한다면 역참조에 weak_ptr를 둘 수 있습니다. 둘 다 강하게 소유하면 외부 참조가 사라져도 순환 내부의 강한 수가 남습니다. 객체가 저장한 callback이 다시 객체를 shared_ptr로 캡처하는 고리도 같은 문제입니다.

```diagram
{"title":"소유 방향과 관찰 방향을 분리합니다","caption":"아래로 향하는 화살표는 강한 소유, 바깥으로 돌아가는 화살표는 약한 관찰입니다. weak lock이 성공한 동안만 임시 강한 참조로 사용합니다.","rows":[[{"id":"parent","label":"부모 객체"}],[{"id":"child","label":"자식 객체"}]],"edges":[{"from":"parent","to":"child","label":"shared 또는 unique 소유"},{"from":"child","to":"parent","label":"weak 관찰"}]}
```

`expired()`를 확인한 뒤 별도 raw pointer로 접근하면 그 사이 객체가 소멸할 수 있습니다. `lock()`으로 강한 참조를 얻어 성공한 범위에서 사용합니다. 실패는 대상이 사라져도 되는 관찰 관계의 정상 결과로 처리합니다. 반드시 완료해야 할 결제·저장 작업을 화면 객체의 약한 참조에만 맡기면 화면 종료와 함께 일을 잃을 수 있으므로 별도 작업 소유자가 필요합니다.

## 객체 수명과 결과 적용 세대

작업 세대 7의 callback이 weak lock에 성공했지만 객체는 이미 세대 8의 요청을 처리 중일 수 있습니다. 메모리는 살아 있어도 세대 7 결과를 덮어쓰면 안 됩니다.

```text
owner = weak.lock()
if owner is absent: release_callback_resources_and_return
with owner.state_lock:
    if owner.stopping or owner.generation != callback.generation:
        ignore_result
    else:
        apply_result_to_current_state
```

callback이 세대 7인지 확인한 뒤 `state_lock`을 풀고 결과를 적용하면, 그 사이 세대 8이 시작되거나 객체가 stopping 상태가 될 수 있습니다. 그러면 callback은 살아 있는 객체에 접근하더라도 현재 요청에 속하지 않는 결과를 덮어쓸 수 있습니다. 세대 검사와 상태 변경을 같은 동기화 경계에서 수행하고, 세대 번호는 논리 권한만 판정하게 합니다. 객체가 이미 해제된 포인터를 읽는 문제는 세대 번호로 고칠 수 없으므로 먼저 `weak.lock()`과 수명 계약을 지켜야 합니다.

## Atomic root와 완성된 불변 snapshot 게시

C++20의 `std::atomic<std::shared_ptr<const State>>`에 완전히 초기화한 State를 release로 store하고 독자가 acquire로 load하는 모형을 생각할 수 있습니다. 독자는 한 번 load한 지역 소유 참조로 관련 필드를 모두 읽습니다. 필드마다 루트를 다시 읽으면 version 7의 routes와 version 8의 index를 조합할 수 있습니다.

const State라도 내부가 다른 가변 객체를 가리키거나 다른 별칭에서 수정할 수 있으면 깊은 불변성이 아닙니다. 게시 뒤 필요한 전체 데이터가 바뀌지 않는 소유 모델을 지켜야 합니다. atomic shared_ptr가 lock-free라는 보장도 없으므로 비용을 측정합니다.

두 writer가 같은 옛 루트에서 각자 새 상태를 만들어 store하면 뒤 writer가 앞 변경을 잃게 할 수 있습니다. CAS가 실패하면 새 현재 루트에서 재계산하거나 writer를 직렬화합니다. 포인터 교체의 원자성과 read-modify-write의 업무 원자성은 다릅니다.

## 마지막 소유자 스레드와 소멸 비용

마지막 강한 참조가 사라지는 스레드에서 소멸자가 실행될 수 있습니다. 무거운 소멸이나 특정 executor 전용 자원이 있으면 수명·deleter·종료 순서를 설계합니다. 다른 executor에 정리 작업을 보내려면 그 executor가 실제 정리를 끝낼 때까지 살아 있어야 합니다.

make_shared처럼 객체와 제어 블록을 함께 할당하는 경우 객체 소멸 뒤에도 약한 참조가 제어 블록의 할당을 유지해 저장 공간 반환이 늦어질 수 있습니다. aliasing shared_ptr는 저장 포인터와 소유 객체가 다를 수 있어 get 주소만으로 소유 수명을 추측하지 않습니다.

## 소멸 횟수·상태 세대·동시 변경 검증

외부 참조 제거·순환 해제·weak lock과 소멸 경쟁을 테스트하고 객체 소멸이 한 번인지 확인합니다. 세대 7 callback을 멈춘 뒤 8을 시작해 옛 결과가 적용되지 않는지도 봅니다. snapshot 독자는 한 버전의 불변식만 관찰해야 하고 다중 writer 변경은 정책대로 보존되어야 합니다.

ASan·TSan은 도움이 되지만 모든 논리 세대 오류나 메모리 모델 실행을 증명하지 않습니다. `scripts/verify-cpp-study.cpp`의 weak lock·마지막 강한 참조 수명 예제는 Apple Clang 21.0.0, C++20, ASan·UBSan에서 통과했습니다. 현재 Apple 표준 라이브러리는 `__cpp_lib_atomic_shared_ptr`를 제공하지 않아 atomic shared_ptr 예제의 최초 컴파일은 실패했고, 기능 검사 뒤 해당 부분을 명시적으로 SKIP했습니다. 다른 실행으로 대체해 atomic snapshot을 검증했다고 보고하지 않습니다. 다중 스레드 경쟁·세대 검사·순환 회수는 별도 검증 대상입니다.

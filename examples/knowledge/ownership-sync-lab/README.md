# 소유권과 동기화 실습

이 실습은 C++17에서 다음 네 가지 경계를 실행 가능한 작은 예제로 확인합니다.

- `shared_ptr` 순환을 `weak_ptr::lock()`으로 관찰하고, 임시 strong 소유 구간에서 순환을 끊습니다.
- 용량이 고정된 큐에서 `mutex`와 `condition_variable`을 사용해 drain 종료, cancel 종료, 대기 중 생산자 해제를 확인합니다.
- C++20 `latch`나 `barrier`에 의존하지 않는 `CountDownLatch`로 시험 순서를 고정합니다.
- strong count, weak count, 객체 소멸, control block 회수를 상태 모델로 추적하고, 주소만 비교하는 ABA 반례를 세대 번호와 함께 기록합니다.

이 코드는 hazard pointer, epoch reclamation, lock-free queue 또는 production-grade cancellation framework가 아닙니다. ABA 함수는 실제 lock-free 자료구조가 아니라 주소와 세대의 상태 반례만 표현합니다. 객체 필드의 복합 상태를 shared pointer count가 보호하지 않는다는 점도 별도 설계 대상입니다.

## 실행 환경

필요한 것은 C++17 컴파일러와 POSIX 스레드 런타임입니다. 외부 패키지, 네트워크, 서비스, 자격 증명은 필요하지 않습니다. 이 패키지는 macOS에서 Apple Clang 21.0.0으로 확인할 수 있고, 다른 C++17 구현에서는 표준 라이브러리와 sanitizer 지원 여부를 먼저 확인해야 합니다.

저장소 루트에서 실행합니다.

```sh
cd examples/knowledge/ownership-sync-lab
sh build.sh
./ownership-sync-lab
```

정상 결과는 다음 네 줄과 마지막 집계 줄입니다.

```text
PASS cycle-and-weak-lock
PASS bounded-queue-drain-and-cancel
PASS refcount-state-model
PASS aba-state-trace (illustrative; no lock-free structure)
PASS all
```

## AddressSanitizer와 UndefinedBehaviorSanitizer

```sh
cd examples/knowledge/ownership-sync-lab
SANITIZER=address sh run-sanitizers.sh
```

이 명령은 `-fsanitize=address,undefined`로 별도 실행 파일을 만들고 중단 시 즉시 진단하도록 실행합니다. Apple Clang의 Darwin runtime에서는 `detect_leaks` 옵션을 사용하지 않습니다. 성공하면 위의 PASS 출력이 나오며 sanitizer 진단이 없어야 합니다. 이는 이 실행 경로의 메모리 오류 부재를 확인하는 것이지, 모든 허용된 C++ 메모리 순서나 향후 코드 변경을 증명하지는 않습니다.

## ThreadSanitizer

```sh
cd examples/knowledge/ownership-sync-lab
SANITIZER=thread sh run-sanitizers.sh
```

ThreadSanitizer가 설치·지원되지 않는 툴체인에서는 컴파일 또는 실행이 실패할 수 있습니다. 그 경우 실패 출력과 컴파일러 버전을 기록하고, “미실행”으로 보고합니다. sanitizer는 교착, 기아, 논리적 세대 오류, lock-free 회수의 완전한 증명을 제공하지 않습니다.

## 상태 추적

참조 카운트 모델의 초기 상태는 `strong=1`, `weak=1`입니다. 여기서 `weak` 하나는 strong owner가 유지하는 암묵적 control-block 수명입니다.

1. 외부 weak observer를 추가하면 `strong=1, weak=2`입니다.
2. `lock_weak()`이 성공하면 `strong=2`가 됩니다. 이미 strong이 0이면 실패하고 count를 되살리지 않습니다.
3. 두 strong을 차례로 놓으면 두 번째 release에서 객체가 소멸합니다. 암묵적 weak 하나도 함께 놓이므로 외부 weak 때문에 `weak=1`이 남습니다.
4. 외부 weak를 놓으면 `weak=0`이 되고 control block을 회수합니다.

`expired()`와 raw pointer의 시간차를 이 코드의 성공 경로로 바꾸지 않았습니다. 실제 C++ API에서는 `weak_ptr::lock()`이 성공한 반환값을 지역 `shared_ptr`로 보유한 동안만 객체를 사용해야 합니다.

## 실패 주입과 진단

### 순환을 끊지 않는 경우

`test_cycle_and_weak_lock()`의 두 `child.reset()` 호출을 임시로 제거하면 외부 strong owner를 놓아도 두 노드가 서로를 strong으로 보유하므로 `live_count`가 2로 남습니다. 실패 지점은 마지막 `assert(CycleNode::live_count.load() == 0)`입니다. 해결은 소유 방향을 한쪽만 strong으로 두고 역방향은 weak으로 만들거나, 수명 종료 시점에 강한 고리를 명시적으로 끊는 것입니다. 실제 제품 코드에서는 임시 복구자가 cycle을 끊는 구조보다 소유 그래프 자체를 단순하게 만드는 편이 우선입니다.

### `if` 대기로 바꾸는 경우

`BoundedQueue::pop()`의 predicate wait를 `if`로 바꾸거나, `closed_`·`cancelled_` 상태를 mutex 밖에서 읽도록 옮기면 허위 깨움, 다른 소비자 선점, 종료 알림에서 빈 큐 처리 오류가 생깁니다. 소비자는 깨움이 작업 배정이라는 가정을 하지 말고 mutex 아래 predicate를 다시 판정해야 합니다. 종료자는 상태를 먼저 기록하고 모든 waiter를 깨운 뒤, 호출자들이 반환한 것을 확인하고 객체를 파괴해야 합니다.

### 종료 전에 동기화 객체를 파괴하는 경우

`close()` 직후 큐 객체를 파괴하도록 바꾸면 아직 `wait()` 중인 스레드가 condition variable 또는 mutex를 참조할 수 있습니다. 이 실습의 `producer.join()`과 소비 결과 확인은 teardown 전에 모든 waiter를 회수하는 의도적인 경계입니다. `notify_all()`만 호출한 것은 종료 완료 확인이 아닙니다.

### 주소만 비교하는 CAS를 믿는 경우

ABA 상태는 `old_a → b → new_a`에서 처음과 마지막 주소가 같지만 중간 `b`는 다른 주소인 상황입니다. 주소만 비교하면 CAS가 오래된 논리 세대에서도 성공할 수 있습니다. generation 태그는 논리 재사용을 감지하는 보조 수단일 뿐, reader가 이미 해제된 노드의 필드를 읽는 수명을 보호하지 않습니다. 실제 lock-free 자료구조에는 검증된 hazard pointer, epoch 또는 동등한 회수 계약이 필요합니다. 이 패키지는 unsound hand-rolled lock-free 구현을 의도적으로 포함하지 않습니다.

## 검증 범위

이 패키지의 실행은 C++17 표준 library의 `shared_ptr`, `weak_ptr`, mutex, condition variable과 이 환경의 compiler/runtime 조합에서 기본 불변식과 teardown을 확인합니다. C++ Working Draft나 POSIX 문서의 모든 구현 세부, 특정 allocator의 lock-free 진행성, weak atomic specialization, hazard/epoch의 memory-order proof는 검증하지 않습니다. 큐는 정수 payload와 한정된 테스트 스레드만 다루며, bounded backpressure API의 모든 운영 정책이나 외부 I/O 취소를 다루지 않습니다.

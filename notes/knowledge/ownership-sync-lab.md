---
id: ownership-sync-lab
title: C++ 소유권과 동기화 실습
topic: 동시성
summary: C++17에서 shared·weak 순환, 종료 가능한 bounded queue, 결정적 대기 순서, 참조 카운트 상태와 ABA의 경계를 직접 실행합니다.
questionIds: []
prerequisites: [reference-counting-foundations, synchronization-foundations]
related: [concurrent-ownership, cpp-shared-ownership, condition-variables, safe-reclamation, cancellation]
reviewedAt: '2026-09-18'
---

# C++ 소유권과 동기화 실습

## 학습 목표

이 실습의 핵심은 “원자적이면 모두 안전하다”는 문장을 네 개의 검증 가능한 경계로 나누는 것입니다.

- `shared_ptr`의 strong 소유와 `weak_ptr`의 비소유 관찰을 구분하고, strong cycle이 객체 회수를 막는 순서를 확인합니다.
- bounded queue의 `items`, `closed`, `cancelled` 불변식을 하나의 mutex 아래 두고, condition variable 알림을 작업 배정이 아니라 predicate 재검사 기회로 다룹니다.
- C++20 `latch`·`barrier`를 가정하지 않고 C++17의 mutex와 condition variable만으로 경쟁 시험의 출발 순서를 고정합니다.
- control block의 strong/weak count 상태를 추적한 뒤, 주소 재사용 ABA가 왜 refcount나 세대 태그 하나로 자동 해결되지 않는지 설명합니다.

실행 코드는 `examples/knowledge/ownership-sync-lab/`에 있습니다. 노트의 canonical 링크는 `/tech-interview/notes/ownership-sync-lab/`입니다.

## 기본 모델

### 소유 그래프

객체를 노드, 객체 수명을 연장하는 참조를 strong edge, 수명을 연장하지 않는 관찰을 weak edge로 그립니다. strong edge가 하나라도 남아 있으면 객체는 회수 대상이 아닙니다. `weak_ptr` 자체는 객체를 살려 두지 않지만 control block을 관찰할 수 있게 하며, `lock()`이 성공하면 그 반환값이 임시 strong owner가 됩니다.

부모와 자식이 `parent -> child`, `child -> parent`를 모두 strong으로 가지면 외부 root가 사라져도 cycle 내부의 strong count가 0이 되지 않습니다. 따라서 이 실습은 방향을 한쪽만 strong으로 두는 일반적인 설계와, 교육을 위해 만든 cycle을 임시 strong owner로 연 뒤 두 strong edge를 끊는 절차를 모두 보여 줍니다. 반드시 유지해야 하는 작업은 화면 객체의 weak 참조 하나에만 맡기지 않고 서비스나 작업 객체가 별도 strong owner가 되어야 합니다.

### Control block 상태

`shared_ptr`와 `weak_ptr`를 두 개의 독립적인 정수로만 설명하면 마지막 소유자와 마지막 관찰자의 책임이 섞입니다. 이 실습의 상태 모델은 다음과 같습니다.

| 상태 | strong count | weak count | 의미 |
| --- | ---: | ---: | --- |
| 초기 소유 | 1 | 1 | strong owner와 암묵적 weak control-block owner |
| 외부 weak 추가 | 1 | 2 | 객체는 살아 있고 observer가 control block을 붙잡음 |
| weak lock 성공 | 2 | 2 | 조건부 승격이 strong count를 증가시킴 |
| 마지막 strong release | 0 | 1 | 객체 destructor 실행, 암묵적 weak owner 해제 |
| 마지막 weak release | 0 | 0 | control block 회수 가능 |

`weak_ptr::lock()`은 이미 control block에 연결된 weak 참조가 있을 때 “살아 있으면 strong을 확보하고, 아니면 실패”를 조건부로 수행하는 API입니다. `expired()`를 읽고 raw pointer를 나중에 사용하는 패턴은 이 원자적 승격을 대체하지 않습니다. lock 성공 여부만 확인하고 반환된 strong owner를 곧바로 버리는 것도 안전한 사용 구간을 만들지 못합니다.

### 큐 상태

큐의 `items`, `closed`, `cancelled`는 같은 mutex가 보호하는 하나의 상태입니다. 소비자가 기다릴 수 있는 조건은 `items.empty() && !closed && !cancelled`입니다. 소비자는 다음 상태가 참이 될 때까지 기다리지만, 깨어난 이유가 알림인지 허위 깨움인지 또는 다른 소비자의 선점인지 알 수 없으므로 항상 predicate를 다시 계산합니다.

이 패키지의 두 종료 정책은 다릅니다.

- **Drain**: 새 삽입을 거절하고 기존 항목을 모두 소비한 다음 빈 큐에서 `closed`를 반환합니다.
- **Cancel**: 새 삽입을 거절하고 대기 항목을 반환 가능한 취소 목록으로 분리하며, 소비자에게 `cancelled`를 반환합니다.

`notify_all()`은 waiter에게 상태를 다시 볼 기회를 주는 일이지, 스레드가 모두 끝났다는 증명이 아닙니다. 큐를 파괴하려면 새 호출을 차단하고, waiter와 producer를 join한 뒤, 외부 callback이나 payload owner가 끝난 것을 확인해야 합니다.

```diagram
{"title":"소유권과 종료 경계","caption":"strong·weak 수명과 큐 종료의 상태 전이를 한 모델에 겹치지 않고 나란히 확인합니다.","rows":[[{"id":"strong","label":"strong 소유","detail":["객체 사용 가능","count 증가·감소"]},{"id":"weak","label":"weak 관찰","detail":["수명 연장 안 함","lock 성공 시 임시 strong"]}],[{"id":"object","label":"객체 소멸","detail":["strong=0","destructor 실행"]},{"id":"control","label":"control block 유지","detail":["weak observer 보유","마지막 weak까지 생존"]}],[{"id":"queued","label":"bounded queue","detail":["capacity 상한","mutex 보호"]},{"id":"closed","label":"종료 상태","detail":["새 입력 거절","waiter 재검사"]}],[{"id":"drain","label":"drain 완료","detail":["기존 항목 소비","빈 큐에서 closed"]},{"id":"cancel","label":"cancel 완료","detail":["대기 항목 분리","소비자 cancelled"]}]],"edges":[{"from":"weak","to":"strong","label":"lock 성공"},{"from":"strong","to":"object","label":"마지막 release"},{"from":"object","to":"control","label":"weak가 남으면 유지"},{"from":"queued","to":"closed","label":"close 아래 상태 변경"},{"from":"closed","to":"drain","label":"기존 작업 소진"},{"from":"closed","to":"cancel","label":"남은 작업 분리"}]}
```

## 실행 구조

`main.cpp`의 `test_cycle_and_weak_lock()`은 먼저 두 객체의 strong cycle을 구성하고, weak 관찰에서 `lock()`으로 얻은 지역 strong owner가 있는 동안 두 `child` edge를 끊습니다. 지역 owner가 모두 사라진 뒤 `live_count`가 0이 되는지 확인합니다. 이어서 한 reader가 `weak_ptr`의 승격을 기다리는 동안 소유자가 살아 있는 경우와 마지막 strong release 뒤의 실패를 각각 확인합니다. 이 테스트는 thread timing을 수면 시간에 맡기지 않고 `CountDownLatch`로 진입과 진행을 분리합니다.

`CountDownLatch`는 `count_`를 mutex로 보호하고 0이 될 때 모든 waiter를 깨웁니다. count를 0보다 작게 내리는 호출은 assertion으로 잘못된 테스트 자체를 드러냅니다. 이는 `std::latch`의 대체 구현을 제품에 제공하는 코드가 아니라, C++17 실습에서 “이 스레드가 다음 단계로 가기 전에 저 스레드가 진입했다”는 순서를 고정하는 최소 장치입니다.

`BoundedQueue<T>`는 `try_push`, `push_wait`, `pop`, `close` 네 경계를 제공합니다. 이 실습에서는 producer가 full queue에서 대기한 뒤 `close(kDrain)`에 의해 거절되는 경로를 고정하고, 별도 queue에서는 `close(kCancel)`이 남은 payload를 반환하는지 확인합니다. `pop`은 `unique_lock`과 predicate wait를 사용하고, 큐에서 payload를 꺼낸 뒤의 처리는 잠금 밖에서 수행할 수 있는 형태입니다.

`RefcountModel`은 실제 `shared_ptr` 구현을 재구현하지 않습니다. 강한 소유와 control-block observer의 숫자 상태를 작게 모델링해 “객체가 소멸했지만 control block은 남는” 구간을 눈으로 확인하는 교육용 상태 기계입니다. `test_aba_counterexample()`도 같은 제한을 둡니다. `old_a`와 `new_a`가 같은 주소를, 중간 상태 `b`는 다른 주소를 가리키는 추상 상태를 만들 뿐, 해제된 객체를 역참조하거나 unsound lock-free 스택을 실행하지 않습니다.

## 실행 절차

저장소 루트에서 실행합니다.

```sh
cd examples/knowledge/ownership-sync-lab
sh build.sh
./ownership-sync-lab
```

정상 실행에서 기대하는 결과는 다음과 같습니다.

```text
PASS cycle-and-weak-lock
PASS bounded-queue-drain-and-cancel
PASS refcount-state-model
PASS aba-state-trace (illustrative; no lock-free structure)
PASS all
```

기본 build는 `-std=c++17 -Wall -Wextra -Wpedantic -Wconversion -Wshadow -O2`를 사용합니다. 외부 의존성은 없고, 실행 파일은 패키지 디렉터리에 만들어집니다. 모든 thread는 join되며, queue의 waiter는 close 후 깨워지고, 반환된 discarded payload는 로컬 vector가 소유한 뒤 scope 종료 시 정리됩니다.

AddressSanitizer와 UndefinedBehaviorSanitizer는 다음 명령으로 실행합니다.

```sh
cd examples/knowledge/ownership-sync-lab
SANITIZER=address sh run-sanitizers.sh
```

ThreadSanitizer는 다음 명령으로 별도 실행합니다.

```sh
cd examples/knowledge/ownership-sync-lab
SANITIZER=thread sh run-sanitizers.sh
```

스크립트는 `CXX` 환경 변수로 컴파일러를 바꿀 수 있습니다. Apple Clang의 Darwin runtime에서는 LeakSanitizer `detect_leaks` 옵션을 사용하지 않습니다. sanitizer가 지원되지 않는 환경에서 컴파일 실패나 실행 불가가 발생하면 그 출력은 `NOT_RUN`으로 기록해야 합니다. sanitizer 성공은 이 소스의 실제 경로에서 보고된 오류가 없다는 의미이지 모든 스케줄, allocator, 표준 라이브러리 구현, memory order를 증명하는 의미가 아닙니다.

## 실패 주입

### Strong cycle 잔존

두 `child.reset()`을 모두 삭제하면 두 객체가 서로를 strong으로 보유한 채 남습니다. 하나만 남겨도 순환의 한 간선이 끊어지므로 외부 임시 소유자 해제 후 두 객체를 회수할 수 있습니다. 외부 weak observer의 `expired()` assertion이 실패하고 `live_count`도 0이 되지 않습니다. 이 실패는 count 연산이 틀려서가 아니라 소유 그래프에 회수 불가능한 strong cycle이 남았기 때문입니다. 해법은 역방향을 weak으로 바꾸거나, cycle이 반드시 필요한 경우 명시적 graph teardown을 소유자의 종료 계약에 넣는 것입니다.

### `expired()`와 raw pointer 사이의 경쟁

다음과 같은 패턴을 실제 코드에 추가하면 안전하지 않습니다.

```cpp
auto raw = observer.expired() ? nullptr : observer.lock().get();
// lock()에서 나온 임시 shared_ptr가 끝난 뒤 raw를 사용하면 수명 보장이 없음
```

정확한 형태는 `auto owner = observer.lock(); if (owner) { use(*owner); }`이며, `owner`가 사용 범위를 끝까지 소유해야 합니다. 이미 raw pointer만 가진 자료구조라면 strong count를 나중에 증가시키는 식으로 고칠 수 없고, 먼저 hazard·epoch·잠금과 같은 검증된 수명 보호를 선택해야 합니다.

### `if` 대기와 알림 유실

`not_empty_.wait(lock, predicate)`를 수동 `if` 검사와 단발 `wait`로 바꾸면 다른 consumer의 선점, 허위 깨움, close 알림에서 빈 큐 처리 오류가 발생합니다. 진단은 waiter 수, queue size, `closed`·`cancelled` 상태, 각 payload의 accepted/discarded/consumed 상태를 함께 기록하는 방식으로 시작합니다. 알림 횟수가 처리 횟수와 같은지를 불변식으로 사용하지 말고, 수락된 각 항목이 정확히 한 번 소비되거나 정책에 따라 정확히 한 번 분리되는지를 확인합니다.

### Teardown 조기 실행

`producer.join()` 전에 queue를 파괴하거나, 소비자가 반환하기 전에 condition variable을 파괴하면 동기화 객체 수명이 끝난 뒤 waiter가 접근할 수 있습니다. `close()`는 새 입력과 대기 상태의 predicate를 바꾸고 waiter를 깨울 뿐입니다. 모든 생산자·소비자를 join한 뒤에만 queue와 latch의 수명을 끝냅니다. 외부 callback을 추가할 때는 callback을 mutex 아래 실행하지 않고, callback이 재진입할 경우의 대기 그래프도 별도로 확인합니다.

### ABA를 세대 태그만으로 해결

주소만 비교하는 CAS는 `old_a → b → new_a`에서 `old_a.address == new_a.address`가 되어 오래된 관찰자의 비교가 성공할 수 있습니다. generation 태그를 함께 비교하면 논리 세대를 구별하는 데 도움이 되지만, reader가 태그를 확인하기 전에 노드가 해제된 문제를 해결하지 않습니다. 이 실습은 실제 lock-free 코드를 제공하지 않으므로, production 자료구조에 이 상태 추적을 복사하는 대신 검증된 reclamation 구현과 allocator 계약을 추가해야 합니다.

## 진단 기준

실패한 기본 실행은 먼저 assertion 위치와 마지막 PASS 줄을 확인합니다. cycle 시험에서 `live_count`가 남으면 strong graph를, weak lock 시험에서 마지막 승격이 성공하면 owner scope와 release 순서를, queue 시험에서 producer가 수락되거나 closed pop이 나오지 않으면 close가 mutex 아래 상태를 바꾸고 waiter를 깨웠는지를 확인합니다.

AddressSanitizer는 use-after-free·double-free·일부 leak을 찾는 데 유용하고, UndefinedBehaviorSanitizer는 선택된 undefined behavior를 보조적으로 찾습니다. ThreadSanitizer는 이 실행에서 관찰 가능한 data race를 찾는 데 도움을 주지만, 논리적으로 오래된 결과 적용, starvation, deadlock, 특정 스케줄 부재를 모두 증명하지는 않습니다. ThreadSanitizer 자체가 Apple arm64 환경에서 지원되지 않는다면 실행하지 못한 사실을 성공으로 바꾸지 않습니다.

경쟁을 재현할 때는 임의 sleep을 늘리는 대신 latch 지점을 추가합니다. 예를 들어 producer가 full queue의 `push_wait`에 등록한 직후 close를 실행하고, close가 producer를 깨운 뒤 join하는 순서를 기록합니다. shared/weak 문제에서는 owner reset 전후에 latch를 두어 `lock()`의 성공 구간과 마지막 release 뒤 실패 구간을 분리합니다. 운영 코드는 이 예제처럼 정수와 몇 개의 thread로 끝나지 않으므로, 실제 서비스에서는 queue byte budget, waiter 수, oldest task, cancellation acknowledgement, destructor 실행 위치도 관찰해야 합니다.

## 생산 경계

이 실습은 다음을 의도적으로 다루지 않습니다.

- 표준 라이브러리의 `atomic<shared_ptr>` 구현 여부나 lock-free 여부
- hazard pointer·epoch reclamation의 memory-order proof와 thread registration
- lock-free queue의 ABA 방지, allocator 재사용, bounded memory reclamation
- 외부 I/O, database transaction, interruptible system call, process shutdown orchestration
- 일반적인 semaphore, read/write lock의 공정성·기아 보장

bounded queue의 shutdown은 메모리 내부의 close/cancel 교육 모델입니다. 외부 작업을 취소했다는 사실과 실제 I/O가 끝났다는 사실은 다르며, 실제 실행 허가를 제한하는 시스템에서는 작업 종료 확인 후 permit을 반환해야 합니다. 마지막 `shared_ptr` release가 무거운 destructor나 blocking cleanup을 실행할 수 있으므로, 이 예제의 짧은 destructor를 운영 보장으로 확대하지 않습니다. 핵심 CAS가 없다면 전체 API를 lock-free라고 부르지 않으며, 향후 추가되는 회수기·deleter·callback의 blocking을 별도로 판정해야 합니다.

## 검증 범위와 버전

**Stable 범위**는 C++17 언어·표준 라이브러리의 `shared_ptr`, `weak_ptr`, `mutex`, `condition_variable`과 이 소스가 사용하는 기본 thread/join 계약입니다. **Draft 또는 구현 의존 범위**는 C++ Working Draft의 memory-order·progress 설명, C++20 atomic smart pointer specialization, sanitizer의 플랫폼 지원, allocator와 destructor의 진행성입니다. 기존 확인 자료의 C++ Working Draft snapshot은 발행 ISO 판본이나 최신성을 확인한 근거가 아니므로 stable 표준판으로 표시하지 않습니다.

2026-09-18 macOS arm64에서 일반 빌드, ASan·UBSan, TSan 실행을 통과했습니다. 실행하지 못한 sanitizer, 확인하지 않은 다른 플랫폼, 검증하지 않은 lock-free 구현은 모두 별도 unknown 또는 issue로 남깁니다. 이 노트와 코드는 하나의 교육용 lab을 설명할 뿐 모든 공식 C++ 동시성 기능이나 운영 기능을 다룬다고 주장하지 않습니다.

## 참고 자료

- C++ Working Draft `util.smartptr.weak`, <https://eel.is/c++draft/util.smartptr.weak>. 2026-09-17 확인. `weak_ptr::lock()`의 원자적 조건부 승격과 `expired()`의 관찰 한계를 설명하는 데 사용했습니다. Working-draft snapshot이며 발행 판본·최신성은 확인하지 않았습니다.
- C++ Working Draft `atomics.order`, <https://eel.is/c++draft/atomics.order>. 2026-09-17 확인. `memory_order_relaxed`가 memory ordering을 만들지 않는다는 경계에 사용했습니다. Draft 근거입니다.
- C++ Working Draft `thread.condition.condvar`, <https://eel.is/c++draft/thread.condition.condvar>. 2026-09-17 확인. wait의 unlock-and-block 연결과 허위 깨움 가능성을 설명하는 데 사용했습니다. Draft 근거입니다.
- C++ Working Draft `intro.progress`, <https://eel.is/c++draft/intro.progress>. 2026-09-17 확인. lock-free progress가 모든 호출자의 bounded latency가 아니라는 설명에 사용했습니다. Draft 근거이며 이 lab은 lock-free 구현을 제공하지 않습니다.
- Boost.SmartPtr `intrusive_ptr`, <https://www.boost.org/doc/libs/release/libs/smart_ptr/doc/html/smart_ptr.html#intrusive_ptr>. 2026-09-17 확인. intrusive count가 객체 안에 들어가고 hook 구현 책임이 사용자에게 있다는 비교 배경에 사용했습니다. release 문서의 정확한 dependency pin은 이 lab에 적용하지 않았습니다.
- 기존 노트 `concurrent-ownership`, `cpp-shared-ownership`, `condition-variables`, `safe-reclamation`, `cancellation`을 교육 순서와 검증 한계의 선행 자료로 사용했습니다. 이 lab은 해당 노트의 의사코드를 production lock-free 코드로 승격하지 않습니다.

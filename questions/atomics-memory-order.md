---
id: atomics-memory-order
title: "C++에서 결과를 채운 뒤 atomic 준비 플래그를 켭니다. 다른 스레드가 플래그를 보고 결과를 읽으면 항상 안전한가요?"
answerMinutes: 5
followups: [{"id":"lock-free-aba-reclamation","prompt":"원자 포인터의 CAS가 성공해도 노드 수명이 안전하지 않은 이유를 메모리 순서와 어떻게 구분할까요?"},{"id":"condition-variable-predicate","prompt":"atomic 플래그 대신 조건 변수를 쓸 때 predicate 재검사가 필요한 이유는 무엇인가요?"},{"id":"mutex-vs-serial-execution","prompt":"복합 상태 불변식을 원자 변수 여러 개로 표현하기보다 뮤텍스나 순차 실행을 선택할 기준은 무엇인가요?"}]
difficulty: 하
category: 동시성
tags:
  - "원자 연산"
  - "메모리 모델"
  - "가시성"
related: ["mutex-vs-serial-execution"]
---

# C++에서 결과를 채운 뒤 atomic 준비 플래그를 켭니다. 다른 스레드가 플래그를 보고 결과를 읽으면 항상 안전한가요?

## 구두 답변

atomic 변수의 읽기·쓰기가 찢어지지 않는다는 사실만으로 주변 일반 메모리 접근이 안전해지는 것은 아닙니다. 생산자가 결과를 채운 뒤 준비 플래그를 저장하고, 소비자가 그 플래그를 확인한 뒤 결과를 읽으려면 결과 쓰기와 결과 읽기를 연결하는 동기화 관계가 필요합니다. C++에서는 release store와 그 값을 읽는 acquire load가 그 관계를 만들 수 있지만, relaxed만으로는 일반 데이터가 같은 순서와 가시성을 얻는 근거가 없습니다. 이 연결이 메모리 순서와 데이터 공개의 핵심입니다.

### 플래그가 공개 경계가 되는 조건
다음과 같은 한 번 공개하는 구조를 가정하겠습니다.

```cpp
int result = 0;
std::atomic<bool> ready{false};
// 생산자
result = 42;
ready.store(true, std::memory_order_release);
// 소비자
if (ready.load(std::memory_order_acquire)) use(result);
```

소비자가 생산자의 release store가 저장한 true를 acquire load로 읽으면, 그 앞의 `result = 42`가 소비자 뒤의 읽기보다 먼저 보이도록 happens-before 관계가 형성됩니다. 하지만 소비자가 false를 읽은 뒤 result를 읽거나, 다른 플래그의 acquire로 확인하거나, 생산자가 공개 후 result를 다시 수정하면 이 보장은 그대로 적용되지 않습니다. 플래그가 객체 수명을 연장하지도 않으므로 소비자가 결과 객체가 살아 있다는 별도 계약도 필요합니다.

원자 카운터의 `fetch_add`는 증가 자체를 안전하게 만들지만, 카운터와 다른 필드의 불변식을 함께 갱신하는 복합 연산까지 원자적으로 만들지는 않습니다. 두 atomic 변수의 값이 각각 최신이어도 서로 다른 시점의 조합이 관찰될 수 있습니다. 따라서 한 번 완성된 설정을 공개한 뒤 불변으로 읽는 구조는 release/acquire나 불변 객체로 단순화하고, 이후 변경이 필요하면 뮤텍스나 버전 검증을 우선 검토하겠습니다.

### 약한 순서는 증명 뒤에 선택합니다
성능 때문에 relaxed를 사용하려면 어떤 값의 순서가 필요 없고, data race와 객체 수명·ABA·복합 불변식이 다른 방식으로 보호된다는 증명을 먼저 남겨야 합니다. 테스트는 생산자 지연, 소비자 선행, 반복 공개, 여러 소비자와 재사용을 포함하고 ThreadSanitizer 같은 도구를 사용하되, 테스트 통과를 모든 실행 순서의 증명으로 보지는 않습니다. 코드 리뷰에서는 어떤 acquire가 어떤 release와 연결되는지, 공개 후 쓰기가 어디서 금지되는지 명시하겠습니다.

제시한 release/acquire 예시는 한 생산자가 결과를 채우고 공개한 뒤 소비자가 읽으며, 공개 후 생산자가 결과를 다시 수정하지 않고 두 스레드보다 객체가 오래 사는 전제에서 안전합니다. 재사용 버퍼에서는 `ready=true`가 어느 세대의 결과인지 구분해야 하고, sequence counter나 double buffer를 추가한다고 일반 비원자 데이터 race가 저절로 사라지지는 않습니다. 읽는 동안 다른 스레드가 버퍼를 덮어쓰지 않는 소유권·수명 전제가 필요하며, 포인터를 재검사하는 것만으로 이미 발생한 UB를 회복할 수 없습니다.

따라서 sequence 값 자체는 atomic으로 접근하고, 데이터는 release/acquire에 의해 공개되거나 잠금·불변 스냅숏으로 보호되어야 합니다. 다중 atomic 변수는 각각 최신이어도 서로 다른 시점의 조합을 보일 수 있어 복합 불변식을 자동으로 만들지 않습니다. 생산자 지연·세대 재사용·여러 소비자·소유권 종료를 시험하고, 어떤 acquire가 어떤 release와 연결되는지와 공개 후 writer가 금지되는지를 코드에 명시하겠습니다.

sequence counter와 double buffer는 설계 도구일 뿐 일반 비원자 데이터 race를 자동으로 없애지 않습니다. 버퍼를 읽는 동안 writer가 덮어쓰지 않는 소유권, atomic sequence의 검증된 접근, release/acquire 공개 관계가 모두 필요합니다. 포인터나 sequence를 재검사하는 것만으로 이미 발생한 undefined behavior를 회복할 수 없습니다.

## 득점 포인트

- 원자성·가시성·happens-before·객체 수명을 분리한다.
- release/acquire가 실제 공개된 값을 통해 연결되는 조건을 설명한다.
- relaxed와 복합 불변식·락의 선택을 검증 가능하게 만든다.

## 감점 포인트

- atomic이면 주변 일반 데이터도 항상 안전하다고 말한다.
- relaxed가 필요한 순서를 자동으로 보장한다고 말한다.
- 동시성 테스트 통과를 모든 실행 순서의 증명으로 본다.

## 더 파고들 거리

- release sequence가 여러 atomic 연산에 만드는 가시성 관계는 무엇인가요?
- 참조 카운트 감소와 객체 공개의 메모리 순서는 왜 다른 문제인가요?
- 여러 atomic 변수로 상태를 표현할 때 소비자가 볼 수 있는 중간 조합은 무엇인가요?

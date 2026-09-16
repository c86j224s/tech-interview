---
id: atomic-publication
title: 원자 플래그의 공개와 객체 수명
topic: 동시성
summary: release·acquire가 연결되는 값을 추적하고 C++20 release sequence·refcount·복합 상태·재사용 버퍼의 별도 조건을 설명합니다.
questionIds: [atomics-memory-order, cpp-release-sequence-visibility, atomic-refcount-reclamation-order]
---

# 원자 플래그의 공개와 객체 수명

## 플래그만 원자적이라고 본문까지 안전하지는 않습니다

생산자가 result=42를 쓰고 ready=true를 저장한 뒤 소비자가 ready를 읽고 result를 사용한다고 합시다. ready 자체의 원자성만으로 일반 result 접근의 동기화가 생기는 것은 아닙니다. 어떤 쓰기와 읽기를 연결하는지 메모리 모델의 근거가 필요합니다.

C++의 한 번 공개 모형에서 생산자의 release store 값을 소비자의 acquire load가 읽으면, release 앞의 쓰기와 acquire 뒤의 읽기에 happens-before를 만들 수 있습니다. 객체는 두 스레드보다 오래 살아 있고 공개 뒤 result를 다시 바꾸지 않는다는 전제입니다.

## 같은 값을 읽은 acquire가 연결을 만듭니다

```cpp
int result = 0;
std::atomic<bool> ready{false};
// 생산자
result = 42;
ready.store(true, std::memory_order_release);
// 소비자
if (ready.load(std::memory_order_acquire)) {
    use(result);
}
```

```diagram
{"title":"release와 acquire 사이의 공개 관계","caption":"화살표는 순서·동기화 관계입니다. acquire가 해당 release의 true를 읽는 것이 연결 조건이며, 단순히 시간상 나중에 실행됐다는 관찰만으로 대체할 수 없습니다.","rows":[[{"id":"write","label":"일반 result=42 쓰기"}],[{"id":"release","label":"ready.store(true, release)"}],[{"id":"acquire","label":"ready.load(acquire) == true"}],[{"id":"read","label":"일반 result 읽기"}]],"edges":[{"from":"write","to":"release","label":"생산자 내부 순서"},{"from":"release","to":"acquire","label":"그 값을 읽음"},{"from":"acquire","to":"read","label":"소비자 내부 순서"}]}
```

`ready=false`를 읽은 소비자는 아직 `result`를 사용해서는 안 되며, 그 load는 생산자의 `result=42`와 연결되지 않습니다. 나중에 같은 `ready`에서 생산자의 release가 만든 `true`를 acquire로 읽는 경우와, 전혀 다른 atomic을 acquire로 읽는 경우를 구분해야 합니다. `relaxed`는 해당 atomic 자체의 원자성만 유지하므로 이 공개 관계를 자동으로 만들지 않고, 한 CPU에서 값이 보였다는 실험도 모든 허용 실행의 증명은 아닙니다.

## Release sequence는 같은 atomic의 수정 순서를 봅니다

C++20 이후 정의를 기준으로, release를 시작으로 이어지는 atomic RMW 연산의 연속된 수정열에서 값을 읽는 acquire는 그 head release와 연결될 수 있습니다. 예를 들어 생산자가 data를 쓰고 flag를 release로 1로 저장하고, 다른 스레드가 relaxed RMW로 1을 2로 바꾼 뒤 소비자가 acquire로 그 2를 읽는 상황입니다.

| 변경 | 의미 |
| --- | --- |
| head release store | 그 앞의 데이터 공개 시작 |
| 이어지는 relaxed RMW | 조건을 만족하면 release sequence 유지 |
| 일반 atomic store 삽입 | C++20 이후 해당 연속열을 끊을 수 있음 |
| acquire가 다른 값 읽음 | 의도한 공개 관계를 다시 확인해야 함 |

중간 RMW를 한 스레드의 모든 일반 쓰기까지 자동으로 공개한다고 확대하지 않습니다. head release 앞 쓰기와 어떤 acquire가 연결되는지가 핵심입니다. 표준 버전별 정의 차이를 확인하고 오래된 설명의 same-thread store 규칙을 섞지 않습니다.

## 여러 atomic은 하나의 snapshot이 아닙니다

balance와 count를 각각 atomic으로 만들어도 읽는 쪽은 서로 다른 시점의 조합을 볼 수 있습니다. 두 필드의 합계 같은 불변식은 하나의 잠금·불변 snapshot·검증된 복합 연산 등 더 넓은 경계가 필요합니다.

sequence counter를 앞뒤로 읽어 같으면 안전하다고 하더라도 그 사이 일반 비원자 필드에 data race가 있었다면 C++의 undefined behavior를 나중 검사로 없앨 수 없습니다. double buffer도 독자가 읽는 버퍼를 writer가 다시 덮지 않는 소유·회수 규칙이 필요합니다.

## 참조 카운트는 최초 공개와 다른 문제입니다

이미 유효한 소유 참조를 가진 상태에서 count를 하나 늘리는 것과 raw pointer를 처음 얻는 것은 다릅니다. 일부 검증된 refcount 구현은 증가에 relaxed, 감소에 release, 마지막 감소에서 acquire fence 등을 사용하지만 이는 정해진 소유·순서 증명 아래의 패턴입니다.

raw pointer를 읽고 나중에 count를 늘리려는 사이 객체가 해제되면 원자 증가 자체도 죽은 메모리 접근입니다. refcount가 원자적이라고 객체 필드의 동시 수정이 안전하지도 않습니다. 마지막 소멸 경로에 필요한 쓰기 가시성과 최초 포인터 공개, 참조 획득의 수명을 따로 증명해야 합니다.

## 재사용은 새 세대의 소유권을 요구합니다

ready를 false로 되돌린 뒤 같은 버퍼를 다시 채우면 소비자가 이전 true를 보고 읽는 중일 수 있습니다. 단일 게시 예의 불변성을 잃는 것입니다. 세대 번호만 추가하지 말고 독자가 끝난 시점과 writer의 재사용 허가를 연결합니다.

검증에는 소비자 선행·생산자 지연·여러 소비자·반복 게시·회수 경합을 넣고 TSan 등 도구를 보조로 사용합니다. 특정 CPU에서 문제가 안 보였다는 이유로 relaxed를 허용하지 않습니다. 요구 처리량을 잠금이나 안전한 라이브러리가 충족하면 약한 메모리 순서의 복잡성을 먼저 추가할 필요는 없습니다.

---
id: python-generator-iterator
title: "큰 데이터를 generator로 한 번 순회한 뒤 다시 읽으니 아무 값도 나오지 않습니다. iterable·iterator·generator는 무엇이 다르며 다시 순회하려면 어떻게 해야 하나요?"
answerMinutes: 5
followups: [{"id":"python-asyncio-blocking","prompt":"동기 generator가 느린 파일 읽기를 수행할 때 asyncio 이벤트 루프와 어떻게 분리할까요?"},{"id":"python-duck-typing","prompt":"Protocol 인자가 재사용 가능한 iterable인지 단일 소비 iterator인지 계약에 어떻게 표현할까요?"},{"id":"go-channel-close-ownership","prompt":"generator 소비자 중단과 Go 채널 생산자 취소는 종료 신호를 각각 어디에서 소유하나요?"}]
difficulty: 하
category: 언어·런타임
tags: ["Python","iterable","iterator","generator","지연 평가"]
related: []
---

# 큰 데이터를 generator로 한 번 순회한 뒤 다시 읽으니 아무 값도 나오지 않습니다. iterable·iterator·generator는 무엇이 다르며 다시 순회하려면 어떻게 해야 하나요?

## 구두 답변

yield를 포함한 제네레이터 함수를 호출하면 제네레이터 객체를 얻습니다. 함수 본문은 이때 실행되지 않고 그 객체에서 값을 요청할 때 진행됩니다. 제네레이터 함수와 반환된 제네레이터 객체를 구분해야 합니다. 이터러블은 `iter()`를 제공하는 객체이고, 이터레이터는 `__next__()`로 다음 값을 내놓으며 자신도 이터러블인 객체입니다. 이터러블이라고 매번 새로운 이터레이터를 준다는 보편 보장은 없습니다. 리스트처럼 여러 번 순회할 수 있는 reiterable과, 제네레이터처럼 한 번 소비하면 되돌아가지 않는 one-shot iterator를 구분해야 합니다.

### 반복 가능한 객체와 소비 상태

```python
def numbers():
    print("start")
    yield 1
    yield 2

it = numbers()
print("created")
print(next(it))
print(list(it))
print(list(it))
```

출력은 `created`, `start`, `1`, `[2]`, `[]` 순서입니다. `created` 뒤에 `start`가 나오는 것이 지연 실행을 보여 줍니다. `list(it)`는 남은 값을 모두 가져가므로 그 뒤의 순회는 빈 결과가 됩니다. 따라서 한 번만 순차 처리하거나 입력이 매우 크거나 무한할 때 메모리를 아끼는 데 적합하지만, 결과를 다시 순회하거나 임의 위치를 조회해야 한다면 리스트처럼 물질화하거나 재생성해야 합니다.

### 지연 실행의 선택 기준

제네레이터가 메모리를 항상 일정하게 쓰는 것은 아닙니다. 제네레이터 내부의 상태와 각 요소가 유지되는 동안의 작업 비용은 남고, 소비자가 느리면 생산자도 결국 멈춥니다. 함수 인자로는 “반복 가능한 값”을 받을지 “이미 소비 중인 반복자”를 받을지 계약을 명확히 하고, 같은 입력을 여러 번 써야 하는 API에서 실수로 제네레이터를 공유하지 않겠습니다.

### 선택 기준과 검증

재순회가 필요한 API에 이미 소비된 generator를 넘기면 빈 결과가 정상 결과처럼 보일 수 있습니다. 재사용 가능한 iterable을 받을지 factory를 받을지 인터페이스로 정하고, generator가 파일·DB 연결을 보유하면 조기 종료 때 `close`와 context manager가 실행되는지도 확인하겠습니다. 지연 계산은 메모리 상한을 줄일 수 있지만 느린 소비자의 backpressure를 없애지는 않습니다.

동기 generator는 소비자가 next를 호출할 때만 진행하는 pull 방식입니다. 이것은 미리 모든 결과를 만드는 것보다 대기열을 작게 유지하기 쉽지만, next 한 번이 오래 걸리는 파일 읽기나 계산을 한다면 소비자도 그만큼 막힙니다. 지연 평가 자체가 비동기 I/O를 뜻하지 않으므로 asyncio 경로에서는 async iterator나 별도 실행 경계를 검토해야 합니다.

itertools.tee로 소비자를 나누면 각자가 독립적으로 진행하는 것처럼 보일 수 있지만 느린 소비자를 위해 내부 값이 버퍼링됩니다. 소비 속도 차이가 크면 메모리가 다시 늘 수 있어 재순회 비용을 없애는 만능 도구는 아닙니다. generator를 재생성하는 factory도 원본 파일이나 DB가 바뀌면 같은 결과를 주지 않을 수 있으므로, 동일한 스냅샷의 반복이 필요한지 단순 재계산이면 되는지 계약을 정하겠습니다.

## 득점 포인트

- iterable·iterator·generator의 재순회 관계를 설명한다.
- 첫 next까지 지연 실행과 소진 결과를 보존한다.
- 메모리 절약과 backpressure·재접근 비용을 비교한다.

## 감점 포인트

- 제네레이터를 리스트처럼 여러 번 재순회할 수 있다고 말한다.
- yield가 호출 즉시 전체 값을 계산한다고 설명한다.
- 지연 평가가 메모리와 실행 시간을 항상 함께 줄인다고 단정한다.

## 더 파고들 거리

- `yield from`과 generator의 send·throw·close는 제어를 어떻게 주고받나요?
- 같은 generator를 여러 소비자가 공유할 때 소비 순서가 어떻게 섞이나요?
- async generator의 `__anext__`와 일반 iterator의 종료 계약은 무엇이 다른가요?

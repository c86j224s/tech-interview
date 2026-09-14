---
id: python-iteration
title: Python Iterator의 소비 상태와 Yield From 제어
topic: 언어·런타임
summary: iterable·iterator·generator의 재순회 차이와 지연 실행·send·throw·close·반환값·tee 버퍼·자원 수명을 설명합니다.
questionIds: [python-generator-iterator, python-yield-from-control]
---

# Python Iterator의 소비 상태와 Yield From 제어

## Generator 함수를 호출할 때와 Next를 부를 때가 다릅니다

```python
def numbers():
    print('start')
    yield 1
    yield 2

it = numbers()
print('created')
print(next(it))
print(list(it))
print(list(it))
# created, start, 1, [2], []
```

generator 함수 호출은 generator 객체를 만들고 본문 실행은 next 등으로 값을 요구할 때 시작합니다. generator 객체는 현재 실행 위치와 지역 상태를 보관하는 iterator입니다. 한 번 소진한 객체를 다시 순회하면 처음부터 재생되지 않습니다.

## Iterable이라고 재생 가능한 것은 아닙니다

| 대상 | iter 호출 | 재순회 |
| --- | --- | --- |
| list | 보통 새 iterator 생성 | 같은 목록을 다시 순회 가능 |
| iterator | 자기 자신 반환 | 현재 소비 위치부터 |
| generator 객체 | 자기 자신인 iterator | 소진하면 끝 |
| generator factory | 호출마다 새 generator | 원본 데이터가 같다는 조건은 별도 |

iterator는 __next__로 값을 주고 끝에서 StopIteration을 알립니다. iterable 인터페이스만으로 매번 새로운 snapshot을 제공한다는 보장은 없습니다. API가 단일 소비 입력을 받는지 반복 사용을 요구하는지 문서화합니다. 입력을 두 번 읽어야 하면 적절한 물질화·factory·재사용 가능한 자료구조를 요구합니다.

factory가 파일·DB를 다시 읽으면 두 번째 결과가 달라질 수 있습니다. 같은 snapshot의 재생과 단순 재계산은 다릅니다. itertools.tee는 소비자를 나누지만 느린 소비자를 위해 값을 버퍼링하므로 속도 차이가 크면 메모리가 늘 수 있습니다.

## Yield From은 값 전달뿐 아니라 제어를 위임합니다

```python
def child():
    value = yield 'ready'
    return value * 2

def parent():
    result = yield from child()
    yield result

it = parent()
print(next(it))    # ready
print(it.send(3))  # 6
```

child의 return 값은 StopIteration.value를 통해 yield from 표현식의 결과가 됩니다. 단순 `for value in child(): yield value`는 이 반환값과 send·throw·close의 위임까지 같은 방식으로 처리하지 않습니다.

```diagram
{"title":"Yield From은 하위 Generator와 제어를 주고받습니다","caption":"아래 화살표는 next·send 등 제어 전달, 되돌아오는 화살표는 yield 값과 종료 반환값입니다. 하위 iterator가 지원하는 메서드에 따라 위임 규칙이 적용됩니다.","rows":[[{"id":"caller","label":"호출자"}],[{"id":"parent","label":"parent의 yield from"}],[{"id":"child","label":"child generator"}]],"edges":[{"from":"caller","to":"parent","label":"next·send·throw·close"},{"from":"parent","to":"child","label":"지원 제어 위임"},{"from":"child","to":"caller","label":"yield·종료 결과"}]}
```

새 generator에는 먼저 next 또는 send(None)로 첫 yield까지 진입해야 합니다. 처음부터 non-None send를 넣으면 오류입니다. yield from에 던진 예외는 하위의 throw 지원과 규칙에 따라 전달되고, 종료 close는 하위 close가 있으면 정리를 연결합니다. 모든 일반 iterator가 send·throw를 제공하는 것은 아닙니다.

## 조기 종료에서 자원 책임을 확인합니다

generator가 파일·DB 연결을 보유한 채 yield하면 소비자가 다음 값을 요구하기 전까지 그 자원이 남을 수 있습니다. for 루프를 break했다고 모든 임의 iterator의 close가 자동 호출된다고 일반화하지 않습니다. 명시적인 close나 contextlib.closing·자원 범위 API로 조기 종료를 관리합니다.

close는 정지한 generator에 GeneratorExit를 전달해 finally 정리를 진행하게 할 수 있습니다. 정리 중 다시 yield하는 것은 허용된 일반 종료가 아니며 오류가 될 수 있습니다. 실행 중인 generator를 여러 소비자가 동시에 재진입하는 것도 안전한 공유 모델이 아닙니다. 버전별 close 반환값 같은 세부는 해당 Python 계약을 확인합니다.

## 지연 평가가 비동기 실행은 아닙니다

동기 next 안에서 느린 파일 읽기나 긴 계산을 하면 호출자도 그 시간만큼 막힙니다. asyncio 이벤트 루프에서 동기 generator를 순회한다고 자동으로 다른 스레드가 실행하지 않습니다. async iterator나 제한된 실행 분리가 필요할 수 있습니다.

메모리는 전체 목록보다 줄일 수 있지만 프레임의 지역 객체·현재 원소·소비자가 보관한 결과는 남습니다. 무한 입력을 list로 물질화하거나 tee의 느린 소비자를 방치하면 지연 평가의 장점을 잃습니다.

## 소비 순서와 종결 동작을 직접 확인합니다

첫 next 전 부수 효과가 없는지, 일부 소비 뒤 list 결과, 소진 후 빈 결과를 검사합니다. child return 값·send·throw·조기 close의 finally 실행을 따로 확인합니다. 동일 데이터를 다시 읽어야 하는 API에는 factory와 원본 snapshot 버전까지 함께 검증합니다. 이 노트의 출력은 Python 규칙에 따른 기대 결과이며 파일·DB 스트림의 실제 종료 검증은 별도입니다.

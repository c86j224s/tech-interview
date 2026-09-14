---
id: python-object-state
title: Python 기본값·클로저·Deepcopy의 공유 상태
topic: 언어·런타임
summary: 정의 시 평가와 호출 시 바인딩 조회를 구분하고 shallow copy·memo·순환·별칭·외부 자원·일관된 snapshot의 조건을 설명합니다.
questionIds: [python-mutable-default, python-default-evaluation-late-binding, python-shallow-deep-copy, python-deepcopy-memo-aliasing]
---

# Python 기본값·클로저·Deepcopy의 공유 상태

## 빈 리스트 기본값은 같은 함수의 호출 사이에 남습니다

```python
def add_item(item, bucket=[]):
    bucket.append(item)
    return bucket

print(add_item('a'))  # ['a']
print(add_item('b'))  # ['a', 'b']
```

기본 인자 표현식은 함수 정의를 평가할 때 실행됩니다. 같은 함수 객체를 호출할 때마다 새 리스트를 만들지 않으므로 두 호출은 같은 기본 리스트를 수정합니다. 이는 모든 메모리 증가를 뜻하는 누수라기보다 의도하지 않은 호출 간 공유입니다. 함수를 새로 정의하면 또 다른 기본 객체가 생긴다는 점도 구분합니다.

호출별 새 리스트가 필요하면 기본값 None을 두고 `if bucket is None: bucket = []`로 만듭니다. `if not bucket`은 호출자가 명시적으로 준 빈 리스트까지 대체하므로 같은 계약이 아닙니다. None도 유효 입력이면 전용 sentinel 객체를 사용합니다. 명시적으로 전달한 리스트를 수정하는 API인지 복사해서 보관하는 API인지도 정해야 합니다.

## 기본값 평가와 Closure의 늦은 조회는 다른 시점입니다

```python
late = [lambda: i for i in range(3)]
fixed = [lambda i=i: i for i in range(3)]
print([f() for f in late])   # [2, 2, 2]
print([f() for f in fixed])  # [0, 1, 2]
```

late는 나중 실행할 때 공유 바인딩 i의 현재 값을 읽습니다. fixed는 각 lambda를 정의할 때 기본 인자 표현식 i를 평가해 그 값을 보관합니다. 기본 인자에 객체 참조를 고정해도 객체 내부까지 깊게 복제하는 것은 아닙니다.

| 구성 | 값이 정해지는 때 | 남을 수 있는 공유 |
| --- | --- | --- |
| `bucket=[]` | 함수 정의 평가 | 같은 기본 리스트 |
| `now=clock()` | 함수 정의 평가 | 오래된 시각 값 |
| closure의 바깥 변수 읽기 | 본문 실행 때 바인딩 조회 | 이후 재대입된 값 |
| `lambda x=x` | 해당 lambda 정의 평가 | 가변 참조 대상 |

현재 시각처럼 불변 값도 정의 때 계산하면 이후 요청에서 낡은 값이 됩니다. mutable 여부와 기본값 평가 시점은 서로 다른 축입니다. 의도적인 캐시는 기본 인자에 숨기기보다 소유 객체·상한·무효화·동시성 규칙을 드러냅니다.

## 얕은 복사는 바깥 구조만 분리합니다

```python
import copy
original = {'items': [1]}
shallow = copy.copy(original)
deep = copy.deepcopy(original)
shallow['items'].append(2)
print(original['items'], deep['items'])  # [1, 2] [1]
```

shallow의 items를 새 리스트로 **대입**하는 것은 원본 dict의 키를 바꾸지 않지만, 공유 리스트에 append하는 것은 원본에서도 보입니다. 수정할 경로와 복사할 경로를 맞춰야 합니다. copy.copy가 모든 사용자 타입에서 반드시 새 객체를 만드는지도 hook·불변 타입의 계약에 따라 다를 수 있습니다.

```diagram
{"title":"얕은 복사와 깊은 복사의 참조 범위","caption":"화살표는 참조입니다. original과 shallow는 같은 자식을 공유하고 deep은 지원되는 가변 자식을 새 그래프로 복사합니다.","rows":[[{"id":"original","label":"original"},{"id":"shallow","label":"shallow"}],[{"id":"items","label":"공유 items [1,2]"}],[{"id":"deep","label":"deep의 별도 items [1]"}]],"edges":[{"from":"original","to":"items","label":"원래 참조"},{"from":"shallow","to":"items","label":"참조만 복사"}]}
```

## Memo는 순환을 끝내고 복사본 내부의 별칭을 유지합니다

원본의 a와 b가 같은 리스트를 가리키면 한 번의 deepcopy 결과에서도 a와 b는 하나의 새 리스트를 가리킬 수 있습니다. memo는 이미 복사한 원본 객체와 새 객체의 대응을 기억합니다. 자기 자신을 가리키는 리스트도 새 리스트를 먼저 등록한 뒤 재참조하므로 무한히 복사하지 않습니다.

```python
shared = []
graph = {'a': shared, 'b': shared}
graph['self'] = graph
result = copy.deepcopy(graph)
assert result['a'] is result['b']
assert result['a'] is not shared
assert result['self'] is result
```

각 항목에 deepcopy를 따로 호출하면 memo를 공유하지 않아 원래 별칭 관계가 달라질 수 있습니다. 사용자 __deepcopy__도 재귀 전에 자기 복사본을 memo에 등록하는 등 규칙을 따라야 합니다. memo는 복사 알고리즘의 방문·대응 기록이고 cyclic GC는 도달 불가능한 메모리를 찾는 기능이므로 둘의 역할은 다릅니다.

## 깊은 복사도 모든 실행 자원을 독립시키지 않습니다

파일·소켓·lock·DB 연결을 독립 실행 자원으로 복제할 수 있다고 가정하지 않습니다. 함수·불변 객체처럼 같은 객체를 반환하는 유형도 있어 모든 노드의 주소가 달라야 한다는 테스트는 잘못될 수 있습니다. 사용자 hook은 캐시·특정 자원을 공유하도록 규칙을 바꿀 수 있습니다.

복사 중 다른 실행 흐름이 원본을 바꾸면 일관된 snapshot이 자동 생성되지 않습니다. 잠금·불변 입력·버전 경계가 필요합니다. 큰 그래프 전체 복사 대신 필요한 DTO로 명시 변환하거나 불변 노드를 공유하면 의미와 비용이 더 분명할 수 있습니다.

## 반복 호출과 그래프 정체성을 함께 검사합니다

인자 생략·명시 빈 리스트·None·반복 정의·클로저 재대입을 나누고 is와 값 비교로 공유 범위를 확인합니다. deepcopy는 공유 자식·자기 순환·사용자 hook 실패·외부 핸들을 따로 검사합니다. 정답은 모든 것을 새 주소로 만드는 것이 아니라 의도한 소유·별칭 관계가 유지되는 것입니다.

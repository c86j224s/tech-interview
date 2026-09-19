---
id: python-data-descriptor-precedence
title: 인스턴스 __dict__에 같은 이름을 넣었는데 property가 먼저 읽히는 이유는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Python
  - descriptor
  - 언어·런타임
related:
  - python-duck-typing
  - python-mutable-default
---
# 인스턴스 __dict__에 같은 이름을 넣었는데 property가 먼저 읽히는 이유는 무엇인가요?

## 구두 답변

`property`가 클래스에 있으면 data descriptor이기 때문입니다. `obj.value`를 평가할 때 Python은 먼저 `type(obj)`의 MRO에서 `value`를 찾고, 그 클래스 속성이 `__set__` 또는 `__delete__`를 제공하는지 확인합니다. 제공한다면 인스턴스 `__dict__`의 같은 키보다 descriptor의 `__get__`이 먼저 호출됩니다. 따라서 다음 상태에서는 사전에 99가 들어 있어도 점 표기법은 10을 반환합니다.

```python
class C:
    @property
    def value(self): return 10
c = C()
c.__dict__["value"] = 99
print(c.value)             # 10
print(c.__dict__["value"]) # 99
```

T0에는 클래스 후보가 property이고 인스턴스 사전에 `value: 99`가 있습니다. T1에 property가 data descriptor로 판정되고, T2에 `property.__get__(c, C)`가 실행되어 10이 나옵니다. 사전 직접 읽기는 이 규칙을 우회하는 별도 경로입니다. `c.value = 20`도 사전에 20을 쓰는 것이 아니라 property setter로 갑니다. setter가 없으면 `AttributeError`가 나므로 “읽기는 가리고 쓰기는 저장”이라고 추측하면 안 됩니다. 반대로 함수처럼 `__get__`만 제공하는 non-data descriptor는 인스턴스 값이 우선입니다. `c.f = lambda: ...`로 메서드를 shadowing할 수 있는 이유가 이것입니다. 이때 `del c.f`를 수행하면 인스턴스 사전의 후보가 사라져 다음 조회에서 다시 함수의 `__get__`이 실행됩니다. 같은 이름을 직접 사전에 넣는 것과 property setter를 호출하는 것은 저장 경로부터 다르므로 디버깅 출력도 두 경로로 나누어야 합니다. 특히 setter가 내부 `_value`를 갱신하는 구현이라면 `vars(c)`에서 `value`가 아니라 `_value`가 바뀌는지 확인해야 합니다.

## 득점 포인트

- `__set__`·`__delete__` 존재 여부가 data descriptor 판정 기준이며, `property`는 setter가 없어도 이 분류에 들어간다는 점을 설명합니다.
- `obj.value`와 `obj.__dict__['value']`가 서로 다른 접근 계약을 사용한다는 상태를 10과 99로 추적합니다.
- 함수 같은 non-data descriptor에서는 인스턴스 사전이 우선이라는 반례를 제시합니다.

## 감점 포인트

- “인스턴스 사전 값은 항상 먼저 읽힌다”고 말하면 descriptor 우선순위를 거꾸로 설명한 것입니다.
- “모든 descriptor가 property처럼 data descriptor다”라고 일반화하면 함수 shadowing을 설명할 수 없습니다.
- setter 없는 property 대입이 조용히 사전 값을 바꾼다고 하면 실제 결과인 `AttributeError`를 놓칩니다.

## 더 파고들 거리

- descriptor를 인스턴스에 저장했을 때 왜 자동으로 `__get__`이 실행되지 않는지 타입 사전 검색과 비교해 보세요.
- `__getattribute__`를 override한 클래스에서 `object.__getattribute__`로 기본 우선순위를 보존하는 방법을 검증해 보세요.

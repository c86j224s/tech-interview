---
id: python-descriptor-lookup-precedence
title: Python Descriptor와 Attribute Lookup 우선순위
topic: 언어·런타임
summary: >-
  클래스 사전의 descriptor와 인스턴스 사전이 충돌할 때 데이터 descriptor·비데이터
  descriptor·__getattribute__가 어떤 순서로 관여하는지, 바인딩과 이름 등록까지 추적합니다.
questionIds: []
prerequisites:
  - python-protocol-mro
  - python-object-state
related:
  - python-protocol-mro
  - python-object-state
reviewedAt: '2026-09-19'
---
# Python Descriptor와 Attribute Lookup 우선순위

Python의 `obj.name`은 인스턴스 사전 하나를 조회하는 연산이 아닙니다. `type(obj)`의 MRO에서 클래스 후보를 찾고, 그 후보가 descriptor인지, 데이터 descriptor인지, 인스턴스 사전에 같은 이름이 있는지를 정해진 순서로 조합합니다. 이 한 모델로 `property`가 직접 넣은 값을 가리는 현상, 함수가 bound method가 되는 현상, `__getattr__`가 마지막에만 실행되는 현상을 함께 설명할 수 있습니다.

## 조회 구성 요소

속성 이름에 대해 `vars(type(obj))`에서 찾은 클래스 값은 `cls_var`, `vars(obj)`에서 찾은 값은 `inst_var`로 생각할 수 있습니다. 클래스 값에 `__get__`이 있으면 descriptor이고, `__set__` 또는 `__delete__`까지 타입에 있으면 data descriptor입니다. `property`는 setter가 없어도 `__set__` 경로를 갖기 때문에 읽기 전용 property도 data descriptor입니다. descriptor는 클래스 사전에 있어야 이 우선순위에 참여하며, descriptor 객체를 인스턴스 필드에 넣는 것만으로는 같은 의미가 생기지 않습니다.

`__getattribute__`는 점 표기법의 앞단에서 이 기본 알고리즘을 가로채는 메서드입니다. 기본 규칙을 재사용하려면 `object.__getattribute__(obj, name)`에 위임해야 하며, 실패한 뒤의 보정 hook이 `__getattr__`입니다.

## 데이터 descriptor 우선순위

데이터 descriptor가 클래스 후보라면 인스턴스 사전보다 먼저 호출됩니다. 다음 상태에서 `a.__dict__`에는 `balance: 999`가 있지만 `a.balance`는 10입니다.

```python
class Account:
    def __init__(self):
        self.__dict__['balance'] = 999
    @property
    def balance(self):
        return 10

a = Account()
print(a.balance)                 # 10
print(a.__dict__['balance'])     # 999
```

조회 trace는 `Account.balance 발견 → __set__ 존재 판정 → __get__(a, Account) 호출 → 10 반환`입니다. 사전 직접 조회는 descriptor 경로를 우회하므로 999를 보지만, 점 표기법은 property의 계약을 봅니다. setter가 있다면 `a.balance = 20`도 `__dict__`의 키를 바꾸지 않고 `property.__set__`으로 들어갑니다. setter가 없으면 쓰기는 `AttributeError`로 끝납니다.

## 비데이터 descriptor와 shadowing

`__get__`만 있는 descriptor는 인스턴스 사전의 값이 있으면 그 값에 가려집니다. 함수가 대표적입니다.

```python
class C:
    def f(self): return 'class'
c = C()
print(c.f())       # class
c.f = lambda: 'instance'
print(c.f())       # instance
del c.f
print(c.f())       # class
```

처음에는 `C.f` 함수의 `__get__(c, C)`가 bound method를 만들고, 대입 뒤에는 `inst_var`인 lambda가 먼저 반환됩니다. 삭제 후에는 다시 함수 descriptor가 호출됩니다. 따라서 “descriptor는 항상 인스턴스보다 우선”이라는 문장은 틀리고, data/non-data를 먼저 나눠야 합니다.

## 함수 바인딩

함수 descriptor는 `function.__get__(instance, owner)`로 동작합니다. `c.f`에서는 `instance=c`가 들어가 함수와 receiver를 묶은 bound method가 만들어집니다. `C.f`에서는 instance가 `None`이라 원래 함수 객체를 얻으며, 호출자가 `C.f(c)`처럼 receiver를 직접 넘겨야 합니다.

```python
class Greeter:
    def hello(self, name): return f'{self.prefix}: {name}'
x = Greeter(); x.prefix = 'A'
bound = x.hello; raw = Greeter.hello
print(bound('Kim'))       # A: Kim
print(raw(x, 'Kim'))      # A: Kim
print(bound.__self__ is x) # True
```

`x.hello`를 callback으로 저장하면 receiver가 함께 고정됩니다. 메서드 접근 때마다 bound method wrapper가 새로 관찰될 수 있으므로 identity 비교로 중복 등록을 막을 때는 callback 수명을 명시해야 합니다.

## 이름 등록 시점

클래스 본문 namespace에 descriptor가 들어간 채 클래스가 만들어지면 `type.__new__` 과정에서 `__set_name__(owner, name)`이 호출됩니다. 필드가 공개 이름을 저장 키로 바꾸는 전형적인 구현은 다음과 같습니다.

```python
class Field:
    def __set_name__(self, owner, name):
        self.key = '_' + name
    def __get__(self, obj, owner=None):
        return self if obj is None else getattr(obj, self.key, None)
    def __set__(self, obj, value): setattr(obj, self.key, value)
class User: name = Field()
u = User(); u.name = 'Lee'
print(User.name.key, u.name)  # _name Lee
```

반대로 `User.age = Field()`처럼 클래스 생성 뒤 대입하는 일반 assignment는 `__set_name__`을 자동 호출하지 않습니다. 동적 등록 API가 `field.__set_name__(User, 'age')`를 직접 호출하거나, 아예 새 namespace로 클래스를 만들어야 합니다. 같은 Field 인스턴스를 여러 클래스에 재사용하면 마지막 호출이 이전 owner/name을 덮을 수 있으므로 클래스별 descriptor 인스턴스 또는 owner별 저장소가 필요합니다.

## 접근 hook의 경계

`__getattribute__` 안에서 `self._values`를 읽으면 다시 override로 들어갈 수 있습니다. 내부 상태는 `object.__getattribute__(self, '_values')`처럼 가져오는 것이 안전합니다. `__getattr__`는 기본 lookup이 `AttributeError`를 낸 경우에만 호출되는 후속 경로이므로 모든 접근의 선처리 hook으로 설명하면 안 됩니다.

```python
class Config:
    def __getattribute__(self, name):
        if name.startswith('_'):
            return object.__getattribute__(self, name)
        return object.__getattribute__(self, name)
    def __getattr__(self, name):
        if name == 'region': return 'ap-northeast'
        raise AttributeError(name)
```

실패한 속성 이름만 보정해야 오타와 내부 버그를 숨기지 않습니다. `except Exception`을 `__getattr__`로 바꾸면 property 계산 중의 `ValueError`나 네트워크 오류까지 “없는 속성”처럼 보이게 됩니다.

## 검증과 실패 상태

검증할 때는 `type(obj).__mro__`, `vars(type(obj))`, `vars(obj)`를 한 번에 기록하여 클래스 후보와 인스턴스 저장 상태를 분리합니다. property에는 읽기·쓰기·삭제를 각각 시험하고, 함수 descriptor에는 shadowing 전후를 시험합니다. 동적 descriptor에는 `__set_name__` 호출 여부를 확인합니다.

예를 들어 `balance`의 상태를 T0 `vars(a)={'balance':999}`, T1 클래스 후보가 data descriptor, T2 `__get__` 결과 10으로 기록하면 “값이 사라졌다”와 “접근 경로가 다르다”를 구분할 수 있습니다. 반대로 `__dict__` 직접 변경은 setter 검증·캐시 무효화·감사 로그를 모두 우회하므로 테스트에서도 정상 API와 별도 경로로 취급해야 합니다.

## 비용과 선택 기준

descriptor는 ORM field, 지연 계산, 범위 검증처럼 속성 문법에 정책을 붙일 때 유용합니다. 단순 상태에는 공개 필드나 `dataclass`가 더 명확합니다. 모든 접근을 `__getattribute__`로 감싸면 호출 비용과 재귀 위험, 디버깅 난도가 함께 증가합니다.

비데이터 descriptor의 shadowing은 의도된 per-instance callback에는 편리하지만, 메서드 이름을 실수로 덮는 오류도 허용합니다. 동적 등록은 편리하나 `__set_name__`과 기존 instance의 상태를 같이 관리해야 합니다. 이 규칙들은 Python 3 descriptor 문서의 일반 계약에 근거하며, 특정 마이너 버전의 내부 최적화나 실행 시간은 여기서 주장하지 않습니다.

## 참고 자료

- [Python Descriptor HowTo](https://docs.python.org/3/howto/descriptor.html) — data/non-data 우선순위, 함수 바인딩, `__set_name__`, attribute hook. 확인일 2026-09-19.
- [Python Data Model: Customizing attribute access](https://docs.python.org/3/reference/datamodel.html#customizing-attribute-access) — `__getattribute__`, `__getattr__`의 객체 모델 경계. 확인일 2026-09-19.
- [Python MRO 선행 개념](/tech-interview/notes/python-protocol-mro/) — MRO와 클래스 검색의 인접 설명.

```diagram
{"title":"속성 조회 우선순위","caption":"클래스 후보는 데이터 descriptor와 인스턴스 값을 구분한 뒤 서로 다른 경로로 결과에 도달합니다.","rows":[[{"id":"class","label":"클래스 후보","detail":["MRO의 이름"]}],[{"id":"data","label":"데이터 descriptor","detail":["__set__ 또는 __delete__"]}],[{"id":"instance","label":"인스턴스 사전","detail":["같은 이름의 값"]}],[{"id":"nondata","label":"비데이터 descriptor","detail":["함수 __get__"]}],[{"id":"result","label":"조회 결과","detail":["값 또는 AttributeError"]}]],"edges":[{"from":"class","to":"data","label":"데이터 여부 판정"},{"from":"data","to":"result","label":"__get__ 즉시 호출"},{"from":"class","to":"instance","label":"비데이터·일반 후보"},{"from":"instance","to":"nondata","label":"값 없을 때 descriptor"},{"from":"nondata","to":"result","label":"바인딩 또는 fallback"}]}
```

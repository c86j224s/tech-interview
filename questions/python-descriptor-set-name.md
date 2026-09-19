---
id: python-descriptor-set-name
title: 한 descriptor를 클래스 속성으로 등록할 때 __set_name__은 어떤 정보를 언제 받나요?
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
# 한 descriptor를 클래스 속성으로 등록할 때 __set_name__은 어떤 정보를 언제 받나요?

## 구두 답변

`__set_name__`은 클래스가 생성될 때 클래스 namespace에 이미 들어 있던 descriptor에게 소유 클래스와 공개 속성 이름을 알려 주는 hook입니다. 호출 형태는 `descriptor.__set_name__(owner, name)`입니다. 이를 이용하면 descriptor 생성자가 필드 이름을 중복해서 받지 않고, `name`을 실제 저장 키인 `_name`으로 바꿀 수 있습니다.

```python
class Field:
    def __set_name__(self, owner, name):
        self.storage = '_' + name
    def __get__(self, obj, owner=None):
        return self if obj is None else getattr(obj, self.storage, None)
    def __set__(self, obj, value): setattr(obj, self.storage, value)

class User:
    name = Field()
u = User(); u.name = 'Lee'
print(User.name.storage, u.name)  # _name Lee
```

T0에 User namespace의 `name` 값은 Field 객체입니다. T1에 type이 User를 완성하면서 Field에 `(User, 'name')`을 전달하고 storage를 `_name`으로 설정합니다. T2에 `u.name = 'Lee'`가 들어오면 descriptor는 `u._name`에 저장합니다. 중요한 경계는 클래스가 완성된 뒤 `User.age = Field()`라고 일반 대입하는 경우입니다. 이 assignment가 자동으로 `__set_name__`을 호출한다고 기대하면 안 되며, 동적 등록 API가 `field.__set_name__(User, 'age')`를 직접 실행해야 합니다. 같은 Field 객체를 여러 클래스에 재사용하면 마지막 등록의 owner/name을 덮을 수 있으므로 보통 클래스마다 새 객체를 만들거나 owner별 저장소를 둡니다.

## 득점 포인트

- owner와 name 두 인자를 받아 공개 이름에서 내부 저장 이름을 만드는 흐름을 코드로 설명합니다.
- 클래스 본문 등록과 클래스 생성 후 대입을 구분하고, 후자의 자동 호출 부재를 명시합니다.
- descriptor 재사용 시 상태가 공유될 수 있다는 identity 문제를 지적합니다.

## 감점 포인트

- `__set_name__`이 인스턴스마다 또는 `u.name` 조회마다 호출된다고 설명하면 hook 시점을 잘못 잡은 것입니다.
- name만 받고 owner는 받지 않는다고 하면 상속·소유 클래스별 정책을 설명할 수 없습니다.
- 동적 대입에서도 자동 초기화된다고 단정하면 storage 속성이 없어지는 실패를 놓칩니다.

## 더 파고들 거리

- 메타클래스의 `__new__`에서 동적으로 만든 필드에 hook을 적용할 때 중복 호출을 막을 불변식을 정해 보세요.
- 상속한 descriptor가 subclass에서 다른 공개 이름을 가져야 할 때 저장 키와 owner를 어떻게 분리할지 비교해 보세요.

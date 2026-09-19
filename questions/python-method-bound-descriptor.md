---
id: python-method-bound-descriptor
title: 클래스 함수가 인스턴스에서 bound method가 되는 과정과 클래스에서 읽을 때의 차이는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Python
  - descriptor
  - method-binding
  - 언어·런타임
related:
  - python-duck-typing
  - python-mutable-default
---
# 클래스 함수가 인스턴스에서 bound method가 되는 과정과 클래스에서 읽을 때의 차이는 무엇인가요?

## 구두 답변

클래스 본문에서 정의한 함수는 함수 객체이면서 non-data descriptor입니다. `c.f`를 읽으면 함수의 `__get__(c, C)`가 호출되어 함수와 인스턴스 `c`를 묶은 bound method가 만들어집니다. 그래서 `self`를 호출자가 다시 넘기지 않아도 됩니다. 반면 `C.f`에서는 descriptor의 instance 인자가 `None`이므로 원 함수에 가까운 객체가 반환되고, `C.f(c, 3)`처럼 receiver를 직접 전달해야 합니다.

```python
class Counter:
    def add(self, n): return self.base + n
c = Counter(); c.base = 7
bound = c.add
raw = Counter.add
print(bound(5))       # 12
print(raw(c, 5))      # 12
print(bound.__self__ is c) # True
```

T0에서 `Counter.add`는 함수입니다. T1에 `c.add`를 읽으면 bound wrapper의 `__self__`가 c로 설정되고, T2에 `bound(5)`가 내부적으로 `add(c, 5)`처럼 호출됩니다. T3에 클래스에서 읽은 `raw`는 아직 receiver가 없어서 `raw(5)`는 `TypeError`가 됩니다. 이 함수는 non-data descriptor라 `c.add = lambda n: 0`으로 인스턴스에서 shadowing할 수도 있고, `del c.add` 후에는 다시 class 함수 binding으로 돌아옵니다. 메서드를 callback registry에 저장할 때는 bound object의 수명과 비교 기준을 함께 정해야 합니다. 예를 들어 등록할 때 `c.add`를 한 번 읽어 저장하고 해제할 때 같은 객체를 다시 읽어 비교하면 wrapper identity가 달라질 수 있으므로, 등록 token이나 `(instance, function)` 쌍을 별도로 보관하는 편이 안전합니다.

## 득점 포인트

- `function.__get__(instance, owner)`의 instance가 인스턴스 접근에서는 c, 클래스 접근에서는 None이라는 차이를 말합니다.
- `bound(5)`와 `raw(c, 5)`가 같은 12를 만드는 실제 인자 흐름을 보여 줍니다.
- 함수가 non-data descriptor라서 인스턴스 속성으로 shadowing 가능하다는 점을 property와 대비합니다.

## 감점 포인트

- “Python이 호출 시점에 self를 전역 변수로 찾아 넣는다”고 말하면 binding이 일어나는 descriptor 단계를 놓친 것입니다.
- `C.f`도 이미 c가 묶인 bound method라고 하면 클래스 접근과 인스턴스 접근을 혼동한 것입니다.
- `c.add`와 `c.add`의 객체 identity가 항상 같다고 전제하면 callback 해제 설계가 흔들릴 수 있습니다.

## 더 파고들 거리

- 직접 만든 descriptor에서 `__get__(None, Owner)`와 `__get__(obj, Owner)`를 다르게 반환하는 패턴을 구현해 보세요.
- 인스턴스에 같은 이름의 callable을 넣어 메서드를 잠시 교체할 때, 삭제와 thread 간 callback 수명을 어떻게 보장할지 생각해 보세요.

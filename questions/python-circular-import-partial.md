---
id: python-circular-import-partial
title: 순환 import에서 모듈 객체는 있는데 특정 이름을 읽을 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Python
  - import
  - 언어·런타임
related:
  - python-gil-parallelism
---
# 순환 import에서 모듈 객체는 있는데 특정 이름을 읽을 수 없는 이유는 무엇인가요?

## 구두 답변

새 모듈은 코드 실행 전에 `sys.modules`에 삽입되므로 순환 import의 상대편은 모듈 객체를 볼 수 있습니다. 그러나 객체가 있다는 것과 top-level 초기화가 끝났다는 것은 다릅니다.

```python
# a.py
from b import value_b
value_a = 'A'

# b.py
from a import value_a
value_b = 'B'
```

`import a`를 T0에 시작하면 T1에 부분 a가 cache에 들어갑니다. T2에 a가 b를 실행하고, T3에 b가 다시 a에서 `value_a`를 가져옵니다. 하지만 a는 아직 `value_a = 'A'` 줄까지 내려오지 않았으므로 b가 보는 객체에는 그 attribute가 없습니다. 따라서 원인은 “모듈 파일을 찾지 못함”보다 “partially initialized module에서 아직 대입되지 않은 이름을 읽음”에 가깝습니다. import 순서만 바꾸면 먼저 비어 있는 이름이 달라질 뿐 cycle 자체는 남습니다.

해결은 공통 타입·상수를 제3 모듈로 옮겨 구현 모듈의 top-level 의존 방향을 단방향으로 만드는 것입니다. 함수 내부 import는 호출 시점까지 실행을 늦춰 cycle을 피할 수 있지만 첫 호출 지연과 실패 위치 은닉이라는 비용이 생깁니다. `TYPE_CHECKING`은 annotation 전용 import에는 유효하지만 runtime 객체 생성이 서로 얽힌 경우를 해결하지 않습니다. 진단에서는 `sys.modules['a'] is not None`과 `hasattr(a, 'value_a')`를 별도로 기록해야 합니다. 즉 T1의 `module is not None`은 import graph가 만든 객체의 존재만 증명하고, T3의 `hasattr` 실패는 실행 cursor가 아직 해당 대입문에 도달하지 않았다는 정보를 줍니다. 오류를 고치기 위해 import 순서만 바꾸기보다 의존성 cycle을 그래프로 찾아야 합니다. 테스트에서는 import 직전과 실패 직후의 module key를 비교하면 부분 객체와 완전 객체를 빠르게 구별할 수 있습니다.

## 득점 포인트

- cache 삽입이 module code 실행보다 먼저라는 순서를 T0~T3 상태로 보여 줍니다.
- module object 존재와 특정 attribute의 초기화 완료를 분리합니다.
- 제3 모듈 분리와 함수 내부 import의 지연·은닉 비용을 함께 설명합니다.

## 감점 포인트

- cycle은 두 module object가 전혀 생성되지 않아서만 실패한다고 하면 부분 초기화의 핵심을 놓칩니다.
- import 순서만 바꾸면 순환 의존성이 사라진다고 단정하면 실제 그래프 문제를 숨깁니다.
- `TYPE_CHECKING`만 추가하면 runtime import cycle도 해결된다고 말하면 적용 범위를 과장합니다.

## 더 파고들 거리

- package `__init__`의 재수출이 원래 cycle을 어떻게 확장하는지 import graph로 그려 보세요.
- 함수 내부 import를 사용할 때 첫 호출 동시성 경합과 초기화 lock을 어떻게 처리할지 정해 보세요.

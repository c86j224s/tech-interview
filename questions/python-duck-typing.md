---
id: python-duck-typing
title: "서로 다른 클래스의 객체를 close() 메서드만으로 처리하려 합니다. Python의 Protocol로 무엇을 검사할 수 있으며 런타임에도 같은 계약이 보장되나요?"
difficulty: 하
category: 언어·런타임
tags: ["Python","duck typing","Protocol","타입 힌트","런타임 검증"]
related: []
---

# 서로 다른 클래스의 객체를 close() 메서드만으로 처리하려 합니다. Python의 Protocol로 무엇을 검사할 수 있으며 런타임에도 같은 계약이 보장되나요?

## 구두 답변

덕 타이핑은 객체의 선언된 클래스나 상속 관계보다 필요한 행동을 기준으로 사용하는 방식입니다. 함수가 `read()`를 호출한다면 파일 클래스의 인스턴스인지보다 그 메서드를 제공하고 호출 계약을 지키는지가 중요합니다. 그래서 전혀 다른 클래스도 같은 함수에 사용할 수 있지만, 요구한 메서드가 없거나 반환 규약이 다르면 호출 시점에 `AttributeError`나 다른 오류가 납니다.

`typing.Protocol`은 이 행동 계약을 타입 검사기에 알려 주는 구조적 서브타이핑 도구입니다. 클래스가 Protocol을 상속하지 않아도 필요한 메서드와 속성을 갖추면 정적 검사에서 호환된다고 판단할 수 있습니다. `@runtime_checkable`을 붙이면 `isinstance(value, Protocol)` 형태의 제한된 런타임 검사를 할 수 있지만, 보통은 멤버 존재 여부 중심이며 반환 타입·복잡한 의미·호출 결과까지 검증해 주지는 않습니다.

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Closer(Protocol):
    def close(self) -> None: ...

class FileLike:
    def close(self): print("closed")
class Empty:
    pass

FileLike().close()
print(isinstance(FileLike(), Closer))
print(isinstance(Empty(), Closer))
```

출력은 `closed`, `True`, `False`입니다. 따라서 외부 입력처럼 실패가 예상되는 경계에서는 명시적인 검증과 오류 처리를 두고, 내부 함수 간에는 Protocol로 정적 피드백을 받되 실제 객체의 의미상 계약도 테스트하겠습니다. `isinstance`가 True라는 이유만으로 모든 동작이 안전하다고 단정하지 않는 것이 핵심입니다.

## 득점 포인트

- 덕 타이핑을 상속 관계가 아니라 필요한 행동과 호출 계약으로 설명한다.
- Protocol의 정적 구조 검증과 `runtime_checkable`의 제한된 런타임 검사를 구분한다.
- 멤버 존재와 반환값·부작용의 의미 계약은 별도 테스트가 필요하다고 말한다.

## 감점 포인트

- Protocol을 상속해야만 덕 타이핑 호환이 된다고 말한다.
- `runtime_checkable`이 메서드 시그니처와 반환 타입까지 완전히 검증한다고 주장한다.
- 동적 호출 실패가 불가능하다고 설명한다.

## 더 파고들 거리

- Protocol에서 속성·프로퍼티·generic 타입을 표현할 때 생기는 검사 차이는 무엇인가요?
- 외부 플러그인 경계에서 EAFP와 사전 `hasattr` 검사를 어떻게 선택할까요?
- 정적 타입 검사기가 놓치는 의미 계약을 어떤 테스트로 보완할까요?

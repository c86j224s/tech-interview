---
id: python-duck-typing
title: "서로 다른 클래스의 객체를 close() 메서드만으로 처리하려 합니다. Python의 Protocol로 무엇을 검사할 수 있으며 런타임에도 같은 계약이 보장되나요?"
answerMinutes: 5
followups: [{"id":"python-generator-iterator","prompt":"Protocol이 반환하는 iterator의 재순회 가능성까지 표현하려면 어떤 타입·의미 계약을 추가할까요?"},{"id":"dependency-injection-boundaries","prompt":"Protocol을 실제 외부 API 대역에 적용할 때 정적 타입과 런타임 실패를 어떻게 격리할까요?"},{"id":"go-interface-typed-nil","prompt":"Python의 None을 가진 구현과 Go typed nil 인터페이스를 비교할 때 호출 경계의 함정은 무엇인가요?"}]
difficulty: 하
category: 언어·런타임
tags: ["Python","duck typing","Protocol","타입 힌트","런타임 검증"]
related: []
---

# 서로 다른 클래스의 객체를 close() 메서드만으로 처리하려 합니다. Python의 Protocol로 무엇을 검사할 수 있으며 런타임에도 같은 계약이 보장되나요?

## 구두 답변

덕 타이핑은 객체의 선언된 클래스나 상속 관계보다 필요한 행동을 기준으로 사용하는 방식입니다. 함수가 `read()`를 호출한다면 파일 클래스의 인스턴스인지보다 그 메서드를 제공하고 호출 계약을 지키는지가 중요합니다. 그래서 전혀 다른 클래스도 같은 함수에 사용할 수 있지만, 요구한 메서드가 없거나 반환 규약이 다르면 호출 시점에 `AttributeError`나 다른 오류가 납니다.

### 행동 계약의 표현

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

### 런타임 검사와 의미

출력은 `closed`, `True`, `False`입니다. 따라서 외부 입력처럼 실패가 예상되는 경계에서는 명시적인 검증과 오류 처리를 두고, 내부 함수 간에는 Protocol로 정적 피드백을 받되 실제 객체의 의미상 계약도 테스트하겠습니다. `isinstance`가 True라는 이유만으로 모든 동작이 안전하다고 단정하지 않는 것이 핵심입니다.

### 선택 기준과 검증

`close() -> None`이라는 Protocol도 close가 두 번 호출돼도 안전한지, 호출 후 자원이 닫혔는지까지 표현하지는 않습니다. 외부 플러그인은 실제 호출을 제한된 예외 처리와 시간 상한 안에서 검증하고, 내부 구현은 정적 검사로 교체 가능성을 확보하겠습니다. Python 3.11+에서 mypy·pyright 결과와 의미 계약 테스트를 별도 산출물로 보겠습니다.

EAFP는 먼저 연산을 시도하고 예상한 실패를 처리하는 관용구이고, LBYL은 실행 전 조건을 검사하는 접근입니다. hasattr로 메서드가 있음을 확인해도 호출 시 실패나 상태 변화가 생길 수 있으므로 사전 검사만으로 계약을 증명할 수 없습니다. 반면 외부 입력에서 명확한 형식 오류를 일찍 돌려주려면 검증 단계가 유용합니다. 예상 예외만 좁게 처리해 플러그인 내부 버그를 정상적인 '메서드 없음'으로 숨기지 않겠습니다.

타입 검사도 동작의 의미를 전부 표현하지 않습니다. close가 성공하면 자원이 닫혀야 한다는 사후조건, 두 번 호출해도 되는 멱등성, 다른 스레드에서 호출할 수 있는지는 별도 테스트가 필요합니다. 신뢰하지 않는 플러그인의 실행 시간을 일반 try/except만으로 제한할 수는 없으므로 프로세스 격리나 협력적 timeout 계약을 검토합니다. 어댑터로 예외와 반환 형식을 정규화하면 호출자가 매번 구현별 예외를 처리하지 않아도 됩니다.

## 득점 포인트

- 행동 계약과 상속 관계를 구분한다.
- Protocol의 정적 구조 검사와 runtime check를 나눈다.
- 의미·부작용·호출 순서는 계약 테스트로 보완한다.

## 감점 포인트

- Protocol을 상속해야만 구조적 호환이 된다고 말한다.
- runtime_checkable이 시그니처·반환값·부작용까지 검사한다고 설명한다.
- 멤버 존재 확인만으로 의미 계약 위반이 불가능하다고 가정한다.

## 더 파고들 거리

- Protocol에서 property·generic 타입을 표현할 때 정적 검사 범위는 어떻게 달라지나요?
- 플러그인 경계에서 EAFP와 사전 hasattr 검사를 어떤 실패 모델로 선택할까요?
- 정적 타입이 놓치는 멱등 close와 스레드 안전성을 어떤 계약 테스트로 보완할까요?

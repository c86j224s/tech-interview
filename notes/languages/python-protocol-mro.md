---
id: python-protocol-mro
title: Python 행동 Protocol과 C3 메서드 탐색
topic: 언어·런타임
summary: 구조적 타입 검사와 런타임 의미 계약을 분리하고 property·분산·C3 병합 추적·super 협력·모순된 상속을 설명합니다.
questionIds: [python-duck-typing, python-protocol-property-generics, python-mro-super, python-c3-linearization-example]
---

# Python 행동 Protocol과 C3 메서드 탐색

## 같은 부모를 상속하지 않아도 같은 행동을 제공할 수 있습니다

파일과 메모리 스트림이 모두 close를 제공하면 호출자는 필요한 행동을 기준으로 사용할 수 있습니다. typing.Protocol은 이런 구조적 호환성을 정적 검사기에 표현합니다. 클래스가 Protocol을 직접 상속하지 않아도 필요한 메서드·속성과 타입 계약을 갖추면 호환될 수 있습니다.

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Closer(Protocol):
    def close(self) -> None: ...
```

runtime_checkable의 isinstance는 제한된 멤버 구조 확인이지 반환값·인자 의미·예외·멱등성의 실행 검증이 아닙니다. Python 버전에 따라 정적 속성 조회 방식 등의 세부도 달라질 수 있습니다. 정적 checker 통과와 runtime 구조 검사, 실제 계약 테스트를 별도로 기록합니다.

## 읽기 전용과 가변 속성의 타입 관계도 다릅니다

| 계약 | 정적 검사의 관심 | 별도 의미 검사 |
| --- | --- | --- |
| close() -> None | 메서드 시그니처 | 두 번 close·실제 자원 반환 |
| 읽기 전용 property T | 읽을 값 타입·공변성 가능 범위 | 값 신선도·getter 부수 효과 |
| 쓰기 가능한 속성 T | 읽기·쓰기 양쪽의 타입 안전성 | 동시 수정·소유권 |
| generic Protocol | 타입 인자·분산 | 실제 수신 원소·외부 결과 |

읽기 전용 속성이 `Animal`을 반환하는 자리에 `Dog`만 반환하는 구현을 넣는 것은 호출자가 값을 읽기만 하므로 공변 관계로 다룰 여지가 있습니다. 반대로 `Animal`을 저장할 수 있어야 하는 가변 속성 자리에 `Dog` 전용 저장소를 넣으면 호출자가 다른 `Animal`을 쓸 때 계약이 깨지므로 단순 공변으로 볼 수 없습니다. 사용하는 checker와 Python 문법 버전에 맞춰 선언하고, runtime `isinstance`가 모든 parameterized Protocol 타입 인자를 검증한다고 기대하지 않습니다.

hasattr 사전 검사가 통과해도 실제 호출이 실패하거나 상태가 바뀔 수 있습니다. EAFP는 예상 연산 실패를 좁게 처리하는 방식이며 모든 AttributeError를 삼켜 내부 버그를 메서드 부재로 숨기는 방식이 아닙니다. 비신뢰 플러그인의 시간·메모리는 try/except만으로 제한되지 않아 실행 격리도 필요합니다.

## 상속을 사용할 때는 C3가 일관된 탐색 순서를 만듭니다

A를 B와 C가 상속하고 D(B,C)가 둘을 상속하면 MRO는 D,B,C,A,object입니다. 단순히 왼쪽 부모 트리를 끝까지 내려가면 A를 C보다 먼저 방문하기 쉬운데 C3는 부모들의 기존 순서와 직접 부모 순서를 함께 보존합니다.

`L(D) = [D] + merge(L(B), L(C), [B,C])`로 계산하며, 예시에서는 `L(B)=[B,A,object]`, `L(C)=[C,A,object]`, 직접 부모 목록이 `[B,C]`가 됩니다. 각 목록의 head를 비교해 다른 목록의 tail에 없는 후보를 결과에 넣고 모든 목록의 앞에서 제거하면, 먼저 `B`, 다음 `C`, 이어서 `A`, `object`가 선택되어 `D,B,C,A,object`가 됩니다.

이처럼 후보를 고르는 순간마다 나머지 목록의 tail을 다시 확인해야 직접 부모 순서와 각 부모의 기존 순서를 함께 지킬 수 있습니다.

| 병합 상태 | 후보 판단 | 선택 |
| --- | --- | --- |
| [B,A,O], [C,A,O], [B,C] | B는 다른 tail에 없음 | B |
| [A,O], [C,A,O], [C] | A는 두 번째 tail에 있음, C는 없음 | C |
| [A,O], [A,O] | A를 앞서야 하는 head 없음 | A |
| [O], [O] | O만 남음 | O |

여기서 `O`는 `object`를 뜻합니다. 어떤 후보가 다른 목록의 tail에 있다는 것은 그 목록이 후보보다 자기 head를 먼저 놓으라고 요구한다는 뜻이므로, 그 후보를 바로 선택하면 안 됩니다. 모든 head가 이 제약에 걸려 선택할 수 없으면 부모들이 서로 모순된 순서를 요구하는 것이어서 클래스 정의가 `TypeError`로 실패하며, 한 부모가 `X,Y`, 다른 부모가 `Y,X`를 강제하는 경우가 그 예입니다.

```diagram
{"title":"Super는 실제 객체 MRO의 다음 구현을 찾습니다","caption":"화살표는 D 인스턴스에서 협력적으로 f를 호출하는 순서입니다. B의 직접 부모는 A여도 B의 super는 이 MRO에서 C.f로 이어질 수 있습니다.","rows":[[{"id":"b","label":"B.f 실행"}],[{"id":"c","label":"C.f 실행"}],[{"id":"a","label":"A.f 실행"}]],"edges":[{"from":"b","to":"c","label":"super().f()"},{"from":"c","to":"a","label":"super().f()"}]}
```

## Super는 직접 부모 이름의 별칭이 아닙니다

`B.f`에서 `super().f()`를 호출하면 `B`의 직접 부모 이름을 부르는 것이 아니라 실제 `D` 객체의 MRO에서 `B` 다음에 오는 구현을 찾습니다. 따라서 예시에서는 `B.f → C.f → A.f`로 이어질 수 있고, 참여 메서드가 같은 계약으로 다음 `super()`를 호출해야 각 구현이 한 번씩 실행됩니다. 중간에 `A.f(self)`를 직접 호출하면 `C`를 건너뛰거나 다른 경로의 `A` 호출과 중복될 수 있습니다.

협력적 __init__은 같은 고정 시그니처를 약속하거나 각 mixin이 자기 키워드 인자를 소비하고 나머지를 전달하는 방식으로 맞춥니다. 마지막 object.__init__에 남은 인자를 무조건 넘기지 않습니다. 모든 클래스가 kwargs를 써야 한다는 문법 규칙은 아니며 참여자 사이의 설계 계약입니다.

## 구조적 교체와 상속 협력을 따로 시험합니다

Protocol 구현은 정상 동작·오류·멱등 close·스레드 사용 범위를 공통 테스트로 확인합니다. 타입 검사기 결과는 별도이며 runtime 구조 검사만 통과했다고 동작을 신뢰하지 않습니다.

C3는 __mro__와 손 계산을 대조하고 각 구현 호출 횟수·필수 상태·부분 초기화 실패를 확인합니다. 협력하지 않는 외부 타입을 억지로 섞기보다 adapter와 조합으로 분리하면 경계가 단순해질 수 있습니다. 이 노트는 타입·탐색 원리 설명이며 mypy·pyright나 외부 플러그인 검증을 실행한 결과는 아닙니다.

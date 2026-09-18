---
id: python-resource-lifetime
title: Python 참조 회수와 With의 오류·자원 계약
topic: 언어·런타임
summary: CPython refcount·순환 GC·weakref를 구분하고 명시 close·exit 예외 억제·부분 진입 실패·ExitStack·내구화를 설명합니다.
questionIds: [python-refcount-cycles, python-weakref-ownership, python-context-manager-errors]
---

# Python 참조 회수와 With의 오류·자원 계약

이 노트는 Python 객체의 참조 수명과 파일·소켓·DB 같은 외부 자원의 종료 계약을 분리합니다. 참조가 사라지는 시점은 런타임 구현에 따라 달라질 수 있지만, with의 진입·종료·예외 전파는 명시적인 프로토콜로 설계하고 검증해야 합니다.

## Del의 바인딩 삭제와 잔여 참조 경로

`del value`는 그 이름의 바인딩을 제거합니다. 다른 리스트·캐시·callback이 같은 객체를 가리키면 객체는 계속 도달 가능합니다. del은 항목·속성 삭제 문법에도 쓰이지만 언제나 지운 경로 외의 다른 소유자가 남는지 확인해야 합니다.

참조 카운트를 사용하는 CPython에서는 참조 수가 0이 되면 보통 그 시점에 정리가 시작될 수 있습니다. 하지만 A와 B가 서로를 가리켜 프로그램의 다른 경로에서는 닿지 않는 순환을 만들면 내부 참조 수가 남기 때문에, 별도의 cyclic GC가 추적 가능한 객체 그래프를 검사해야 회수할 수 있습니다. 이 구현 동작을 Python 언어 전체의 즉시 소멸 보장으로 일반화하지 말고, 구현·버전·free-threaded 변화에 따라 정리 시각이 달라질 수 있음을 전제로 둡니다.

참조 모델의 기본 추적은 이름, 컨테이너 항목, callback이 같은 객체를 가리키는 세 경로를 그린 뒤 하나씩 삭제하는 것입니다. `del value` 후에도 다른 경로가 남으면 객체와 외부 자원은 계속 살아 있습니다. CPython refcount의 즉시 정리 가능성은 언어 전체의 자원 종료 계약이 아니므로, 파일·소켓은 명시 close 또는 context manager 경계를 사용합니다.

## 객체 회수와 RSS·외부 자원의 분리

| 사건 | 의미 | 자동으로 보장되지 않는 것 |
| --- | --- | --- |
| 이름 삭제 | 한 참조 경로 제거 | 모든 다른 참조 제거 |
| 객체 수집 | 객체 수명 종료·저장소 재사용 가능 | OS에 즉시 페이지 반환 |
| 파일 close | 핸들 수명 종료 | 전원 장애 내구성 |
| transaction commit | 해당 DB 계약의 확정 | 다른 저장소 효과의 원자성 |

할당자가 회수한 메모리를 재사용하려고 보유하면 heap 객체량이 줄어도 RSS가 그대로일 수 있습니다. 열린 파일·DB 연결 수는 heap 프로파일과 별도로 관찰합니다. __del__에 복잡한 저장·네트워크 정리를 몰아넣으면 실행 시점·오류 보고·객체 부활 문제가 생길 수 있습니다.

## Weak Reference와 비소유 관찰

observer가 대상의 수명을 연장할 필요가 없을 때 `weakref`를 쓰고, 사용할 때는 `obj = ref()`를 한 번 호출해 그 결과를 지역 변수에 담습니다. 결과가 `None`이면 대상이 이미 사라진 것으로 처리하고, 아니면 그 지역 참조를 계속 사용합니다. 존재를 확인한 뒤 `ref()`를 다시 호출하는 사이에도 소멸할 수 있으므로 같은 지역 참조를 유지합니다.

모든 타입이 weakref를 지원하는 것은 아니고 bound method 관찰에는 WeakMethod 같은 별도 도구가 필요할 수 있습니다. 필수 캐시·미완료 작업의 유일한 소유자를 weak로 바꾸면 필요한 데이터가 사라집니다. callback이나 finalizer가 정작 대상을 강하게 캡처해 회수를 막지 않는지도 봅니다. 약한 참조는 객체 필드의 동시 수정이나 현재 작업 세대를 보호하지 않습니다.

```diagram
{"title":"소유 수명과 관찰 수명을 분리합니다","caption":"화살표는 참조 역할입니다. owner는 대상을 유지하고 observer의 약한 참조는 유지하지 않습니다. 사용 시 얻은 지역 참조는 그 사용 범위 동안 대상 수명을 유지합니다.","rows":[[{"id":"owner","label":"실제 작업 소유자"},{"id":"observer","label":"관찰자·선택적 캐시"}],[{"id":"target","label":"대상 객체"}]],"edges":[{"from":"owner","to":"target","label":"강한 소유"},{"from":"observer","to":"target","label":"weakref 관찰"}]}
```

weakref 사용은 먼저 `obj = ref()`로 강한 지역 참조를 확보한 뒤 그 지역 변수만 사용해야 하는 짧은 수명 계약입니다. `if ref() is not None` 뒤에 다시 `ref()`를 호출하는 패턴은 두 호출 사이에 대상이 사라질 수 있어 안전한 사용 예가 아닙니다. 필수 작업의 유일한 owner를 weak로 바꾸면 관찰자가 아니라 소유권을 잃는 설계가 됩니다.

## With·Exit의 예외 처리 계약

context manager의 `__enter__`가 정상 진입한 뒤 블록을 빠져나오면 `__exit__`가 예외 정보와 함께 호출됩니다. `__exit__`가 truthy를 반환하면 블록에서 난 예외가 억제되어 호출자에게 전파되지 않으므로, 자원을 정리하는 일과 오류를 성공으로 바꾸는 결정은 분리해야 합니다.

```python
class Scope:
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc, tb):
        release_resource()
        return False  # 블록 오류를 억제하지 않음
```

`release_resource()`가 실제 자원 해제 함수라고 해도 그 안에서 예외를 던질 수 있습니다. 그러면 cleanup 오류가 전면에 나타날 수 있으므로 원래 블록 오류의 예외 연결을 보존하고 보조 오류도 기록해야 합니다. DB manager가 정상 종료에서 commit하는지 연결만 반환하는지는 제품별 계약으로 확인하고, 블록 안에서 오류를 catch해 삼키면 manager가 정상 종료로 보아 의도치 않은 commit을 만들 수 있다는 점도 함께 시험합니다.

`with Scope()`의 추적은 enter 성공 여부, 본문 예외, exit 반환값, cleanup 예외를 별도 축으로 나누는 것입니다. 본문이 실패하고 `__exit__`가 False를 반환하면 본문 예외가 유지되어야 하며, cleanup도 실패하면 원래 오류와 보조 오류의 연결을 보존하는 정책이 필요합니다. 정상 종료 시 commit하는 manager인지 단순 close하는 manager인지는 이름으로 추측하지 않습니다.

## 진입 실패와 이미 획득한 자원 정리

__enter__가 실패하면 그 manager의 __exit__가 자동으로 정리해 줄 것이라고 기대하지 않습니다. 획득 즉시 소유를 등록하고 다음 단계 실패에 대비해야 합니다. 여러 manager를 순차 진입할 때 이미 성공한 자원은 ExitStack 등에 등록해 역순으로 정리할 수 있습니다.

async context manager의 __aexit__에는 await가 있어 취소 중 cleanup의 수명도 고려합니다. cleanup task를 시작만 하고 기다리지 않으면 with를 벗어난 뒤 외부 작업이 남을 수 있습니다. 정상 예외 전파와 프로세스 강제 종료도 다르므로 중요한 외부 상태에는 재시작 복구가 필요합니다.

## 예외 소실 지점과 자원 종료 시점

정상 블록·블록 오류·truthy exit·exit 오류·enter 오류·중첩 manager를 합성 자원으로 시험합니다. close 호출 수와 원래 오류의 관찰을 따로 확인합니다. refcount·순환 수집 실험은 gc 통계·실제 참조 경로·heap·RSS·FD를 나눠 기록합니다.

객체를 한 번 수집했다는 결과를 모든 런타임의 즉시 자원 반환 계약으로 쓰지 않습니다. 이 노트는 Python 수명·오류 의미를 설명하며 실제 파일·DB의 내구 장애를 검증한 결과는 아닙니다.

실행 가능한 최소 검증은 정상 블록, 본문 오류, truthy exit, exit 오류, enter 오류를 각각 한 번씩 발생시키고 close 호출 수와 호출자에게 관찰된 예외를 기록하는 것입니다. refcount·cyclic GC·RSS·FD는 서로 다른 관측값이므로 하나의 “메모리 해제됨” 로그로 합치지 않습니다. 이 작업에서는 실제 Python 버전별 실험을 수행하지 않았습니다.

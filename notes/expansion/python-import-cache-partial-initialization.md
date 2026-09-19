---
id: python-import-cache-partial-initialization
title: Python import Cache와 부분 초기화
topic: 언어·런타임
summary: >-
  import 이름이 sys.modules에 캐시되는 시점, 순환 import의 부분 모듈, reload와 실패 cleanup을 모듈
  객체·외부 참조의 수명으로 추적합니다.
questionIds: []
prerequisites:
  - python-runtime-lab
related:
  - python-runtime-lab
reviewedAt: '2026-09-19'
---
# Python import Cache와 부분 초기화

Python import는 파일을 매번 처음부터 실행하는 문장이 아니라 이름과 모듈 객체를 연결하는 machinery입니다. 새 모듈은 실행 전에 `sys.modules`에 삽입되고, 성공 후 외부에서 완전한 객체로 사용됩니다. 이 중간 상태를 알아야 순환 import에서 객체는 있는데 이름이 없고, 초기화 예외 뒤 하위 모듈은 남을 수 있으며, reload가 외부 별칭을 갱신하지 않는 이유를 구분할 수 있습니다.

## 이름과 정체성

`sys.modules`의 key는 파일 경로가 아니라 import name입니다. 같은 이름의 모듈이 이미 있으면 일반 import는 그 객체를 다시 실행하지 않고 참조합니다.

```python
import sys
import math
first = sys.modules['math']
import math as second
print(first is second)  # True
```

이 코드는 설명용 trace입니다. 같은 파일을 다른 package 이름이나 다른 loader 경로로 노출하면 key가 달라져 별도 module identity가 생길 수 있습니다. 따라서 “파일이 같으니 같은 전역 상태”라고 말할 수 없습니다.

## 삽입과 실행 순서

개념적인 순서는 spec 탐색, module object 생성, `sys.modules[name]` 삽입, module code 실행입니다. 실행 중인 모듈도 cache에 보이기 때문에 순환 import 상대편이 부분 객체를 받을 수 있습니다. import를 시작한 모듈의 실행이 예외로 끝나면 그 실패한 모듈 entry는 정리되지만, 그 전에 성공적으로 import한 다른 모듈의 entry와 부수 효과까지 일괄 rollback된다는 보장은 없습니다.

T0에 `a`와 `b`가 cache에 없습니다. T1 `a` 객체가 cache에 들어가지만 `a.ready` 대입 전입니다. T2 `a`가 `b`를 import하고, T3 `b`가 다시 `a`를 찾으면 object identity는 얻지만 `ready`는 아직 없습니다. T4 `a.ready=True` 전에 예외가 나면 `a`는 실패 cleanup 대상이고 `b`는 이미 완료했다면 남을 수 있습니다.

## 순환 import 상태

```python
# file-a.py source
from b import value_b
value_a = 'A'

# file: b.py
from a import value_a
value_b = 'B'
```

`a`에서 시작하면 `a`가 cache에 들어간 뒤 `b`가 실행됩니다. `b`의 `from a import value_a`는 파일을 새로 열기보다 부분 `a`를 확인합니다. `value_a` 줄은 아직 실행 전이므로 문제는 module-not-found가 아니라 초기화되지 않은 attribute입니다. package `__init__`의 재수출이 이 순서를 더 복잡하게 만들 수 있습니다.

해결 우선순위는 공통 타입·상수를 제3 모듈로 옮기고 구현 방향을 단방향으로 만드는 것입니다. 함수 내부 import는 초기화를 지연해 당장의 cycle을 피할 수 있지만 첫 호출 시 오류·지연·숨겨진 의존성이라는 비용을 남깁니다. `TYPE_CHECKING`은 타입 전용 cycle에는 도움이 되지만 runtime 객체 생성 cycle을 해결하지는 않습니다.

## reload와 외부 별칭

`importlib.reload(module)`은 기존 module object를 재사용하여 그 namespace에서 코드를 다시 실행합니다. 이름을 `from service import Handler`로 가져온 consumer는 Handler 객체의 참조를 별도로 보관하므로 service namespace의 새 Handler로 자동 재바인딩되지 않습니다. `import service` 후 매번 `service.Handler`를 읽는 코드는 module namespace를 다시 볼 수 있습니다.

reload는 dictionary를 유지하므로 새 실행에서 다시 대입하지 않은 이전 이름이 남을 수 있습니다. 새 class를 만들더라도 기존 인스턴스의 `__class__`, callback, registry는 자동으로 교체되지 않습니다. reload 실패 시 namespace가 일부 새 값과 일부 옛 값의 조합으로 남을 수 있고, 공식 문서도 thread-safe하지 않다고 설명하므로 운영 hot reload는 명시적 lifecycle이 필요합니다.

## 초기화 실패 잔여 상태

`main`이 `helper`를 성공적으로 import한 뒤 top-level에서 예외를 낸 상태를 보겠습니다. 실패한 `main`은 다음 import가 부분 객체를 재사용하지 않도록 제거되지만, 완전히 초기화된 `helper`는 cache에 남을 수 있습니다. helper가 logging handler나 registry를 등록했다면 그 side effect도 자동으로 되돌아가지 않습니다.

| 시점 | main | helper | 해석 |
| --- | --- | --- | --- |
| T0 | 없음 | 없음 | 첫 요청 |
| T1 | 부분 객체 | 없음 | main 실행 중 |
| T2 | 부분 객체 | 완전 객체 | helper 성공 |
| T3 | 제거 | 남을 수 있음 | main 예외 |
| T4 | 새 객체 시도 | 기존 재사용 | 재시도 경계 |

따라서 재시도는 helper code를 다시 실행하지 않고 이전 상태를 활용할 수 있습니다. import-time 작업을 멱등적으로 만들거나 명시적 startup/cleanup 함수로 옮겨야 중복 등록을 줄일 수 있습니다.

## cache 삭제와 중복 identity

`del sys.modules['service']` 뒤 재import하면 이전 module object와 새 module object가 동시에 살아 있을 수 있습니다. 이전 `Handler`와 새 `Handler`는 이름과 소스가 같아도 class identity가 다르므로 old instance에 대해 `isinstance(old, NewHandler)`가 false가 될 수 있습니다. 다른 모듈의 alias, thread callback, global registry도 삭제만으로 바뀌지 않습니다.

`importlib.invalidate_caches()`는 finder가 directory contents를 다시 확인하도록 하는 기능이며 이미 만들어진 module object를 교체하지 않습니다. plugin 재로딩이라면 새 module 공개 전에 이전 callback 중지, registry 제거, 인스턴스 drain을 순서대로 수행해야 합니다.

## 검증 절차

작은 재현에서는 import 전후 `sys.modules.get(name) is object`와 `id(module)`을 기록합니다. 순환 사례는 각 top-level 대입 직후 marker를 남겨 어느 이름이 비어 있는지 확인합니다. 실패 사례는 주 모듈 entry, 하위 모듈 entry, 외부 registry를 각각 검사합니다. reload는 module identity, member function identity, from-import alias, 기존 instance class를 네 칸으로 나누어 비교합니다.

이 노트의 순서는 Python 3 import reference와 importlib 문서의 일반 계약에 근거합니다. finder·loader·namespace package의 상세는 구성에 따라 달라질 수 있으며 특정 마이너 버전의 내부 최적화나 오류 문구를 고정하지 않습니다.

## 비용과 설계 선택

top-level 네트워크 연결·설정 파싱·registry 등록은 import 실패를 프로세스 상태로 확장합니다. 지연 초기화는 첫 요청 지연과 동시성 경합을 만들지만 상태 전이와 lock을 명시할 수 있습니다. cycle을 함수 내부 import로 숨기는 편법은 단기적으로는 빠르나 의존 그래프와 실패 위치를 감춥니다.

reload가 필요한 plugin은 module cache보다 lifecycle이 핵심입니다. 새 버전이 준비되기 전 old version을 계속 서비스하고, 참조 교체·in-flight 요청 종료·실패 rollback을 별도 단계로 두는 편이 안전합니다.

## 참고 자료

- [The import system](https://docs.python.org/3/reference/import.html) — module creation, `sys.modules`, 순환·실패 경계. 확인일 2026-09-19.
- [importlib.reload](https://docs.python.org/3/library/importlib.html#importlib.reload) — dictionary 유지, 외부 참조, stale name, thread-safety 주의. 확인일 2026-09-19.
- [Python runtime 선행 개념](/tech-interview/notes/python-runtime-lab/) — interpreter state와 자원 경계.

```diagram
{"title":"import 부분 상태","caption":"새 모듈은 실행 전에 cache에 들어가며 성공 완료 전까지는 외부에서 부분 상태로 관찰될 수 있습니다.","rows":[[{"id":"request","label":"import 요청","detail":["이름 해석"]}],[{"id":"cache","label":"sys.modules 삽입","detail":["부분 객체"]}],[{"id":"execute","label":"모듈 코드 실행","detail":["top-level 대입"]}],[{"id":"ready","label":"완전 초기화","detail":["사용 가능한 상태"]}],[{"id":"cleanup","label":"실패 cleanup","detail":["주 모듈 entry 제거"]}]],"edges":[{"from":"request","to":"cache","label":"새 이름이면 생성"},{"from":"cache","to":"execute","label":"실행 시작"},{"from":"execute","to":"ready","label":"성공 완료"},{"from":"execute","to":"cleanup","label":"예외 시 실패 entry"}]}
```

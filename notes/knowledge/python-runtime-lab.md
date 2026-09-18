---
id: python-runtime-lab
title: CPython GIL 빌드와 확장 참조 안전성
topic: 언어·런타임
summary: CPython의 GIL 활성·free-threaded 빌드 차이와 복합 상태 동기화, C API 참조 소유권, 확장 호환성의 확인 경계를 실행 가능한 실습으로 설명합니다.
questionIds: []
prerequisites: [python-parallel-boundary, reference-counting-foundations, synchronization-foundations]
related: [python-resource-lifetime, concurrent-ownership, python-async-scope]
reviewedAt: '2026-09-18'
---

# CPython GIL 빌드와 확장 참조 안전성

## 실행 모델

Python 동시성 문제를 풀 때 먼저 세 가지 상태를 분리해야 합니다. 첫째는 현재 인터프리터가 free-threaded 구성을 지원하도록 빌드되었는가입니다. 둘째는 그 프로세스에서 GIL이 실제로 켜져 있는가입니다. 셋째는 실행 중인 코드와 C 확장이 Python 객체와 공유 상태를 어떤 계약으로 접근하는가입니다. “Python 3.13이면 GIL이 없다” 또는 “GIL이 있으면 `counter += 1`이 업무상 원자적이다”라고 말하면 이 세 경계를 합쳐 버립니다.

CPython 3.13 공식 문서는 free-threading을 GIL이 비활성화된 빌드로 설명하지만 experimental이라고 명시합니다. 소스 빌드에서는 `--disable-gil` configure 옵션을 사용합니다. 빌드 지원 여부는 `sysconfig.get_config_var("Py_GIL_DISABLED") == 1`로 판정하는 것이 권장되고, 현재 프로세스의 실제 상태는 `sys._is_gil_enabled()`로 확인합니다. 후자는 3.13의 API이므로 3.9.6에서는 존재하지 않습니다.

```diagram
{"title":"빌드 지원과 현재 실행 상태","caption":"free-threaded 지원 빌드와 현재 GIL 상태는 별도 축입니다. 확장 import가 실행 조건을 다시 바꿀 수 있으므로 세 값을 함께 기록합니다.","rows":[[{"id":"build","label":"빌드 capability","detail":["Py_GIL_DISABLED","지원 여부"]}],[{"id":"process","label":"프로세스 상태","detail":["sys._is_gil_enabled()","현재 GIL"]}],[{"id":"extension","label":"확장 호환성","detail":["GIL 표지","import 영향"]}]],"edges":[{"from":"build","to":"process","label":"실행 설정"},{"from":"process","to":"extension","label":"호출 계약"}]}
```

free-threaded 빌드도 환경 변수 `PYTHON_GIL` 또는 `-X gil`로 GIL을 켤 수 있습니다. 또한 free-threaded 지원을 명시하지 않은 C API 확장 모듈을 import하면 GIL이 자동으로 켜질 수 있고 경고가 출력될 수 있습니다. 따라서 `python -VV`에 experimental free-threading build가 표시된다는 사실만으로 현재 실행이 병렬 Python 바이트코드 상태라고 판정하지 않습니다.

## 복합 상태의 원자성

GIL은 한 인터프리터에서 한 시점에 한 스레드가 Python bytecode를 실행하게 하는 전통적인 CPython 실행 제약이지만, 여러 문장의 업무 불변식을 하나의 원자 거래로 묶지 않습니다. 다음과 같은 잔액 차감은 단일 값 대입이 아닙니다.

```python
observed = balance
if observed >= amount:
    balance = observed - amount
```

두 스레드가 같은 `observed`를 읽으면 둘 다 조건을 통과할 수 있습니다. `list`, `dict`, `set` 같은 built-in type은 free-threaded 빌드에서 concurrent modification을 보호하는 내부 잠금을 사용할 수 있지만, 공식 문서가 특정 동시 변경 결과를 언어 계약으로 보장하는 것은 아니며 현재 구현 설명으로 취급하라고 경고합니다. 복합 상태는 `threading.Lock`, 직렬 실행자, 불변 snapshot 또는 조건부 저장소 갱신처럼 의도를 드러내는 경계를 사용합니다.

기존 Python 동시성 장의 핵심과 연결하면, pure Python CPU loop와 blocking I/O의 실행 조건은 다르며, C 확장이 GIL을 놓는 동안에는 Python 객체 접근과 확장의 자체 thread safety를 별도로 봐야 합니다. free-threaded는 “스레드를 많이 만들면 빨라짐”이 아니라 Python 객체의 동시 접근 계약이 새로 노출되는 실행 조건입니다.

## 결정적 상태 추적

실습의 `compound_state.py`는 두 worker가 다음 순서에 있도록 `threading.Barrier`를 사용합니다.

| 시점 | worker 0 | worker 1 | 값 |
| --- | --- | --- | ---: |
| T0 | 시작 | 시작 | 0 |
| T1 | `observed = 0` | `observed = 0` | 0 |
| T2 | 두 worker 모두 read barrier 통과 | 두 worker 모두 read barrier 통과 | 0 |
| T3 | `value = 1` 준비 | `value = 1` 준비 | 0 |
| T4 | write barrier 통과 | write barrier 통과 | 0 |
| T5 | 1 기록 | 1 기록 | 1 |
| T6 | join 완료 | join 완료 | 1, expected 2 |

unsafe 경로는 스케줄링 우연이 아니라 두 읽기를 의도적으로 같은 상태에 맞춰 `actual=1`을 만듭니다. safe 경로는 `Lock`을 잡고 `value += 1`을 수행하므로 worker 1이 worker 0의 기록을 읽고 `actual=2`를 만듭니다. 이 코드는 GIL 유무를 증명하는 성능 실험이 아니라, GIL이 있어도 복합 불변식을 자동 보장하지 않는다는 작은 반례입니다. 실행 전후에 `free_threaded_build`, `gil_enabled`, `actual`, `expected`를 함께 남기는 이유도 이 구분입니다.

## C API 참조 소유권

C API에서 object pointer를 얻었다는 사실과 호출자가 그 객체의 생명을 보유한다는 사실은 다릅니다. borrowed reference는 그것을 빌려준 컨테이너나 소유 참조가 유효한 동안의 임시 관찰입니다. 컨테이너가 다른 스레드에서 변경될 수 있는 free-threaded 경로라면, borrowed lookup과 그 뒤 사용 사이의 수명을 한 번의 안전한 연산으로 추정해서는 안 됩니다.

CPython 3.13에는 borrowed 결과 대신 strong reference를 얻는 API가 추가되었습니다. `PyDict_GetItemRef(p, key, &result)`는 키가 있으면 `result`에 새 strong reference를 두고 `1`을 반환하며, 없으면 `NULL`과 `0`, 오류면 예외·`NULL`과 `-1`을 반환합니다. `PyList_GetItemRef()`도 새 reference를 반환하며 3.13에서 추가되었습니다. 이 API들은 조회 결과를 호출자 소유로 만든 뒤 사용·반납할 수 있다는 경계를 코드에 드러냅니다.

이전 Python을 지원해야 하면 `PyDict_GetItemWithError()` 같은 borrowed API에서 먼저 `PyErr_Occurred()`를 확인하고, 값이 존재하는 정상 경로에서 즉시 `Py_INCREF()`해 strong reference를 확보합니다. 실습의 `refsafe.c`가 이 두 경로를 `#if PY_VERSION_HEX >= 0x030D0000`으로 나눈 이유입니다. `Py_INCREF()`는 새 strong reference를 취한다는 의미이고, 사용이 끝나면 `Py_DECREF()`로 놓습니다. `Py_DECREF()` 때 deallocation 함수가 임의의 Python 코드를 실행할 수 있으므로, 마지막 release를 단순한 숫자 감소로 다루지 않고 전역 상태 일관성·재진입·정리 오류까지 봅니다.

참조 카운트 숫자를 객체 필드 보호로 읽으면 안 됩니다. 공식 C API 문서는 일부 객체가 immortal이어서 `Py_REFCNT()` 값이 실제 참조 수를 반영하지 않을 수 있고, 0 또는 1 외의 숫자에 의존하지 말라고 합니다. 같은 문서에서 확인한 범위에는 `Py_INCREF()`·`Py_DECREF()`의 구체적인 free-threaded 원자성 보장이 없으므로 이 노트는 그 보장을 주장하지 않습니다. 수명 확보, 컨테이너 동시 접근, 객체 내부 불변식, 외부 자원 정리를 각각 검증합니다.

## 확장 호환성 표지

free-threaded 빌드에서 C 확장은 GIL을 사용하지 않는 실행을 명시적으로 표시해야 합니다. multi-phase 초기화 확장은 `PyModuleDef`에 3.13 이상에서 다음 `Py_mod_gil` slot을 추가할 수 있습니다.

```c
#if PY_VERSION_HEX >= 0x030D0000
    {Py_mod_gil, Py_MOD_GIL_NOT_USED},
#endif
```

실습 코드는 기존 single-phase `PyModule_Create()` 구조를 유지하므로 free-threaded 빌드에서만 정의되는 `PyUnstable_Module_SetGIL()`을 `#ifdef Py_GIL_DISABLED` 안에서 호출합니다. 이 샘플은 확장을 free-threaded 호환으로 표시하는 최소 경계를 보여 주지만, 표지만 추가했다고 모듈 내부의 모든 전역 상태·callback·컨테이너 순회가 thread-safe가 되는 것은 아닙니다.

CPython 3.13 공식 문서는 free-threaded build가 현재 Limited C API 또는 stable ABI를 지원하지 않는다고 설명하고 별도 wheel이 필요하다고 적습니다. 이 노트는 packaging metadata나 wheel matrix를 구현하지 않으므로, 실제 배포 호환성의 완결된 지침으로 사용하지 않습니다. Python 3.14 이후 이 제한이 바뀌었는지는 이 실습의 3.13 공식 근거에서 확장하지 않았습니다.

## 코드 읽기

`compound_state.py`의 `Gate`는 업무 코드의 동기화 수단이 아니라 재현용 스케줄러입니다. `unsafe_add()`는 읽은 값을 두 barrier 사이에 보관하고, 두 thread가 모두 준비된 뒤 같은 계산 결과를 씁니다. `safe_add()`는 gate를 사용하지 않고 lock이 보호하는 하나의 임계 구역에서 증가합니다. 실행할 때 unsafe와 safe의 출력이 각각 `actual=1`, `actual=2`인지 확인하며, 이를 “GIL을 끄고 켰을 때의 처리량 비교”로 해석하지 않습니다.

`refsafe.c`는 Python 3.13 경로에서 `PyDict_GetItemRef()`의 세 결과를 검사합니다. `-1`이면 `NULL`을 반환해 C API 예외를 호출자에게 전파하고, `0`이면 Python `None`을 반환하며, `1`이면 이미 strong인 `value`를 반환합니다. 이전 경로는 borrowed `value`가 `NULL`일 때 오류가 있는지 먼저 확인한 뒤, 정상 객체만 `Py_INCREF()`하여 반환합니다. 반환 객체의 소유를 caller에게 넘겼으므로 Python wrapper가 그 reference를 관리합니다.

모듈 초기화에서 `PyUnstable_Module_SetGIL()` 오류가 나면 모듈 reference를 `Py_DECREF()`하고 `NULL`을 반환합니다. 이 오류 cleanup과 반환 경로를 생략하지 않은 이유는 부분 초기화된 확장을 성공한 것으로 노출하지 않기 위해서입니다. 3.9에서는 전처리기가 이전 버전 분기를 고르며, 개발 헤더가 없으면 해당 빌드는 미실행입니다. 아래 실행 범위에서는 별도로 찾은 regular CPython 3.14의 빌드 결과를 구분합니다.

## 실행 절차

저장소 루트에서 다음을 실행합니다.

```sh
cd examples/knowledge/python-runtime-lab
python3 compound_state.py
python3 compound_state.py --safe
make build-extension PYTHON=python3
```

Python 명령 두 개는 외부 의존성이 없고 worker를 모두 `join()`합니다. 예상 출력은 다음과 같습니다.

```text
python=3.9.6 free_threaded_build=None gil_enabled='unavailable'
mode=unsafe actual=1 expected=2
python=3.9.6 free_threaded_build=None gil_enabled='unavailable'
mode=safe actual=2 expected=2
```

C 확장은 CPython 개발 헤더가 설치된 3.13 또는 그 이후의 대상 환경에서 `python3-config`가 실제 인터프리터와 일치하는지 확인한 뒤 빌드합니다. `make build-extension`은 컴파일 성공뿐 아니라 module import, 존재하는 key lookup, 없는 key lookup을 assertion으로 확인합니다. 이 환경의 기본 `/usr/bin/python3`는 3.9.6이며 개발 헤더 경로가 실제로 존재하지 않아 그 interpreter로 C 확장을 빌드하지 못했습니다. 별도로 확인 가능한 `/opt/homebrew/opt/python@3.14/bin/python3.14` 3.14.7 regular build와 일치하는 헤더로는 `refsafe.c`를 빌드하고 import·lookup assertion을 통과했습니다. 이 실행은 free-threaded build가 아닙니다.

free-threaded 대상에서는 먼저 다음 capability 출력을 기록합니다.

```sh
python3 -VV
python3 -c 'import sys, sysconfig; print(sys.version); print(sysconfig.get_config_var("Py_GIL_DISABLED")); print(getattr(sys, "_is_gil_enabled", lambda: "unavailable")())'
```

소스에서 대상을 재현할 때는 CPython 3.13 계열의 고정된 source tag 또는 commit을 먼저 정하고, 별도 scratch/build prefix를 사용해 `./configure --disable-gil` 후 `make`와 대상 interpreter로 capability·lab 테스트를 실행합니다. 이 노트에서는 source를 다운로드하거나 설치하지 않았고, tag·commit을 고정한 실제 빌드를 실행했다고 주장하지 않습니다. 공식 문서가 experimental이라고 부르는 기능은 대상 버전·컴파일러·확장 조합별로 다시 확인합니다.

## 실패 주입

첫 번째 실패는 `unsafe_add()`에서 barrier를 제거하는 것입니다. 그러면 두 worker가 같은 값을 읽는 시점이 보장되지 않아 unsafe 결과가 때때로 2가 됩니다. 진단 포인트는 “실패하지 않았다”가 아니라 재현 조건이 사라졌다는 것입니다. 두 번째 실패는 `safe_add()`의 `with self.lock`을 제거하는 것입니다. 그러나 이 짧은 실행에서는 여전히 2가 나올 수 있습니다. 손실을 결정적으로 보이려면 unsafe 경로처럼 읽기 뒤 장벽으로 두 스레드를 맞춰야 합니다. 세 번째 실패는 C의 이전 버전 분기에서 `Py_INCREF(value)`를 제거하는 것입니다. 함수가 borrowed pointer를 caller-owned return으로 가장하게 되어 수명 계약이 틀립니다.

확장의 free-threaded 표지를 제거하는 실패도 별도로 봅니다. 3.13 free-threaded interpreter가 해당 모듈을 import할 때 경고와 함께 GIL을 켤 수 있으므로, module import 전후 `sys._is_gil_enabled()`와 stderr를 기록합니다. 이 동작을 이 로컬 실행에서 확인하지 않았으므로 예상 진단으로만 적습니다. “표지가 있으니 내부가 안전하다”는 결론을 내리려면 모듈의 전역 mutable state, borrowed API, callback 실행자, 컨테이너 순회에 대한 별도 설계와 경쟁 시험이 필요합니다.

## 장애 진단

첫 단계는 프로세스가 정말 대상 free-threaded build인지 확인하는 것입니다. `Py_GIL_DISABLED`가 `1`이 아니면 free-threaded build 지원을 주장하지 않습니다. 둘째는 `sys._is_gil_enabled()`의 현재 값을 확장 import 전후로 비교하는 것입니다. 셋째는 Python 상태 오류와 C reference lifetime 오류를 나누는 것입니다. deterministic Python test가 `actual=1`이면 복합 상태 보호가 빠진 것이고, C lookup에서 `-1`인데 예외를 지우거나 `NULL`을 정상값으로 취급하면 오류 전파가 깨진 것입니다.

마지막으로 “객체가 살아 있다”와 “객체 필드가 일관되다”를 나눕니다. strong reference는 객체 수명을 유지하는 범위의 계약이고, 그 객체의 dict/list와 사용자 필드를 여러 스레드가 동시에 읽고 바꾸는 규칙은 별도입니다. borrowed-to-strong 전환도 컨테이너 변경 자체의 의미를 해결하지 않습니다. 필요하다면 lock, `Py_BEGIN_CRITICAL_SECTION`/`Py_END_CRITICAL_SECTION`, 불변 snapshot 또는 호출자 직렬화를 선택하되, 이번 실습은 dict iteration이나 전역 컨테이너 공유를 실행하지 않습니다.

## 버전과 실행 범위

안정적으로 확인한 기준은 CPython 3.13.15 공식 문서의 free-threading·C extension support·reference counting·dict/list API 본문입니다. 문서가 “starting with 3.13”, “experimental”, “added in 3.13”이라고 표시한 부분은 그 적용 범위를 그대로 유지합니다. free-threaded 빌드의 Limited C API/stable ABI 지원 여부는 이 3.13 문서가 현재 지원하지 않는다고 설명하므로 3.13에 한정해 기록합니다. Python 3.14의 변경을 이 문서에서 추론하지 않습니다. 로컬 실행은 macOS 27 arm64 환경에서 제공된 `/usr/bin/python3` 3.9.6과 regular CPython 3.14.7의 표준 threading 시험, 그리고 regular 3.14.7의 C 확장 시험입니다. 3.9.6은 `sys._is_gil_enabled`와 `Py_GIL_DISABLED`를 제공하지 않았습니다.

이 lab은 표준 Python의 결정적 복합 상태 재현과 짧은 C API 소유권 샘플에 경계를 둡니다. 모든 공식 feature, 모든 C API borrowed 함수, stable ABI/wheel packaging, subinterpreter, allocator, native thread pool, 실제 free-threaded 성능, 운영 배포를 다루지 않습니다. C API 샘플을 빌드하지 못한 실행 환경은 실패로 위장하지 않고 `NOT_RUN`으로 남깁니다. 실행 가능성은 Python 3.9 경로에서 확인하되, free-threaded integration이 실행되었다고 표현하지 않습니다.

## 참고 자료

- [Python 3.13: Python experimental support for free threading](https://docs.python.org/3.13/howto/free-threading-python.html) — CPython 3.13.15 문서, 2026-09-18 확인. `--disable-gil`, `sys._is_gil_enabled()`, `Py_GIL_DISABLED`, runtime GIL re-enable, extension import effect, built-in internal locking의 적용 경계.
- [Python 3.13: C API Extension Support for Free Threading](https://docs.python.org/3.13/howto/free-threading-extensions.html) — CPython 3.13.15 문서, 2026-09-18 확인. `Py_mod_gil`, `PyUnstable_Module_SetGIL`, `Py_GIL_DISABLED`, borrowed/strong replacement, critical section, 3.13의 Limited C API/stable ABI 제한. refcount 원자성의 근거로 사용하지 않음.
- [Python 3.13: Reference Counting](https://docs.python.org/3.13/c-api/refcounting.html) — CPython 3.13.15 문서, 2026-09-18 확인. `Py_INCREF`, `Py_DECREF`, immortal objects, deallocation reentrancy. free-threaded refcount 원자성의 명시적 보장은 확보하지 못함.
- [Python 3.13: Dictionary Objects](https://docs.python.org/3.13/c-api/dict.html) — CPython 3.13.15 문서, 2026-09-18 확인. `PyDict_GetItemRef()`의 `1/0/-1`, new strong reference, 3.13 추가.
- [Python 3.13: List Objects](https://docs.python.org/3.13/c-api/list.html) — CPython 3.13.15 문서, 2026-09-18 확인. `PyList_GetItemRef()`의 new reference와 3.13 추가.
- [기존 Python 병렬 실행 경계](/tech-interview/notes/python-parallel-boundary/) — 기존 노트. GIL 활성·native 계산·프로세스 경계의 선행 개념. 현재 실행 결과를 free-threaded 검증으로 읽지 않도록 범위를 이어 받음.
- [기존 Python 자원 수명](/tech-interview/notes/python-resource-lifetime/) — 기존 노트. CPython refcount·순환 GC·weakref와 명시 cleanup의 선행 개념.
- [기존 동시 참조 획득](/tech-interview/notes/concurrent-ownership/) — 기존 노트. borrowed/raw pointer와 strong 수명 확보를 동시 필드 보호와 분리하는 모델.

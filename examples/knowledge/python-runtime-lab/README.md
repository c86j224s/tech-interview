# CPython free-threading lab

이 실습은 GIL이 켜진 CPython과 free-threaded 빌드에서 **Python 객체의 복합 상태 변경**, **C API borrowed reference의 수명**, **확장 모듈 호환 표지**를 작은 실행 단위로 확인하는 실습입니다. 코드 경로는 `examples/knowledge/python-runtime-lab/`입니다.

## 의존성

- 표준 Python 3.9 이상: `compound_state.py` 실행
- CPython 개발 헤더와 `python3-config`, C compiler: `refsafe.c` 빌드
- 외부 패키지·네트워크·컨테이너 불필요
- 권장 확인 대상: CPython 3.13 free-threaded 빌드. 이 실습은 현재 로컬 `/usr/bin/python3` 3.9.6에서도 Python 부분을 실행하지만, 그 실행은 free-threaded 지원을 검증하지 않습니다.

## 실행

저장소 루트에서 다음 명령을 실행합니다.

```sh
cd examples/knowledge/python-runtime-lab
python3 compound_state.py
python3 compound_state.py --safe
make build-extension PYTHON=python3
```

`compound_state.py`는 두 worker를 barrier로 읽기와 쓰기 사이에 멈춰 세워 안전하지 않은 `read → modify → write`가 한 증가를 잃는 상태를 결정적으로 만듭니다. `--safe`는 같은 논리 변경을 하나의 `Lock`으로 묶습니다.

`refsafe.c`는 Python 3.13 이상에서 `PyDict_GetItemRef()`를 사용하고, 이전 CPython에서는 `PyDict_GetItemWithError()`로 얻은 borrowed reference를 즉시 `Py_INCREF()`해 strong reference로 승격합니다. `Py_GIL_DISABLED`가 정의된 빌드에서는 single-phase module 초기화 뒤 `PyUnstable_Module_SetGIL(m, Py_MOD_GIL_NOT_USED)`를 호출합니다. 이 호출은 free-threaded 빌드에서만 정의되므로 매크로로 감쌉니다. `make`는 `PYTHON` 변수로 interpreter와 헤더를 맞춰야 하며, `/usr/bin/python3` 3.9.6은 개발 헤더가 없어 C 경로가 실행되지 않습니다. 이 환경에서는 `/opt/homebrew/opt/python@3.14/bin/python3.14` 3.14.7 regular build로만 확장 import를 확인했습니다.

## 예상 결과

```text
mode=unsafe actual=1 expected=2
mode=safe actual=2 expected=2
refsafe: PASS
```

첫 줄의 `actual=1`은 일반적인 스레드 스케줄링 우연이 아니라 이 실습의 barrier 순서가 만든 결과입니다. CPython 3.9.6의 GIL이 이 결과를 막아 주지 않는 이유는 GIL이 여러 Python 문장을 업무 불변식의 하나의 원자 거래로 만들지 않기 때문입니다.

## 실패 주입

- `compound_state.py`에서 `unsafe_add`의 barrier를 지우면 실패가 비결정적으로 바뀝니다. 이는 재현성이 스케줄 제어에 의존함을 보여 줍니다.
- `safe_add`에서 lock만 제거한다고 항상 실패하지는 않습니다. 읽기와 쓰기 사이에 별도 gate를 넣어야 lost update를 결정적으로 재현할 수 있습니다.
- `refsafe.c`의 `Py_INCREF(value)`를 제거하면 이전 버전 경로가 반환할 strong reference 계약을 충족하지 못합니다. 다만 이 실습에서는 반환 직후 객체가 계속 살아 있는 작은 검사만 하므로, 수명 버그를 sanitizer가 반드시 잡는다고 주장하지 않습니다.
- Python 3.13 헤더로 free-threaded 확장을 만들되 `Py_MOD_GIL_NOT_USED` 표지를 제거하면 import 시 GIL이 켜지거나 경고가 발생할 수 있습니다. 이 동작은 대상 CPython 빌드에서 확인해야 하며, 이 실행에서는 확인하지 않았습니다.

## 진단 순서

1. `python -VV`와 `sys.version`에서 free-threading build 표시를 확인합니다.
2. `sysconfig.get_config_var("Py_GIL_DISABLED") == 1`로 빌드가 free-threaded를 지원하는지 확인합니다.
3. `getattr(sys, "_is_gil_enabled", None)`가 존재하면 호출해 현재 프로세스에서 GIL이 실제 켜져 있는지 확인합니다. 3.9에서는 이 capability가 없습니다.
4. unsafe/safe 각각의 `actual`, `expected`와 thread join 완료를 기록합니다. barrier timeout을 추가하는 확장 실험에서는 `BrokenBarrierError`를 실패로 취급하고 모든 worker를 join합니다.
5. C 경로는 `PyDict_GetItemRef`의 반환값 `1/0/-1`, 반환 객체의 strong ownership, 예외 전파 여부를 확인합니다. dict를 다른 스레드가 동시에 변경하는 전체 자료구조 계약은 이 샘플의 범위 밖이며, 일반 `Lock` 또는 API별 critical section을 별도로 설계해야 합니다.

## 범위와 비범위

이 실습은 표준 threading의 compound-state 재현과, C API의 borrowed-to-strong reference 전환 및 free-threaded 호환 표지라는 두 경계를 보여 줍니다. Python built-in container의 내부 잠금이 모든 복합 연산을 보장한다거나, `Py_INCREF`/`Py_DECREF`의 구체적인 원자성·전체 확장 thread safety를 증명하지 않습니다. 또한 wheel metadata, packaging backend, subinterpreter, stable ABI 전 범위, native 라이브러리 내부 thread pool, 성능 벤치마크, 운영 배포는 다루지 않습니다.

free-threaded CPython 3.13은 공식 문서상 experimental입니다. Python 3.13 문서는 free-threaded 빌드가 GIL을 실행 시 다시 켤 수 있고, 호환 표지가 없는 C 확장 import가 GIL을 자동으로 켤 수 있다고 설명합니다. 따라서 “free-threaded로 빌드했다”와 “현재 프로세스에서 GIL이 꺼져 있다”를 같은 상태로 기록하지 않습니다. 3.13 문서는 해당 빌드가 Limited C API/stable ABI를 현재 지원하지 않는다고도 설명하지만, 이 제한을 3.14 이상으로 확장하지 않습니다. 3.14 이상의 다른 세부 사항은 이 문서에서 3.13 근거로 추론하지 않습니다.

## 구현 읽기

`compound_state.py`의 `Gate`는 실제 업무 lock이 아니라 실험용 실행 순서 제어기입니다. unsafe 경로는 두 worker가 같은 `observed` 값을 읽게 하고, 둘 다 `observed + 1`을 기록하게 합니다. safe 경로는 `value += 1` 전체를 lock 안에서 수행하여 두 번째 worker가 첫 번째 worker의 결과를 읽습니다. 즉, 보호해야 할 것은 단일 bytecode 이름이 아니라 업무 불변식의 읽기·검사·갱신 범위입니다.

`refsafe.c`의 3.13 경로는 `PyDict_GetItemRef()`가 성공 시 새 strong reference를 반환하고, 키 부재 시 `0`, 오류 시 `-1`을 반환한다는 계약을 직접 반영합니다. 이전 경로의 `PyDict_GetItemWithError()`는 borrowed reference이므로 반환 전에 오류를 검사하고, 정상 객체라면 `Py_INCREF()`로 호출자 소유를 만듭니다. `Py_DECREF()`는 반환 후 호출자 책임인 strong reference를 놓는 일이며, immortal object의 refcount가 일반 객체처럼 보이지 않을 수 있다는 점과 객체 필드 동기화는 별도 문제입니다.

## 실행 상태

실제 실행한 것은 표준 Python 3.9.6과 regular CPython 3.14.7의 compound-state 시험, 그리고 regular CPython 3.14.7의 C extension build/import 시험입니다. Python 3.13 free-threaded 인터프리터는 로컬에 없어 `NOT_RUN`입니다. 실행 조건과 미실행 플랫폼을 학습 노트에서 분리합니다.
